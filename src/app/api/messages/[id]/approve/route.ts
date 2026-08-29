import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthUserForAction, canAccessOrg } from "@/lib/auth";
import { sendLineMessage } from "@/lib/channels/line";
import { sendSms } from "@/lib/channels/sms";

// Phase1(下書き承認方式)の要: cron/agentがstatus="PENDING"で作った下書きを、
// 人間がここで確認・編集(bodyを上書き可)してから実際に送信する。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUserForAction();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const overrideBody: string | undefined = body?.body;

    const message = await prisma.message.findUnique({ where: { id }, include: { customer: { include: { organization: true } } } });
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    if (message.direction !== "OUTBOUND" || message.status !== "PENDING") {
      return NextResponse.json({ error: "この下書きは既に処理済みです" }, { status: 400 });
    }
    if (!canAccessOrg(user, message.customer.organizationId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const finalBody = overrideBody ?? message.body;
    const customer = message.customer;

    if (message.channel === "EMAIL" && customer.email && process.env.RESEND_API_KEY) {
      const html = finalBody.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
      const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `${customer.organization.name} <${fromEmail}>`, to: customer.email, subject: message.subject || "(No subject)", html }),
      });
      if (!res.ok) throw new Error("Resend error");
    } else if (message.channel === "LINE" && customer.lineUserId) {
      await sendLineMessage(customer.lineUserId, finalBody);
    } else if (message.channel === "SMS" && customer.phone) {
      await sendSms(customer.phone, finalBody);
    } else {
      return NextResponse.json({ error: "送信先情報が不足しています(メール/LINE/電話番号)" }, { status: 400 });
    }

    const updated = await prisma.message.update({
      where: { id },
      data: { body: finalBody, status: "SENT", senderId: user.id },
    });
    await prisma.customer.update({ where: { id: customer.id }, data: { lastContactAt: new Date(), lastActiveAt: new Date() } });

    return NextResponse.json({ success: true, message: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 下書きを却下(送信しない)。Message自体は履歴として残すためstatusをFAILEDにする。
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUserForAction();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const message = await prisma.message.findUnique({ where: { id }, include: { customer: true } });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (!canAccessOrg(user, message.customer.organizationId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (message.status !== "PENDING") return NextResponse.json({ error: "この下書きは既に処理済みです" }, { status: 400 });

  await prisma.message.update({ where: { id }, data: { status: "FAILED" } });
  return NextResponse.json({ success: true });
}
