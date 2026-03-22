import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const AGENT_MODEL = "gpt-4o-mini";

// Load vacancy texts
const VACANCY_TEXTS: Record<string, string> = {
  A: "⇒現在空室、見学も可能なお部屋です。\n※お申込みは先着順につき、万が一ご紹介中に満室となった場合はご容赦ください\n\n物件のご案内に加えて、ぜひ一度店頭で詳しいお話を伺った上で、この他にもお部屋のご紹介ができればと思います。",
  B: "⇒ご紹介可能なお部屋です。\n現在入居中につき、室内の見学はまだできないお部屋となります。\n街並み・外観・共用部のご案内やエリア情報の紹介、似ている物件のご紹介は可能です。",
  C: "⇒ご紹介可能なお部屋です。\n現在入居中につき、室内の見学はまだできないお部屋となります。\n同じ物件で類似のお部屋が見学可能ですので、そちらのご案内は可能です。",
  D: "⇒ご紹介可能なお部屋です。\n現在は建築中となっており、まだ内見のできないお部屋です。\n完成前に8割〜9割お申込みが入ってしまいます。少しでも前向きにご検討頂けるようでしたらお早めにお声がけくださいませ。",
  E: "⇒ご紹介可能なお部屋です。\n正確な見学可能日時に関しては、確認が必要となりますので、見学希望の場合は希望日程をご連絡くださいませ。",
  F: "⇒あいにく他のお客様よりお申込みが入り、募集終了となりました。\nぜひ一度店頭で詳しいお話を伺った上で、この他にもお部屋のご紹介ができればと思います。",
  G: "⇒ただいま募集状況の確認をしております。\n同じ物件で他のお部屋もございますので、ご案内可能です。",
  H: "⇒ただいま空き状況を確認しております。\n2番手以降のご案内も可能ですので、ご興味ございましたらお早めにご連絡くださいませ。",
};

async function callOpenAI(systemPrompt: string, userMsg: string): Promise<string> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: AGENT_MODEL, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }], max_tokens: 500 }),
  });
  const d = await r.json();
  return d.choices?.[0]?.message?.content || "";
}

// Get DB agent templates
async function getAgentTemplates(orgId: string): Promise<Record<string, string>> {
  try {
    const tpls = await prisma.$queryRawUnsafe(
      `SELECT "key", "body" FROM "AgentTemplate" WHERE "organizationId" = $1`, orgId
    ) as any[];
    const map: Record<string, string> = {};
    tpls.forEach((t: any) => { map[t.key] = t.body; });
    return map;
  } catch { return {}; }
}

// ====== PHASE 2: 1st Mail (PropertyCheckAgent equivalent) ======
async function processNewInquiry(customer: any, org: any) {
  const inquiry = customer.inquiryContent || "";
  const props = await prisma.inquiryProperty.findMany({ where: { customerId: customer.id } });
  const templates = await prisma.template.findMany({ where: { organizationId: org.id } });
  const dbTpls = await getAgentTemplates(org.id);
  
  // Find initial response template
  const tmpl = templates.find((t: any) => t.name.includes("初回"));
  if (!tmpl) { console.log("[Agent] No initial template found"); return; }
  
  // Ask AI for vacancy pattern + comment response
  const systemPrompt = `あなたは不動産賃貸仲介のアシスタントです。顧客の問い合わせ内容から、(1)空室パターン(A-H, 不明ならE)と、(2)質問への回答を判断してください。
回答はJSON形式で: {"vacancy":"E","comment":"回答文 or 空文字"}
ペットの質問には必ず以下を使うこと: 「ペット飼育の相談可否については物件や飼育内容によって都度確認となりますので、以下ご教示いただくこと可能でしょうか?\\n・飼育されているペットの種別:\\n・飼育されているペットの頭数:\\n・お引越し時期:」
初期費用の質問には: 「初期費用につきましては、入居時期やお申込み内容によって変動いたしますので、概算のご案内も含めて一度ご来店ください。」
質問がなければcommentは空文字にすること。`;
  
  const aiResponse = await callOpenAI(systemPrompt, `顧客名: ${customer.name}\n問い合わせ内容: ${inquiry}\n物件: ${props[0]?.name || "不明"}`);
  
  let vacancy = "E", comment = "";
  try {
    const parsed = JSON.parse(aiResponse.replace(/```json|```/g, "").trim());
    vacancy = parsed.vacancy || "E";
    comment = parsed.comment || "";
  } catch { console.log("[Agent] AI parse error, using defaults"); }
  
  // Pet template fallback from DB
  if (dbTpls["tpl_pet"] && ["ペット","犬","猫","動物"].some(w => inquiry.includes(w))) {
    if (!comment || !comment.includes("ペット")) comment = comment ? comment + "\n\n" + dbTpls["tpl_pet"] : dbTpls["tpl_pet"];
  }
  
  // Build email from template
  const assignee = customer.assigneeId ? await prisma.user.findUnique({ where: { id: customer.assigneeId } }) : null;
  const staffName = assignee?.name || "本田みなみ";
  const storeName = org.storeName || org.name || "";
  const vacancyText = VACANCY_TEXTS[vacancy] || VACANCY_TEXTS["E"];
  
  let body = tmpl.body
    .replace(/\{\{customer_name\}\}/g, customer.name || "")
    .replace(/\{\{store_name\}\}/g, storeName)
    .replace(/\{\{staff_name\}\}/g, staffName)
    .replace(/\{\{store_phone\}\}/g, org.storePhone || "")
    .replace(/\{\{store_address\}\}/g, org.storeAddress || "")
    .replace(/\{\{line_url\}\}/g, org.lineUrl || "")
    .replace(/\{\{property_name\}\}/g, props[0]?.name || "")
    .replace(/\{\{property_url\}\}/g, props[0]?.url || (props[0] as any)?.portalUrl || "")
    .replace(/\{\{visit_url\}\}/g, `https://tama-fudosan-crm-2026.vercel.app/visit/${org.id}?c=${customer.id}`);
  
  // Insert vacancy + comment
  const marker = "■ お問い合わせいただいた物件";
  const markerPos = body.indexOf(marker);
  if (markerPos >= 0) {
    const insertPos = body.indexOf("\n\n\n", markerPos);
    if (insertPos >= 0) {
      const block = "\n\n" + vacancyText + (comment ? "\n\n" + comment : "");
      body = body.slice(0, insertPos) + block + body.slice(insertPos);
    }
  }
  
  // Send email via internal send-message logic
  const subject = (tmpl.subject || "お問い合わせありがとうございます").replace(/\{\{customer_name\}\}/g, customer.name || "").replace(/\{\{store_name\}\}/g, storeName);
  
  // Import Resend dynamically
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  // textToHtml conversion
  let html = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/\[\u25A0\s*(.+?)\]\s*(https?:\/\/\S+)/g, (_m: string, label: string, url: string) => {
    const bg = url.includes("line.me") ? "#06C755" : "#0891b2";
    return `<a href="${url}" style="display:inline-block;padding:12px 28px;background:${bg};color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;">${label}</a>`;
  });
  html = html.replace(/(https?:\/\/\S+)/g, (url: string) => url.includes('"') ? url : `<a href="${url}">${url}</a>`);
  html = html.replace(/\n/g, "<br>");
  
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com";
  await resend.emails.send({ from: `${storeName} <${fromEmail}>`, to: [customer.email], subject, html });
  
  // Save message
  await prisma.message.create({
    data: { customerId: customer.id, direction: "OUTBOUND", channel: "EMAIL", subject, body, status: "SENT", senderId: assignee?.id || null },
  });
  
  // Update memo
  await prisma.customer.update({
    where: { id: customer.id },
    data: { memo: (customer.memo || "").replace("[AGENT_PENDING]", "[AGENT_DONE]"), isNeedAction: false },
  });
  
  console.log(`[Agent] 1st mail sent to ${customer.name} (vacancy: ${vacancy})`);
}

// ====== PHASE 3: ClassifyAgent equivalent ======
async function classifyReply(customer: any, org: any, replyBody: string) {
  const systemPrompt = `あなたは不動産賃貸仲介の顧客分類AIです。顧客の返信を分析してA/B/C層に分類してください。
A層: 来店・見学意欲が高い（「見学したい」「内見したい」「行きたい」等）
B層: 興味あるが迷い中（質問、検討、費用確認等）
C層: 反応薄い（「了解」のみ、消極的な返答等）
迷ったらBにすること。
JSONで回答: {"classification":"A","reason":"理由"}`;

  const aiResponse = await callOpenAI(systemPrompt, `顧客名: ${customer.name}\n返信: ${replyBody}`);
  let classification = "B", reason = "";
  try {
    const parsed = JSON.parse(aiResponse.replace(/```json|```/g, "").trim());
    classification = parsed.classification || "B";
    reason = parsed.reason || "";
  } catch { classification = "B"; }

  const assignee = customer.assigneeId ? await prisma.user.findUnique({ where: { id: customer.assigneeId } }) : null;
  const staffName = assignee?.name || "本田みなみ";
  const storeName = org.storeName || org.name || "";
  const dbTpls = await getAgentTemplates(org.id);

  if (classification === "A") {
    // A層: 【未確定】テンプレートで返信（担当者通知なし）
    const tentBody = dbTpls["tpl_tent_c"] || `${customer.name}様\n\nご連絡ありがとうございます。\n\n※現時点でご予約は確定しておりませんので、ご注意ください\n\n当日は店頭で詳しいお話を伺い、物件をご案内できればと思います。\n【お電話番号】を頂くこと可能でしょうか？`;
    const resolvedBody = tentBody.replace(/\{\{customer_name\}\}/g, customer.name || "").replace(/\{visit_proposal\}/g, "次の週末").replace(/\{store_access\}/g, storeName);
    
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com";
    let html = resolvedBody.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");
    await resend.emails.send({ from: `${storeName} <${fromEmail}>`, to: [customer.email], subject: `【ご来店のご案内】${customer.name}様`, html });
    await prisma.message.create({ data: { customerId: customer.id, direction: "OUTBOUND", channel: "EMAIL", subject: `【ご来店のご案内】${customer.name}様`, body: resolvedBody, status: "SENT" } });
    console.log(`[Agent] A層: 【未確定】sent to ${customer.name}`);
    
  } else if (classification === "B") {
    // B層: ソムリエ提案メール
    const bBody = `${customer.name}様\n\nご返信いただきありがとうございます。\n${storeName}の${staffName}です。\n\nお問い合わせいただいた物件に加えて、お客様のご条件に合いそうなお部屋をいくつかピックアップしております。\n\nネット非掲載の物件も含め、ぜひ一度ご来店いただければ、より詳しいご案内が可能です。`;
    
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com";
    let html = bBody.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");
    await resend.emails.send({ from: `${storeName} <${fromEmail}>`, to: [customer.email], subject: `【物件のご提案】${customer.name}様へ`, html });
    await prisma.message.create({ data: { customerId: customer.id, direction: "OUTBOUND", channel: "EMAIL", subject: `【物件のご提案】${customer.name}様へ`, body: bBody, status: "SENT" } });
    console.log(`[Agent] B層: ソムリエ提案 sent to ${customer.name}`);
    
  } else {
    // C層: 追客対象マーク（FollowUpはワークフローで処理）
    console.log(`[Agent] C層: ${customer.name} marked for follow-up`);
  }

  // Update memo
  await prisma.customer.update({
    where: { id: customer.id },
    data: { memo: (customer.memo || "").replace("[CLASSIFY_PENDING]", `[AI分類:${classification}層] ${reason}`) },
  });
}

// ====== Main Cron Handler ======
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await prisma.organization.findFirst();
  if (!org) return NextResponse.json({ error: "No org" }, { status: 400 });

  let processed = 0;

  // 1. Process new inquiries (AGENT_PENDING)
  const pending = await prisma.customer.findMany({
    where: { memo: { contains: "[AGENT_PENDING]" } },
    take: 5,
    orderBy: { createdAt: "asc" },
  });
  for (const c of pending) {
    if (!c.email) continue;
    try { await processNewInquiry(c, org); processed++; }
    catch (e: any) { console.error(`[Agent] Error 1st mail ${c.name}:`, e.message); }
  }

  // 2. Process replies needing classification (CLASSIFY_PENDING)
  const classifyPending = await prisma.customer.findMany({
    where: { memo: { contains: "[CLASSIFY_PENDING]" } },
    take: 5,
    orderBy: { updatedAt: "asc" },
  });
  for (const c of classifyPending) {
    if (!c.email && !c.lineUserId) continue;
    const lastMsg = await prisma.message.findFirst({
      where: { customerId: c.id, direction: "INBOUND" },
      orderBy: { createdAt: "desc" },
    });
    if (!lastMsg?.body) continue;
    try { await classifyReply(c, org, lastMsg.body); processed++; }
    catch (e: any) { console.error(`[Agent] Error classify ${c.name}:`, e.message); }
  }

  return NextResponse.json({ success: true, processed, pending: pending.length, classify: classifyPending.length });
}
