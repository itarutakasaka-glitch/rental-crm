"use server";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { sendLineMessage } from "@/lib/channels/line";
import { sendSms } from "@/lib/channels/sms";

export async function sendMessage(data: { customerId: string; senderId?: string; channel: "EMAIL"|"LINE"|"SMS"|"CALL"|"NOTE"|"VISIT"; subject?: string; body: string }) {
  const customer = await prisma.customer.findUnique({ where: { id: data.customerId }, include: { organization: true } });
  if (!customer) throw new Error("Customer not found");
  const message = await prisma.message.create({ data: { customerId: data.customerId, senderId: data.senderId, direction: "OUTBOUND", channel: data.channel, subject: data.subject, body: data.body, status: "PENDING" } });
  try {
    if (data.channel === "EMAIL" && customer.email && process.env.RESEND_API_KEY) {
      let emailBody = data.body;
      if (!customer.lineUserId) {
        const code = String(Math.floor(1000 + Math.random() * 9000));
        await prisma.customer.update({ where: { id: customer.id }, data: { lineCode: code } });
        emailBody += `\n\n---\nLINE\u3067\u3082\u304A\u6C17\u8EFD\u306B\u3054\u9023\u7D61\u304F\u3060\u3055\u3044\u3002\n\u53CB\u3060\u3061\u8FFD\u52A0: https://line.me/R/ti/p/@331fxngy\n\u8FFD\u52A0\u5F8C\u3001\u8A8D\u8A3C\u30B3\u30FC\u30C9\u300C${code}\u300D\u3092LINE\u3067\u9001\u4FE1\u3057\u3066\u304F\u3060\u3055\u3044\u3002`;
      }
      const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: `${customer.organization.name} <${process.env.RESEND_FROM_EMAIL || "noreply@example.com"}>`, to: customer.email, subject: data.subject || "(No subject)", text: emailBody }) });
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
