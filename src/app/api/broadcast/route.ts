import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function textToHtml(text: string): string {
  let h = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  h = h.replace(/\[\u25A0\s*(.+?)\]\s*(https?:\/\/\S+)/g, (_m: string, label: string, url: string) =>
    `<a href="${url}" style="display:inline-block;padding:12px 28px;background:#0891b2;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;margin:4px 0;">${label}</a>`);
  h = h.replace(/\u25BC\s*(.+?)\n\s*(https?:\/\/\S+)/g, (_m: string, label: string, url: string) =>
    `<strong>${label}</strong><br><a href="${url}" style="color:#0891b2;">${url}</a>`);
  h = h.replace(/(https?:\/\/\S+)/g, (url: string) => {
    if (url.includes('"')) return url;
    return `<a href="${url}" style="color:#0891b2;">${url}</a>`;
  });
  h = h.replace(/\n/g, "<br>");
  return h;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const dbUser = await prisma.user.findUnique({ where: { email: user.email! }, select: { id: true, name: true, organizationId: true } });
    if (!dbUser?.organizationId) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { customerIds, channel, subject, body } = await request.json();
    if (!customerIds?.length || !body) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    const org = await prisma.organization.findFirst({ where: { id: dbUser.organizationId } });
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds }, organizationId: dbUser.organizationId },
      select: { id: true, name: true, email: true, lineUserId: true },
    });
    const results: { customerId: string; success: boolean; error?: string }[] = [];
    for (const c of customers) {
      try {
        if (channel === "EMAIL") {
          if (!c.email) { results.push({ customerId: c.id, success: false, error: "No email" }); continue; }
          const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com";
          const fromName = org?.storeName || org?.name || "Claude Cloud CRM";
          const sent = await resend.emails.send({ from: `${fromName} <${fromEmail}>`, to: [c.email], subject: subject || "No Subject", html: textToHtml(body) });
          await prisma.message.create({ data: { customerId: c.id, direction: "OUTBOUND", channel: "EMAIL", subject, body, status: "SENT", externalId: (sent as any)?.data?.id || null } });
          await prisma.customer.update({ where: { id: c.id }, data: { isNeedAction: false, lastContactAt: new Date() } });
          results.push({ customerId: c.id, success: true });
        } else if (channel === "LINE") {
          if (!c.lineUserId) { results.push({ customerId: c.id, success: false, error: "No LINE" }); continue; }
          const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
          if (!token) { results.push({ customerId: c.id, success: false, error: "No LINE token" }); continue; }
          await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ to: c.lineUserId, messages: [{ type: "text", text: body }] }),
          });
          await prisma.message.create({ data: { customerId: c.id, direction: "OUTBOUND", channel: "LINE", body, status: "SENT" } });
          await prisma.customer.update({ where: { id: c.id }, data: { isNeedAction: false, lastContactAt: new Date() } });
          results.push({ customerId: c.id, success: true });
        }
      } catch (e: any) {
        results.push({ customerId: c.id, success: false, error: e.message });
      }
    }
    const successCount = results.filter(r => r.success).length;
    return NextResponse.json({ sent: successCount, failed: results.length - successCount, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
