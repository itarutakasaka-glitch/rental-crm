"use server";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { sendLineMessage } from "@/lib/channels/line";
import { sendSms } from "@/lib/channels/sms";
import { getAuthUserForAction, canAccessOrg } from "@/lib/auth";

// server actionはビルド後にPOSTエンドポイントとして露出するため、必ず認証する。
// senderIdはクライアントから受け取らず、認証済みユーザーのidを使う。
export async function sendMessage(data: { customerId: string; senderId?: string; channel: "EMAIL"|"LINE"|"SMS"|"CALL"|"NOTE"|"VISIT"; subject?: string; body: string }) {
  const user = await getAuthUserForAction();
  if (!user) throw new Error("Unauthorized");
  const customer = await prisma.customer.findUnique({ where: { id: data.customerId }, include: { organization: true } });
  if (!customer) throw new Error("Customer not found");
  if (!canAccessOrg(user, customer.organizationId)) throw new Error("Forbidden");
  // architecture-v2.md §9(穴#16): 二重対応防止。/api/customers/[id]/lock のハートビートで
  // 保持されたロックが自分以外・かつ新しい(90秒以内)場合は顧客向け送信を止める。
  // UIの表示漏れ・タイミングずれで別オペが同時に画面を開いていても、実際の送信はここで必ず1人に絞る。
  // CALL(架電記録)・NOTE(社内メモ)は顧客に届かない内部記録なので対象外(複数オペの同時記録を妨げない)。
  const isCustomerFacing = data.channel === "EMAIL" || data.channel === "LINE" || data.channel === "SMS";
  if (isCustomerFacing && customer.lockedByUserId && customer.lockedByUserId !== user.id && customer.lockedAt) {
    const isStale = Date.now() - customer.lockedAt.getTime() > 90_000;
    if (!isStale) throw new Error("他のオペレーターが対応中です。ページを再読み込みしてから対応してください。");
  }
  const message = await prisma.message.create({ data: { customerId: data.customerId, senderId: user.id, direction: "OUTBOUND", channel: data.channel, subject: data.subject, body: data.body, status: "PENDING" } });
  try {
    if (data.channel === "EMAIL" && customer.email && process.env.RESEND_API_KEY) {
      let emailBody = data.body;
      if (!customer.lineUserId) {
        const code = String(Math.floor(1000 + Math.random() * 9000));
        await prisma.customer.update({ where: { id: customer.id }, data: { lineCode: code } });
        emailBody += `\n\n---\nLINEでもお気軽にご連絡ください。\n友だち追加: https://line.me/R/ti/p/@331fxngy\n追加後、認証コード「${code}」をLINEで送信してください。`;
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
