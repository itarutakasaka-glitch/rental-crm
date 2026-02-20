import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const CALL_RESULT_LABELS: Record<string, string> = {
  success: "成功（通話あり）",
  noanswer: "不在",
  busy: "話し中",
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { email: user.email! }, select: { id: true, name: true, organizationId: true } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { customerId, channel, subject, body, to, lineUserId, phone, callResult } = await request.json();
    if (!customerId || !body) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    let externalId: string | undefined;
    let messageStatus = "SENT";
    let finalBody = body;
    let finalSubject = subject || null;

    if (channel === "EMAIL") {
      if (!to) return NextResponse.json({ error: "Missing email" }, { status: 400 });
      const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com";
      const org = await prisma.organization.findFirst({ where: { id: dbUser.organizationId! }, select: { name: true } });
      const fromName = org?.name || "Claude Cloud CRM";
      const result = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject: subject || "（件名なし）",
        text: body,
        replyTo: fromEmail,
      });
      if (result.error) {
        messageStatus = "FAILED";
        console.error("[send-message] Resend error:", result.error);
      } else {
        externalId = result.data?.id;
      }
    } else if (channel === "LINE") {
      if (!lineUserId) return NextResponse.json({ error: "Missing lineUserId" }, { status: 400 });
      const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!accessToken) return NextResponse.json({ error: "LINE not configured" }, { status: 500 });
      const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text: body }] }),
      });
      if (!lineRes.ok) {
        const errData = await lineRes.json().catch(() => ({}));
        console.error("[send-message] LINE error:", errData);
        messageStatus = "FAILED";
      }
    } else if (channel === "SMS") {
      if (!phone) return NextResponse.json({ error: "Missing phone" }, { status: 400 });
      // Twilio integration placeholder
      console.log("[send-message] SMS to", phone, "body:", body);
      messageStatus = "SENT";
    } else if (channel === "CALL") {
      const resultLabel = CALL_RESULT_LABELS[callResult] || callResult || "不明";
      finalSubject = `架電記録（${resultLabel}）`;
      finalBody = `【結果】${resultLabel}\n${body}`;
    } else if (channel === "NOTE") {
      finalSubject = "メモ";
    }

    const message = await prisma.message.create({
      data: {
        customerId,
        senderId: dbUser.id,
        direction: "OUTBOUND",
        channel,
        subject: finalSubject,
        body: finalBody,
        status: messageStatus as any,
        externalId: externalId || null,
      },
    });

    // Auto clear isNeedAction on outbound communication
    if (channel === "EMAIL" || channel === "LINE" || channel === "SMS") {
      await prisma.customer.update({
        where: { id: customerId },
        data: { isNeedAction: false, lastContactAt: new Date() },
      });
    }
    if (channel === "CALL" && callResult === "success") {
      await prisma.customer.update({
        where: { id: customerId },
        data: { isNeedAction: false, lastContactAt: new Date() },
      });
    }

    return NextResponse.json(message, { status: 201 });
  } catch (e) {
    console.error("[POST /api/send-message]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}