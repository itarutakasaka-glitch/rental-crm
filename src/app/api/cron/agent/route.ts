import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const AGENT_MODEL = "gpt-4o-mini";

// Load vacancy texts (反響研究所8パターン - agent_flow.html準拠)
const VACANCY_TEXTS: Record<string, string> = {
  A: "⇒現在空室、見学も可能なお部屋です。\n※お申込みは先着順につき、万が一ご紹介中に満室となった場合はご容赦ください\n\n物件のご案内に加えて、ぜひ一度店頭で詳しいお話を伺った上で、この他にもお部屋のご紹介ができればと思います。\n\n{VISIT}はご都合いかがでしょうか？",
  B: "⇒ご紹介可能なお部屋です。\n現在入居中につき、室内の見学はまだできないお部屋となります。\n街並み・外観・共用部のご案内やエリア情報の紹介、似ている物件のご紹介は可能です。\n\n{VISIT}はご都合いかがでしょうか？",
  C: "⇒ご紹介可能なお部屋です。\n現在入居中につき、室内の見学はまだできないお部屋となります。\n同じ物件で類似のお部屋が見学可能ですので、そちらのご案内は可能です。\n\n{VISIT}はご都合いかがでしょうか？",
  D: "⇒ご紹介可能なお部屋です。\n現在は建築中となっており、まだ内見のできないお部屋です。\n完成前に8割〜9割お申込みが入ってしまいます。少しでも前向きにご検討頂けるようでしたらお早めにお声がけくださいませ。\n\n{VISIT}はご都合いかがでしょうか？",
  E: "⇒ご紹介可能なお部屋です。\n正確な見学可能日時に関しては、確認が必要となりますので、見学希望の場合は希望日程をご連絡くださいませ。\n\n{VISIT}はご都合いかがでしょうか？",
  F: "⇒あいにく他のお客様よりお申込みが入り、募集終了となりました。\nぜひ一度店頭で詳しいお話を伺った上で、この他にもお部屋のご紹介ができればと思います。\n\nお引越し時期はいつ頃を予定されていますか？",
  G: "⇒ただいま募集状況の確認をしております。\n同じ物件で他のお部屋もございますので、ご案内可能です。\n\nお引越し時期はいつ頃を予定されていますか？",
  H: "⇒ただいま空き状況を確認しております。\n2番手以降のご案内も可能ですので、ご興味ございましたらお早めにご連絡くださいませ。\n\nお引越し時期はいつ頃を予定されていますか？",
};

// ====== URL-based vacancy detection (Phase 2 Step 2: Browserless) ======
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_API_TOKEN || "";

async function scrapeVacancyFromUrl(portalUrl: string): Promise<{ pattern: string; source: string; detail: string }> {
  if (!portalUrl) return { pattern: "E", source: "no_url", detail: "URLなし" };
  if (!BROWSERLESS_TOKEN) return { pattern: "E", source: "no_token", detail: "BROWSERLESS_API_TOKEN未設定" };
  try {
    const scrapeRes = await fetch(`https://production-sfo.browserless.io/scrape?token=${BROWSERLESS_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: portalUrl, waitForSelector: { selector: "body", timeout: 8000 }, elements: [{ selector: "body" }] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!scrapeRes.ok) {
      const errText = await scrapeRes.text().catch(() => "");
      return { pattern: "E", source: "browserless_err", detail: `HTTP ${scrapeRes.status}: ${errText.slice(0, 60)}` };
    }
    const scrapeData = await scrapeRes.json();
    const bodyText = scrapeData?.data?.[0]?.results?.[0]?.text || "";
    const text = bodyText.replace(/\s+/g, " ").slice(0, 15000);
    if (!text || text.length < 100) return { pattern: "E", source: "empty_page", detail: "ページ内容が空" };

    if (portalUrl.includes("suumo.jp")) {
      if (/この物件は掛載終了|掲載期間が終了|取り扱い終了/.test(text)) return { pattern: "F", source: "suumo", detail: "SUUMO掛載終了" };
      const nyukyoMatch = text.match(/入居\s+(.+?)(?:\s+取引態様|\s+条件|\s+取り扱い)/);
      if (nyukyoMatch) {
        const nyukyoVal = nyukyoMatch[1].trim();
        if (/即入居可|即可|即日/.test(nyukyoVal)) return { pattern: "A", source: "suumo_nyukyo", detail: `入居: ${nyukyoVal} (即入居可)` };
        if (/^相談$/.test(nyukyoVal)) return { pattern: "E", source: "suumo_nyukyo", detail: `入居: ${nyukyoVal} (要相談)` };
        if (/\d{2}年\d{1,2}月|\d{1,2}月[上中下]旬|\d{1,2}月末|\d{4}\/\d{2}|\d{4}年\d{1,2}月/.test(nyukyoVal) || /^\d{1,2}月/.test(nyukyoVal)) {
          const chikuNesuMatch = text.match(/築年数\s+(\S+)/);
          const chikuNesu = chikuNesuMatch ? chikuNesuMatch[1] : "";
          if (/新築/.test(chikuNesu)) return { pattern: "D", source: "suumo_shinchiku", detail: `入居: ${nyukyoVal} / 築年数: ${chikuNesu} (新築=建築中)` };
          const chikuMatch = text.match(/築年月\s+(\d{4})年(\d{1,2})月/);
          if (chikuMatch) {
            const chikuYM = parseInt(chikuMatch[1]) * 100 + parseInt(chikuMatch[2]);
            const nowYM = new Date().getFullYear() * 100 + (new Date().getMonth() + 1);
            if (chikuYM > nowYM) return { pattern: "D", source: "suumo_chiku_future", detail: `入居: ${nyukyoVal} / 築年月: ${chikuMatch[1]}年${chikuMatch[2]}月 (築年月が未来)` };
          }
          if (/建築中|完成予定|未完成/.test(text)) return { pattern: "D", source: "suumo_keyword", detail: `入居: ${nyukyoVal} (建築中キーワード検出)` };
          return { pattern: "B", source: "suumo_nyukyo", detail: `入居: ${nyukyoVal} / 築年数: ${chikuNesu || "?"} (入居中)` };
        }
        if (/^[-—―─]$/.test(nyukyoVal)) return { pattern: "E", source: "suumo_nyukyo", detail: `入居: - (情報なし)` };
      }
    }
    if (portalUrl.includes("apamanshop.com")) {
      if (/この物件は終了|募集終了|お取り扱いできません/.test(text)) return { pattern: "F", source: "apaman", detail: "APAMAN募集終了" };
    }
    if (portalUrl.includes("homes.co.jp")) {
      if (/この物件は現在掲載されていません|掲載終了|取り扱い終了/.test(text)) return { pattern: "F", source: "homes", detail: "HOME'S掲載終了" };
    }
    if (/募集終了|成約済|満室|取扱終了|掲載が終了/.test(text)) return { pattern: "F", source: "keyword", detail: "募集終了キーワード検出" };
    if (/建築中|完成予定|新築未完成/.test(text)) return { pattern: "D", source: "keyword", detail: "建築中キーワード検出" };
    if (/即入居可|空室|入居可能|見学可/.test(text)) return { pattern: "A", source: "keyword", detail: "空室・即入居可キーワード検出" };
    if (/入居中|現入居|退去予定/.test(text)) return { pattern: "B", source: "keyword", detail: "入居中キーワード検出" };
    if (text.length > 500) return { pattern: "E", source: "page_exists", detail: "ページ存在、確認必要" };
    return { pattern: "E", source: "unknown", detail: "判定不能" };
  } catch (e: any) {
    if (e.name === "AbortError") return { pattern: "E", source: "timeout", detail: "タイムアウト" };
    return { pattern: "E", source: "error", detail: e.message?.slice(0, 50) || "エラー" };
  }
}

function generateVisitProposal(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const slots: string[] = [];
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  for (let d = 1; d <= 14 && slots.length < 3; d++) {
    const date = new Date(jst.getTime() + d * 24 * 60 * 60 * 1000);
    const dow = date.getDay();
    if (dow === 2 || dow === 3) continue;
    const m = date.getMonth() + 1;
    const day = date.getDate();
    const dayName = dayNames[dow];
    if (dow === 0 || dow === 6) { slots.push(`${m}/${day}(${dayName})10:00～`); }
    else { slots.push(`${m}/${day}(${dayName})13:00～`); }
  }
  return slots.join("、");
}

async function callOpenAI(systemPrompt: string, userMsg: string): Promise<string> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: AGENT_MODEL, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }], max_tokens: 500 }),
  });
  const d = await r.json();
  return d.choices?.[0]?.message?.content || "";
}

async function getAgentTemplates(orgId: string): Promise<Record<string, string>> {
  try {
    const tpls = await prisma.$queryRawUnsafe(`SELECT "key", "body" FROM "AgentTemplate" WHERE "organizationId" = $1`, orgId) as any[];
    const map: Record<string, string> = {};
    tpls.forEach((t: any) => { map[t.key] = t.body; });
    return map;
  } catch { return {}; }
}

// ====== 質問回答ロジック (QUALITY 02) ======
const QA_CATEGORY_MAP: Record<string, string[]> = {
  pet: ["ペットについて", "ペットNG", "大東建託のペット"],
  initial_cost: ["初期費用の内訳", "家賃交渉、初期費用減額できますかの対応", "初期費用計算のための時期確認"],
  move_in_date: ["相談の入居時期", "入居日について交渉・相談（退去予定）", "即入居の入居時期", "入居日について交渉・相談（即）"],
  equipment: ["設備に関する質問", "エアコンなど設備についての質問"],
  internet: ["インターネット、光回線工事してもいい？", "インターネット・WiFI（4択）"],
  parking: ["駐車場について"],
  screening: ["入居審査について", "保証人は必須？", "審査次第で入居の相談可能"],
  contract: ["契約の流れ", "契約の流れ（キャンセルできる？）", "申込/契約はオンラインでできる？", "来店せずに申込したい"],
  rent: ["賃料について（告知事項なし）", "月のお支払いの内訳"],
  noise: ["騒音について"],
  instrument: ["楽器の使用可否", "楽器の演奏の相談"],
  two_person: ["二人入居について", "ルームシェアについて"],
  children_elderly: ["お子様・高齢者の入居について"],
  welfare: ["生活保護について", "生活保護NG", "生活保護の内容確認", "生活保護・受給理由が精神系"],
  corporate: ["法人契約について", "社宅契約"],
  student: ["学生の場合", "合格前予約の可否", "学生・合格前予約できる物件ありますか？", "進路決定前の学生への対応"],
  fixed_term: ["定期借家"],
  tentative_hold: ["仮押さえできるの？"],
  photo_viewing: ["写真が欲しい", "オンライン見学の提案"],
};
const QA_EXCLUDE = ["山一", "ﾄﾖｵｶ", "エスエス", "エムズ", "駅前", "アービック", "アパートナー", "ﾍﾔｸﾚｽ【回答】", "36　ﾍﾔｸﾚｽ"];
const QA_LABELS: Record<string, string> = {
  pet: "ペットについて", initial_cost: "初期費用について", move_in_date: "入居時期について",
  equipment: "設備について", internet: "インターネットについて", parking: "駐車場について",
  screening: "入居審査について", contract: "ご契約について", rent: "家賃について",
  noise: "騒音について", instrument: "楽器演奏について", two_person: "入居人数について",
  children_elderly: "入居条件について", welfare: "生活保護について", corporate: "法人契約について",
  student: "学生の方について", fixed_term: "定期借家について", tentative_hold: "仮押さえについて",
  photo_viewing: "内見・写真について", other: "ご質問について",
};

async function generateQuestionAnswers(inquiryContent: string, propertyInfo: string): Promise<{ answerText: string; needsEscalation: boolean }> {
  if (!inquiryContent || inquiryContent.trim().length < 3) return { answerText: "", needsEscalation: false };

  const extractResult = await callOpenAI(
    `あなたは不動産賃貸仲介のAIアシスタントです。顧客のコメントから質問・要望を抽出してカテゴリに分類してください。
カテゴリ: pet/initial_cost/move_in_date/equipment/internet/parking/screening/contract/rent/noise/instrument/two_person/children_elderly/welfare/corporate/student/fixed_term/tentative_hold/photo_viewing/other
出力: JSON配列のみ [{"category":"pet","question":"小型犬は飼えますか？"}]
質問が無い場合は [] を返してください。`,
    inquiryContent
  );

  let questions: Array<{ category: string; question: string }> = [];
  try { questions = JSON.parse(extractResult.replace(/```json|```/g, "").trim()); if (!Array.isArray(questions)) questions = []; } catch { questions = []; }
  console.log(`[Agent QA] Extracted ${questions.length} questions:`, questions.map(q => q.category));
  if (questions.length === 0) return { answerText: "", needsEscalation: false };

  let snippets: Array<{ key: string; name: string; text: string }> = [];
  try {
    const res = await fetch("https://tama-fudosan-crm-2026.vercel.app/api/agent/snippets", {
      headers: { "x-agent-secret": process.env.CRM_AGENT_SECRET || "" }
    });
    const data = await res.json();
    snippets = (data.categories?.qa_answer || []).filter((s: any) => !QA_EXCLUDE.some(p => s.name.includes(p)));
  } catch (e) { console.error("[Agent QA] Failed to fetch snippets:", e); }

  const answers: Array<{ category: string; question: string; answer: string }> = [];
  let needsEscalation = false;

  for (const q of questions) {
    const candidateNames = QA_CATEGORY_MAP[q.category] || [];
    const candidates = snippets.filter(s => candidateNames.some(name => s.name === name));

    if (candidates.length === 1) {
      answers.push({ category: q.category, question: q.question, answer: candidates[0].text });
    } else if (candidates.length > 1) {
      const list = candidates.map((c, i) => `${String.fromCharCode(65 + i)}: ${c.name}\n${c.text.slice(0, 200)}`).join("\n\n");
      const choice = await callOpenAI("回答テンプレート選択AI。アルファベット1文字のみ返答。",
        `質問: ${q.question}\n物件: ${propertyInfo}\n候補:\n${list}\n\n選択肢のアルファベット1文字のみで回答。`);
      const idx = choice.trim().charCodeAt(0) - 65;
      const selected = candidates[idx >= 0 && idx < candidates.length ? idx : 0];
      answers.push({ category: q.category, question: q.question, answer: selected.text });
    } else if (q.category === "other" && /交渉|値下げ|クレーム|トラブル|事故/.test(q.question)) {
      needsEscalation = true;
    } else {
      const aiAnswer = await callOpenAI(
        "不動産賃貸仲介の担当者として簡潔に回答。確認必要なら「確認いたします」。嘘禁止。2-3文。敬語。",
        `物件: ${propertyInfo}\n質問: ${q.question}`
      );
      if (aiAnswer) answers.push({ category: q.category, question: q.question, answer: aiAnswer });
    }
  }

  if (answers.length === 0) return { answerText: "", needsEscalation };
  let text = "";
  if (answers.length === 1) {
    text = `\nまた、${answers[0].question}についてですが、\n${answers[0].answer}`;
  } else {
    text = "\nまた、いただいたご質問にお答えいたします。\n";
    for (const a of answers) { text += `\n■ ${QA_LABELS[a.category] || "ご質問について"}\n${a.answer}\n`; }
  }
  return { answerText: text, needsEscalation };
}

// ====== PHASE 2: 1st Mail (PropertyCheckAgent equivalent) ======
async function processNewInquiry(customer: any, org: any) {
  const inquiry = customer.inquiryContent || "";
  const props = await prisma.inquiryProperty.findMany({ where: { customerId: customer.id } });
  const templates = await prisma.template.findMany({ where: { organizationId: org.id } });
  const dbTpls = await getAgentTemplates(org.id);

  const agentTpl1st = dbTpls["tpl_1st"];
  const crmTmpl = templates.find((t: any) => t.name.includes("初回"));
  const tmplBody = agentTpl1st || crmTmpl?.body || "";
  const tmplSubject = crmTmpl?.subject || "お問い合わせありがとうございます";
  if (!tmplBody) { console.log("[Agent] No initial template found"); return; }

  const portalUrl = (props[0] as any)?.portalUrl || props[0]?.url || "";
  const scrapeResult = await scrapeVacancyFromUrl(portalUrl);
  console.log(`[Agent] Vacancy scrape: pattern=${scrapeResult.pattern} source=${scrapeResult.source} detail=${scrapeResult.detail}`);

  // === 空室パターン判定（スクレイプ結果優先） ===
  let vacancy = scrapeResult.pattern;
  if (vacancy === "E") {
    const vacancyAI = await callOpenAI(
      "物件の空室パターンをA-Hの1文字で判定。A:空室 B:入居中 C:入居中(他部屋あり) D:建築中 E:要確認 F:募集終了 G:募集終了(他部屋あり) H:予約。わからなければE。アルファベット1文字のみ。",
      `問い合わせ: ${inquiry}\nURL読み取り: ${scrapeResult.detail}`
    );
    const match = vacancyAI.match(/[A-H]/);
    if (match) vacancy = match[0];
  }

  // === 質問回答ロジック（定型文DBマッチング + AI補足） ===
  const propertyInfo = `物件名: ${props[0]?.name || "不明"}\nURL: ${portalUrl}`;
  const qaResult = await generateQuestionAnswers(inquiry, propertyInfo);
  const comment = qaResult.answerText;

  if (qaResult.needsEscalation) {
    console.log("[Agent] Escalation needed for unanswerable questions");
  }

  const assignee = customer.assigneeId ? await prisma.user.findUnique({ where: { id: customer.assigneeId } }) : null;
  const staffName = assignee?.name || "本田みなみ";
  const storeName = org.storeName || org.name || "";
  const vacancyTextRaw = VACANCY_TEXTS[vacancy] || VACANCY_TEXTS["E"];
  const visitProposal = generateVisitProposal();
  const vacancyText = vacancyTextRaw.replace(/\{VISIT\}/g, visitProposal);

  let body = tmplBody
    .replace(/\{\{customer_name\}\}/g, customer.name || "")
    .replace(/\{\{store_name\}\}/g, storeName)
    .replace(/\{\{staff_name\}\}/g, staffName)
    .replace(/\{\{store_phone\}\}/g, org.storePhone || "")
    .replace(/\{\{store_address\}\}/g, org.storeAddress || "")
    .replace(/\{\{line_url\}\}/g, org.lineUrl || "")
    .replace(/\{\{property_name\}\}/g, props[0]?.name || "")
    .replace(/\{\{property_url\}\}/g, props[0]?.url || (props[0] as any)?.portalUrl || "")
    .replace(/\{\{visit_url\}\}/g, `https://tama-fudosan-crm-2026.vercel.app/visit/${org.id}?c=${customer.id}`);

  const marker = "■ お問い合わせいただいた物件";
  const markerPos = body.indexOf(marker);
  if (markerPos >= 0) {
    const insertPos = body.indexOf("\n\n\n", markerPos);
    if (insertPos >= 0) {
      const block = "\n\n" + vacancyText + (comment ? "\n\n" + comment : "");
      body = body.slice(0, insertPos) + block + body.slice(insertPos);
    }
  }

  const subject = (tmplSubject).replace(/\{\{customer_name\}\}/g, customer.name || "").replace(/\{\{store_name\}\}/g, storeName);
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  let html = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const urlPat = "https?:\\/\\/[^\\s」「、。）（〈〉《》【】\u201C\u201D]+";
  const ctaRe = new RegExp(`^(\\[[\u25A0\u25A1]\\s*(.+?)\\])\\s*(${urlPat})\\s*$`, "gm");
  html = html.replace(ctaRe, (_m: string, _full: string, label: string, url: string) => {
    const bg = url.includes("line.me") ? "#06C755" : "#0891b2";
    return `<a href="${url}" style="display:inline-block;padding:12px 28px;background:${bg};color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">${label}</a>`;
  });
  const inlineRe = new RegExp(`\\[[\u25A0\u25A1]\\s*(.+?)\\]\\s*(${urlPat})`, "g");
  html = html.replace(inlineRe, (_m: string, label: string, url: string) => {
    return `<a href="${url}" style="color:#0891b2;text-decoration:underline;font-weight:bold;">${label}</a>`;
  });
  const bareRe = new RegExp(`(${urlPat})`, "g");
  html = html.replace(bareRe, (url: string) => url.includes('"') ? url : `<a href="${url}">${url}</a>`);
  html = html.replace(/\n/g, "<br>");

  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com";
  await resend.emails.send({ from: `${storeName} <${fromEmail}>`, to: [customer.email], subject, html });

  await prisma.message.create({
    data: { customerId: customer.id, direction: "OUTBOUND", channel: "EMAIL", subject, body, status: "SENT", senderId: assignee?.id || null },
  });

  await prisma.customer.update({
    where: { id: customer.id },
    data: { memo: (customer.memo || "").replace("[AGENT_PENDING]", "[AGENT_DONE]"), isNeedAction: qaResult.needsEscalation },
  });

  console.log(`[Agent] 1st mail sent to ${customer.name} (vacancy: ${vacancy}, qa: ${comment ? "yes" : "no"})`);
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
  try { const parsed = JSON.parse(aiResponse.replace(/```json|```/g, "").trim()); classification = parsed.classification || "B"; reason = parsed.reason || ""; } catch { classification = "B"; }

  const assignee = customer.assigneeId ? await prisma.user.findUnique({ where: { id: customer.assigneeId } }) : null;
  const staffName = assignee?.name || "本田みなみ";
  const storeName = org.storeName || org.name || "";
  const storeAccess = [
    "▼お問い合わせ物件の取り扱い店舗",
    org.storeName ? `店舗名：${org.storeName}` : null,
    org.storeAddress ? `住所：${org.storeAddress}` : null,
    (org as any).storeAccess ? `アクセス：${(org as any).storeAccess}` : null,
    org.storePhone ? `TEL：${org.storePhone}` : null,
    (org as any).storeHours ? `営業時間：${(org as any).storeHours}` : null,
    (org as any).storeClosedDays ? `定休日：${(org as any).storeClosedDays}` : null,
  ].filter(Boolean).join("\n");

  const dbTpls = await getAgentTemplates(org.id);
  const useLineChannel = !!customer.lineUserId;

  async function sendReply(body: string, subject: string) {
    if (useLineChannel) {
      const { sendLineMessage } = await import("@/lib/channels/line");
      await sendLineMessage(customer.lineUserId!, body);
      await prisma.message.create({ data: { customerId: customer.id, direction: "OUTBOUND", channel: "LINE", body, status: "SENT" } });
      console.log(`[Agent] LINE reply sent to ${customer.name}`);
    } else if (customer.email) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com";
      let html = body.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");
      await resend.emails.send({ from: `${storeName} <${fromEmail}>`, to: [customer.email], subject, html });
      await prisma.message.create({ data: { customerId: customer.id, direction: "OUTBOUND", channel: "EMAIL", subject, body, status: "SENT" } });
      console.log(`[Agent] Email reply sent to ${customer.name}`);
    }
  }

  if (classification === "A") {
    const lastOutbound = await prisma.message.findFirst({ where: { customerId: customer.id, direction: "OUTBOUND" }, orderBy: { createdAt: "desc" } });
    let vacancyPattern = "E";
    const lastBody = lastOutbound?.body || "";
    if (lastBody.includes("見学も可能")) vacancyPattern = "A";
    else if (lastBody.includes("入居中")) vacancyPattern = "B";
    else if (lastBody.includes("建築中")) vacancyPattern = "D";
    else if (lastBody.includes("募集終了") || lastBody.includes("募集が終了")) vacancyPattern = "F";

    let tentKey = "tpl_tent_c";
    if (["F","G"].includes(vacancyPattern)) tentKey = "tpl_tent_b";
    else if (["B","E"].includes(vacancyPattern)) tentKey = "tpl_tent_a";
    else if (vacancyPattern === "D") tentKey = "tpl_tent_d";

    const FALLBACK_TEMPLATES: Record<string, string> = {
      tpl_tent_a: "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\nお問い合わせ物件は現在は入居中で内見できないお部屋ですので、外観・共用部のご案内や似ている物件のご紹介ができればと思います。\n\n{visit_proposal}に下記の店舗にてご予約できればと思うのですが、【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}",
      tpl_tent_b: "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\nお問い合わせ物件は募集が終了しておりますので、ぜひ店頭で他のお部屋のご紹介ができればと思います。\n\n{visit_proposal}に下記の店舗にてご予約できればと思うのですが、【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}",
      tpl_tent_c: "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\n当日は店頭でお話を伺い、お問い合わせ物件に加えて候補物件を洗い出して一気に回る流れでご案内できればと思います。\n\n{visit_proposal}に下記の店舗にてご予約できればと思うのですが、【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}",
      tpl_tent_d: "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\nお問い合わせ物件は建築中で内見できないお部屋ですので、外観・現状のご案内や似ている物件のご紹介ができればと思います。\n\n{visit_proposal}に下記の店舗にてご予約できればと思うのですが、【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}",
    };

    const tentBody = dbTpls[tentKey] || FALLBACK_TEMPLATES[tentKey] || FALLBACK_TEMPLATES["tpl_tent_c"];
    const resolvedBody = tentBody
      .replace(/\{\{customer_name\}\}/g, customer.name || "")
      .replace(/\{visit_proposal\}/g, "●月●日（●）●●:●●もしくは●月●日（●）●●:●●")
      .replace(/\{store_access\}/g, storeAccess || storeName);
    await sendReply(resolvedBody, `【ご来店のご案内】${customer.name}様`);
    console.log(`[Agent] A層: 【未確定】${tentKey} (vacancy=${vacancyPattern}) via ${useLineChannel ? 'LINE' : 'EMAIL'}`);
  } else if (classification === "B") {
    const bBody = `${customer.name}様\n\nご返信いただきありがとうございます。\n${storeName}の${staffName}です。\n\nお問い合わせいただいた物件に加えて、お客様のご条件に合いそうなお部屋をいくつかピックアップしております。\n\nネット非掲載の物件も含め、ぜひ一度ご来店いただければ、より詳しいご案内が可能です。\n\nお引越しの時期はいつ頃をご予定されていますか？`;
    await sendReply(bBody, `【物件のご提案】${customer.name}様へ`);
  } else {
    console.log(`[Agent] C層: ${customer.name} marked for follow-up`);
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { memo: (customer.memo || "").replace("[CLASSIFY_PENDING]", `[AI分類:${classification}層] ${reason}`) },
  });
}

// ====== PHASE 5: ConfirmAgent equivalent ======
async function confirmAppointment(customer: any, org: any, replyBody: string) {
  const assignee = customer.assigneeId ? await prisma.user.findUnique({ where: { id: customer.assigneeId } }) : null;
  const staffName = assignee?.name || "本田みなみ";
  const storeName = org.storeName || org.name || "";
  const storeAccess = [
    "▼お問い合わせ物件の取り扱い店舗",
    org.storeName ? `店舗名：${org.storeName}` : null,
    org.storeAddress ? `住所：${org.storeAddress}` : null,
    (org as any).storeAccess ? `アクセス：${(org as any).storeAccess}` : null,
    org.storePhone ? `TEL：${org.storePhone}` : null,
    (org as any).storeHours ? `営業時間：${(org as any).storeHours}` : null,
    (org as any).storeClosedDays ? `定休日：${(org as any).storeClosedDays}` : null,
  ].filter(Boolean).join("\n");
  const useLineChannel = !!customer.lineUserId;
  const dbTpls = await getAgentTemplates(org.id);

  const aiResponse = await callOpenAI(
    `顧客の返信からアポイント情報を抽出してJSON形式で返してください。{"datetime":"抽出した日時 or 未記載","phone":"電話番号 or 未記載","accepted":true/false}。了承・同意の意思があればaccepted=true。`,
    `顧客返信: ${replyBody}`
  );
  let datetime = "●月●日（●）●●:●●", phone = "", accepted = true;
  try {
    const parsed = JSON.parse(aiResponse.replace(/```json|```/g, "").trim());
    if (parsed.datetime && parsed.datetime !== "未記載") datetime = parsed.datetime;
    if (parsed.phone && parsed.phone !== "未記載") phone = parsed.phone;
    accepted = parsed.accepted !== false;
  } catch {}

  if (!accepted) {
    console.log(`[Agent] Confirm: ${customer.name} did not accept, keeping A-layer`);
    await prisma.customer.update({ where: { id: customer.id }, data: { memo: (customer.memo || "").replace("[CONFIRM_PENDING]", "[AI分類:A層]") } });
    return;
  }

  const CONFIRM_FALLBACK = `それでは{appointment_datetime}に下記の店舗にご予約いたします。\n\n{store_access}\n\nまた、来店時のご案内に際して\n\n【お電話番号】と下記【希望条件】をお知らせください。\n\n----------------------------------------------\n\n■希望条件\n\n・賃料：（　　）円まで\n\n・間取：（　　）\n\n・広さ：（　　）㎡以上\n\n・駐車場（　　）台希望\n\n・エリア：（　　）\n\n・駅から：（　　）分\n\n・入居人数：（　　）人\n\n・入居希望時期：（　年　月　日頃）\n\n・引っ越し理由（　　）\n\n・その他、こだわり条件（　　）\n\n----------------------------------------------\n\n■ご留意事項\n\n※ご案内当日までにお問い合わせ物件の募集が終了してしまう可能性もございます、その場合も近い条件でお部屋のご紹介をさせて頂きますので、ご安心ください\n\n※ご案内の際、鍵手配が必要です。状況によりご案内出来ない場合がございます、その際はご了承ください`;
  const confirmTpl = dbTpls["snippet_appointment_48"] || dbTpls["tpl_confirm"] || CONFIRM_FALLBACK;
  const confirmBody = confirmTpl
    .replace(/\{\{customer_name\}\}/g, customer.name || "")
    .replace(/\{appointment_datetime\}/g, datetime)
    .replace(/\{appointment_location\}/g, storeName)
    .replace(/\{store_access\}/g, storeAccess)
    .replace(/●店舗アクセス貼る●/g, storeAccess);

  if (useLineChannel) {
    const { sendLineMessage } = await import("@/lib/channels/line");
    await sendLineMessage(customer.lineUserId!, confirmBody);
    await prisma.message.create({ data: { customerId: customer.id, direction: "OUTBOUND", channel: "LINE", body: confirmBody, status: "SENT" } });
  } else if (customer.email) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com";
    let html = confirmBody.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");
    await resend.emails.send({ from: `${storeName} <${fromEmail}>`, to: [customer.email], subject: `【ご予約確定】${customer.name}様`, html });
    await prisma.message.create({ data: { customerId: customer.id, direction: "OUTBOUND", channel: "EMAIL", subject: `【ご予約確定】${customer.name}様`, body: confirmBody, status: "SENT" } });
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { memo: (customer.memo || "").replace("[CONFIRM_PENDING]", `[アポ確定] ${datetime} ${phone}`), isNeedAction: true },
  });
  console.log(`[Agent] CONFIRMED: ${customer.name} datetime=${datetime} phone=${phone} via ${useLineChannel ? "LINE" : "EMAIL"}`);
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

  const pending = await prisma.customer.findMany({ where: { memo: { contains: "[AGENT_PENDING]" } }, take: 5, orderBy: { createdAt: "asc" } });
  for (const c of pending) {
    if (!c.email) continue;
    try { await processNewInquiry(c, org); processed++; } catch (e: any) { console.error(`[Agent] Error 1st mail ${c.name}:`, e.message); }
  }

  const classifyPending = await prisma.customer.findMany({ where: { memo: { contains: "[CLASSIFY_PENDING]" } }, take: 5, orderBy: { updatedAt: "asc" } });
  for (const c of classifyPending) {
    if (!c.email && !c.lineUserId) continue;
    const lastMsg = await prisma.message.findFirst({ where: { customerId: c.id, direction: "INBOUND" }, orderBy: { createdAt: "desc" } });
    if (!lastMsg?.body) continue;
    try { await classifyReply(c, org, lastMsg.body); processed++; } catch (e: any) { console.error(`[Agent] Error classify ${c.name}:`, e.message); }
  }

  const confirmPending = await prisma.customer.findMany({ where: { memo: { contains: "[CONFIRM_PENDING]" } }, take: 5, orderBy: { updatedAt: "asc" } });
  for (const c of confirmPending) {
    if (!c.email && !c.lineUserId) continue;
    const lastMsg = await prisma.message.findFirst({ where: { customerId: c.id, direction: "INBOUND" }, orderBy: { createdAt: "desc" } });
    if (!lastMsg?.body) continue;
    try { await confirmAppointment(c, org, lastMsg.body); processed++; } catch (e: any) { console.error(`[Agent] Error confirm ${c.name}:`, e.message); }
  }

  return NextResponse.json({ success: true, processed, pending: pending.length, classify: classifyPending.length, confirm: confirmPending.length });
}
