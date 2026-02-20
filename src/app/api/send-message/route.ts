import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
        body: JSON.stringify({
          to: lineUserId,
          messages: [{ type: "text", text: body }],
        }),
      });
      if (!lineRes.ok) {
        const errData = await lineRes.json().catch(() => ({}));
        console.error("[send-message] LINE error:", errData);
        messageStatus = "FAILED";
      }
    } else if (channel === "SMS") {
      // SMS placeholder - log and save as record
      console.log("[send-message] SMS to", phone, "body:", body);
      // When Twilio is configured, send here
      messageStatus = "SENT";
    }

    // Save message to DB
    const message = await prisma.message.create({
      data: {
        customerId,
        senderId: dbUser.id,
        direction: channel === "NOTE" || channel === "CALL" ? "OUTBOUND" : "OUTBOUND",
        channel,
        subject: subject || null,
        body,
        status: messageStatus as any,
        externalId: externalId || null,
      },
    });

    // Auto clear isNeedAction on outbound
    if (channel === "EMAIL" || channel === "LINE" || channel === "SMS") {
      await prisma.customer.update({
        where: { id: customerId },
        data: { isNeedAction: false, lastContactAt: new Date() },
      });
    }

    // For call records - if success, also clear isNeedAction
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