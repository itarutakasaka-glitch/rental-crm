"use server";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { sendLineMessage } from "@/lib/channels/line";
import { sendSms } from "@/lib/channels/sms";

export async function sendMessage(data: { customerId: string; senderId?: string; channel: "EMAIL"|"LINE"|"SMS"|"CALL"|"NOTE"|"VISIT"; subject?: string; body: string }) {
  const customer = await prisma.customer.findUnique({ where: { id: data.customerId }, include: { organization: true } });
  if (!customer) throw new Error("顧客が見つかりません");
  const message = await prisma.message.create({ data: { customerId: data.customerId, senderId: data.senderId, direction: "OUTBOUND", channel: data.channel, subject: data.subject, body: data.body, status: "PENDING" } });
  try {
    if (data.channel === "EMAIL" && customer.email && process.env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: `${customer.organization.name} <${process.env.RESEND_FROM_EMAIL || "noreply@example.com"}>`, to: customer.email, subject: data.subject || "(件名なし)", text: data.body }) });
      if (!res.ok) throw new Error("Resend error");
    } else if (data.channel === "LINE" && customer.lineUserId) {
      await sendLineMessage(customer.lineUserId, data.body);
    } else if (data.channel === "SMS" && customer.phone) {
      await sendSms(customer.phone, data.body);
    }
    await prisma.message.update({ where: { id: message.id }, data: { status: "SENT" } });
    await prisma.customer.update({ where: { id: data.customerId }, data: { lastContactAt: new Date(), lastActiveAt: new Date() } });
  } catch (e) { await prisma.message.update({ where: { id: message.id }, data: { status: "FAILED" } }); }
  revalidatePath(`/customers/${data.customerId}`);
  return message;
}

export async function recordInboundMessage(data: { customerId: string; channel: "EMAIL"|"LINE"|"SMS"; body: string }) {
  const msg = await prisma.message.create({ data: { customerId: data.customerId, direction: "INBOUND", channel: data.channel, body: data.body, status: "SENT" } });
  await prisma.customer.update({ where: { id: data.customerId }, data: { lastActiveAt: new Date(), isNeedAction: true } });
  revalidatePath(`/customers/${data.customerId}`);
  return msg;
}
