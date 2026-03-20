import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { sendSms } from "@/lib/channels/sms";

const resend = new Resend(process.env.RESEND_API_KEY);

const CALL_RESULT_LABELS: Record<string, string> = {
  success: "\u6210\u529F\uFF08\u901A\u8A71\u3042\u308A\uFF09",
  noanswer: "\u4E0D\u5728",
  busy: "\u8A71\u3057\u4E2D",
};

function resolveVars(text: string, customer: any, org: any, staffName: string) {
  const visitUrl = `https://tama-fudosan-crm-2026.vercel.app/visit/${org?.id || "org_default"}?c=${customer.id || ""}`;
  return text
    .replace(/\{\{customer_name\}\}/g, customer.name || "")
    .replace(/\{\{customer_email\}\}/g, customer.email || "")
    .replace(/\{\{customer_phone\}\}/g, customer.phone || "")
    .replace(/\{\{staff_name\}\}/g, staffName || "")
    .replace(/\{\{property_name\}\}/g, customer.properties?.[0]?.name || "")
    .replace(/\{\{property_url\}\}/g, customer.properties?.[0]?.portalUrl || customer.properties?.[0]?.url || "")
    .replace(/\{\{company_name\}\}/g, org?.name || "")
    .replace(/\{\{store_name\}\}/g, org?.storeName || org?.name || "")
    .replace(/\{\{store_address\}\}/g, org?.storeAddress || org?.address || "")
    .replace(/\{\{store_phone\}\}/g, org?.storePhone || org?.phone || "")
    .replace(/\{\{store_hours\}\}/g, org?.storeHours || "")
    .replace(/\{\{line_url\}\}/g, org?.lineUrl || "")
    .replace(/\{\{license_number\}\}/g, org?.licenseNumber || "")
    .replace(/\{\{visit_url\}\}/g, visitUrl);
}

function textToHtml(text: string): string {
  let h = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  h = h.replace(/\[\u25A0\s*(.+?)\]\s*(https?:\/\/\S+)/g, (_m: string, label: string, url: string) => {
    const bg = url.includes("line.me") ? "#06C755" : "#0891b2";
    return `<a href="${url}" style="display:inline-block;padding:12px 28px;background:${bg};color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;margin:4px 0;">${label}</a>`;
  });
  h = h.replace(/\u25BC\s*(.+?)\n\s*(https?:\/\/\S+)/g, (_m: string, label: string, url: string) =>
    `<strong>${label}</strong><br><a href="${url}" style="color:#0891b2;">${url}</a>`);
  h = h.replace(/(https?:\/\/\S+)/g, (url: string) => {
    if (url.includes('"')) return url;
    return `<a href="${url}" style="color:#0891b2;">${url}</a>`;
  });
  h = h.replace(/\n/g, "<br>");
  return h;
}

function makeVisitFooter(visitUrl: string, storeName: string, storePhone: string, storeAddress: string): string {
  return `<br><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
<div style="text-align:center;margin:20px 0;">
  <p style="font-size:14px;color:#374151;margin-bottom:16px;">お部屋探しのご相談・内見のご予約はこちらから</p>
  <a href="${visitUrl}" style="display:inline-block;padding:14px 36px;background:#d4a017;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">来店予約はこちら</a>
</div>
<div style="text-align:center;margin-top:20px;font-size:12px;color:#9ca3af;">
  <p>${storeName || ""}</p>
  <p>${storeAddress || ""}</p>
  <p>${storePhone ? "TEL: " + storePhone : ""}</p>
</div>`;
}

function addTrackingPixel(html: string, msgId: string): string {
  return html + `<img src="https://tama-fudosan-crm-2026.vercel.app/api/track/open/${msgId}" width="1" height="1" style="display:none" alt="" />`;
}

export async function POST(request: NextRequest) {
  try {
    const agentSecret = request.headers.get("x-agent-secret");
    let user: any = null;
    let isAgent = false;
    if (agentSecret === process.env.CRON_SECRET) {
      user = { id: "agent", email: "agent@system" };
      isAgent = true;
    } else {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data?.user;
    }
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let dbUser: any;
    if (isAgent) {
      // For agent: get customer first, then use assignee or first org user
      const { customerId: agentCustId } = await request.clone().json();
      const agentCustomer = await prisma.customer.findUnique({
        where: { id: agentCustId },
        include: { assignee: true },
      });
      if (agentCustomer?.assignee) {
        dbUser = agentCustomer.assignee;
      } else {
        // fallback: first user in the organization
        dbUser = await prisma.user.findFirst({ where: { organizationId: agentCustomer?.organizationId || undefined } });
      }
      if (!dbUser) return NextResponse.json({ error: "No staff found for agent" }, { status: 404 });
    } else {
      dbUser = await prisma.user.findUnique({ where: { email: user.email! }, select: { id: true, name: true, organizationId: true } });
      if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { customerId, channel, subject, body, to, lineUserId, phone, callResult } = await request.json();
    if (!customerId || !body) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { assignee: true, properties: true },
    });
    const org = await prisma.organization.findFirst({ where: { id: dbUser.organizationId! } });

    let finalBody = resolveVars(body, customer || {}, org, dbUser.name || "");
    let finalSubject = subject ? resolveVars(subject, customer || {}, org, dbUser.name || "") : null;

    let externalId: string | undefined;
    let messageStatus = "SENT";

    if (channel === "EMAIL") {
      if (!to) return NextResponse.json({ error: "Missing email" }, { status: 400 });
      const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com";
      const fromName = org?.storeName || org?.name || "Claude Cloud CRM";
      // Create message first to get ID for tracking pixel
      const preMsg = await prisma.message.create({
        data: { customerId, senderId: dbUser.id, direction: "OUTBOUND", channel: "EMAIL", subject: finalSubject, body: finalBody, status: "PENDING" as any },
      });
      const baseHtml = textToHtml(finalBody) + makeVisitFooter(
        `https://tama-fudosan-crm-2026.vercel.app/visit/${org?.id || "org_default"}?c=${customerId}`,
        org?.storeName || org?.name || "",
        org?.storePhone || org?.phone || "",
        org?.storeAddress || org?.address || ""
      );
      const htmlWithPixel = addTrackingPixel(baseHtml, preMsg.id);
      const result = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject: finalSubject || "\uFF08\u4EF6\u540D\u306A\u3057\uFF09",
        html: htmlWithPixel,
        replyTo: `reply-${customerId}@moutrenoi.resend.app`,
      });
      if (result.error) {
        await prisma.message.update({ where: { id: preMsg.id }, data: { status: "FAILED" } });
        console.error("[send-message] Resend error:", result.error);
      } else {
        await prisma.message.update({ where: { id: preMsg.id }, data: { status: "SENT", externalId: result.data?.id || null } });
      }
      // Update customer and return (skip generic message creation below)
      await prisma.customer.update({ where: { id: customerId }, data: { isNeedAction: false, lastContactAt: new Date() } });
      return NextResponse.json(preMsg, { status: 201 });
    } else if (channel === "LINE") {
      if (!lineUserId) return NextResponse.json({ error: "Missing lineUserId" }, { status: 400 });
      const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!accessToken) return NextResponse.json({ error: "LINE not configured" }, { status: 500 });
      const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text: finalBody }] }),
      });
      if (!lineRes.ok) {
        const errData = await lineRes.json().catch(() => ({}));
        console.error("[send-message] LINE error:", errData);
        messageStatus = "FAILED";
      }
    } else if (channel === "SMS") {
      if (!phone) return NextResponse.json({ error: "Missing phone" }, { status: 400 });
      try {
        const smsResult = await sendSms(phone, finalBody);
        externalId = smsResult.sid;
        messageStatus = "SENT";
      } catch (smsErr: any) {
        console.error("[send-message] SMS error:", smsErr);
        messageStatus = "FAILED";
      }
    } else if (channel === "CALL") {
      const resultLabel = CALL_RESULT_LABELS[callResult] || callResult || "\u4E0D\u660E";
      finalSubject = `\u67B6\u96FB\u8A18\u9332\uFF08${resultLabel}\uFF09`;
      finalBody = `\u3010\u7D50\u679C\u3011${resultLabel}\n${finalBody}`;
    } else if (channel === "NOTE") {
      finalSubject = "\u30E1\u30E2";
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

    if (channel === "EMAIL" || channel === "LINE" || channel === "SMS") {
      await prisma.customer.update({ where: { id: customerId }, data: { isNeedAction: false, lastContactAt: new Date() } });
    }
    if (channel === "CALL" && callResult === "success") {
      await prisma.customer.update({ where: { id: customerId }, data: { isNeedAction: false, lastContactAt: new Date() } });
    }

    return NextResponse.json(message, { status: 201 });
  } catch (e) {
    console.error("[POST /api/send-message]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
