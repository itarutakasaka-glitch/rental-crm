import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const body = await request.json();
    const { customerId, channel, subject, body: msgBody, to } = body;

    if (!customerId || !msgBody) {
      return NextResponse.json({ error: "customerId and body are required" }, { status: 400 });
    }

    if (channel === "EMAIL" && to) {
      const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com";
      try {
        await resend.emails.send({
          from: fromEmail,
          to: [to],
          subject: subject || "(件名なし)",
          text: msgBody,
        });
      } catch (e) {
        console.error("[send-message] Resend error:", e);
        return NextResponse.json({ error: "メール送信に失敗しました" }, { status: 500 });
      }
    }

    const message = await prisma.message.create({
      data: {
        customerId,
        direction: "OUTBOUND",
        channel: channel || "EMAIL",
        subject: subject || null,
        body: msgBody,
        status: "SENT",
      },
    });

    await prisma.customer.update({
      where: { id: customerId },
      data: { isNeedAction: false, updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, messageId: message.id });
  } catch (error) {
    console.error("[POST /api/send-message] Error:", error);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }
}