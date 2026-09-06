import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Resend } from "resend";
import { sendSms } from "@/lib/channels/sms";
import { getAuthUserForAction, canAccessOrg, type AuthUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { resolveTemplateVars, buildVisitUrl } from "@/lib/template-vars";
import { hasValidSharedSecret } from "@/lib/shared-secret";

const resend = new Resend(process.env.RESEND_API_KEY);

const CALL_RESULT_LABELS: Record<string, string> = {
  success: "\u6210\u529F\uFF08\u901A\u8A71\u3042\u308A\uFF09",
  noanswer: "\u4E0D\u5728",
  busy: "\u8A71\u3057\u4E2D",
};

// implementation-spec-v1.md §1.3: 変数置換は lib/template-vars.ts に集約
function resolveVars(text: string, customer: any, org: any, staffName: string) {
  return resolveTemplateVars(text, { customer, org, staffName });
}

function textToHtml(text: string): string {
  // Process line by line to distinguish standalone CTA buttons from inline links
  const lines = text.split("\n");
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // Escape HTML
    line = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Check if line is standalone [■ text] URL (= CTA button)
    const standaloneMatch = line.match(/^\[■\s*(.+?)\]\s*(https?:\/\/\S+)$/);
    if (standaloneMatch) {
      const label = standaloneMatch[1];
      const url = standaloneMatch[2];
      const bg = url.includes("line.me") ? "#06C755" : "#0891b2";
      resultLines.push(`<a href="${url}" style="display:inline-block;padding:12px 28px;background:${bg};color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;margin:4px 0;">${label}</a>`);
      continue;
    }

    // Inline [■ text] URL within text → text link (not button)
    line = line.replace(/\[\u25A0\s*(.+?)\]\s*(https?:\/\/\S+)/g, (_m: string, label: string, url: string) =>
      `<a href="${url}" style="color:#0891b2;text-decoration:underline;">${label}</a>`);

    // Markdown-style text links: [text](url)
    line = line.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_m: string, label: string, url: string) =>
      `<a href="${url}" style="color:#0891b2;text-decoration:underline;">${label}</a>`);

    // ▼ label + URL on next line
    if (line.match(/\u25BC\s*.+/) && i + 1 < lines.length) {
      const nextLine = lines[i + 1]?.trim();
      if (nextLine && /^https?:\/\//.test(nextLine)) {
        const label = line.replace(/^\u25BC\s*/, "");
        const escapedNext = nextLine.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        resultLines.push(`<strong>${label}</strong><br><a href="${escapedNext}" style="color:#0891b2;">${escapedNext}</a>`);
        i++; // skip next line (URL consumed)
        continue;
      }
    }

    // Bare URLs (not already in <a>)
    line = line.replace(/(https?:\/\/\S+)/g, (url: string) => {
      if (url.includes('"') || url.includes("&lt;")) return url;
      return `<a href="${url}" style="color:#0891b2;">${url}</a>`;
    });

    resultLines.push(line);
  }

  return resultLines.join("<br>");
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
    // implementation-spec-v1.md §3: 秘密鍵の比較は lib/shared-secret.ts に統一（timingSafeEqual・fail-closed）
    const isAgent = hasValidSharedSecret(request);

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
    }
    let authUser: AuthUser | null = null;
    if (!isAgent) {
      authUser = await getAuthUserForAction();
      if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      dbUser = { id: authUser.id, name: authUser.name, organizationId: authUser.organizationId };
    }

    // architecture-v2.md §10 A-6: 宛先(to/phone/lineUserId)をリクエスト本文から受けると、
    // 会社名義で任意のアドレスへ送れてしまう(乗っ取り・退職者アカウント経由のスパム/フィッシング)。
    // 宛先は必ず顧客レコードから導出する。
    const { customerId, channel, subject, body, callResult } = await request.json();
    if (!customerId || !body) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { assignee: true, properties: true },
    });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    // architecture-v2.md §10 S-1: 人間の送信は所属組織(または staff の横断アクセス)を必ず確認する
    if (authUser && !canAccessOrg(authUser, customer.organizationId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const to = customer.email;
    const lineUserId = customer.lineUserId;
    const phone = customer.phone;
    // architecture-v2.md §9(穴#16): 二重対応防止。customer-detail.tsx/customer-detail-panel.tsx
    // どちらの送信経路も通るよう、ここでロックを判定する(actions/send-message.tsのsendMessageとは別実装のため個別に必要)。
    // CALL(架電記録)・NOTE(社内メモ)は顧客に届かない内部記録なので対象外。
    const isCustomerFacingChannel = channel === "EMAIL" || channel === "LINE" || channel === "SMS";
    if (isCustomerFacingChannel && customer?.lockedByUserId && customer.lockedByUserId !== dbUser.id && customer.lockedAt) {
      const isStale = Date.now() - customer.lockedAt.getTime() > 90_000;
      if (!isStale) return NextResponse.json({ error: "他のオペレーターが対応中です。ページを再読み込みしてから対応してください。" }, { status: 409 });
    }
    // 文面の会社名・店舗情報は「送信者の所属」ではなく「顧客の所属会社」のもの(staffが他社顧客へ送る場合に混線しない)
    const org = await prisma.organization.findUnique({ where: { id: customer.organizationId } });

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
        buildVisitUrl(org?.id || customer.organizationId, customerId),
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
      await logAudit({ customerId, userId: isAgent ? undefined : dbUser.id, action: "message.send", field: "EMAIL", newValue: finalSubject || "" });
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

    await logAudit({ customerId, userId: isAgent ? undefined : dbUser.id, action: "message.send", field: channel, newValue: finalSubject || finalBody.slice(0, 80) });
    return NextResponse.json(message, { status: 201 });
  } catch (e) {
    console.error("[POST /api/send-message]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
