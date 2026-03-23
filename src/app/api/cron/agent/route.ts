import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const AGENT_MODEL = "gpt-4o-mini";

// Load vacancy texts (反響研究所8パターン - agent_flow.html準拠)
const VACANCY_TEXTS: Record<string, string> = {
  A: "\u21D2\u73FE\u5728\u7A7A\u5BA4\u3001\u898B\u5B66\u3082\u53EF\u80FD\u306A\u304A\u90E8\u5C4B\u3067\u3059\u3002\n\u203B\u304A\u7533\u8FBC\u307F\u306F\u5148\u7740\u9806\u306B\u3064\u304D\u3001\u4E07\u304C\u4E00\u3054\u7D39\u4ECB\u4E2D\u306B\u6E80\u5BA4\u3068\u306A\u3063\u305F\u5834\u5408\u306F\u3054\u5BB9\u8D66\u304F\u3060\u3055\u3044\n\n\u7269\u4EF6\u306E\u3054\u6848\u5185\u306B\u52A0\u3048\u3066\u3001\u305C\u3072\u4E00\u5EA6\u5E97\u982D\u3067\u8A73\u3057\u3044\u304A\u8A71\u3092\u4F3A\u3063\u305F\u4E0A\u3067\u3001\u3053\u306E\u4ED6\u306B\u3082\u304A\u90E8\u5C4B\u306E\u3054\u7D39\u4ECB\u304C\u3067\u304D\u308C\u3070\u3068\u601D\u3044\u307E\u3059\u3002\n\n{VISIT}\u306F\u3054\u90FD\u5408\u3044\u304B\u304C\u3067\u3057\u3087\u3046\u304B\uFF1F",
  B: "\u21D2\u3054\u7D39\u4ECB\u53EF\u80FD\u306A\u304A\u90E8\u5C4B\u3067\u3059\u3002\n\u73FE\u5728\u5165\u5C45\u4E2D\u306B\u3064\u304D\u3001\u5BA4\u5185\u306E\u898B\u5B66\u306F\u307E\u3060\u3067\u304D\u306A\u3044\u304A\u90E8\u5C4B\u3068\u306A\u308A\u307E\u3059\u3002\n\u8857\u4E26\u307F\u30FB\u5916\u89B3\u30FB\u5171\u7528\u90E8\u306E\u3054\u6848\u5185\u3084\u30A8\u30EA\u30A2\u60C5\u5831\u306E\u7D39\u4ECB\u3001\u4F3C\u3066\u3044\u308B\u7269\u4EF6\u306E\u3054\u7D39\u4ECB\u306F\u53EF\u80FD\u3067\u3059\u3002\n\n{VISIT}\u306F\u3054\u90FD\u5408\u3044\u304B\u304C\u3067\u3057\u3087\u3046\u304B\uFF1F",
  C: "\u21D2\u3054\u7D39\u4ECB\u53EF\u80FD\u306A\u304A\u90E8\u5C4B\u3067\u3059\u3002\n\u73FE\u5728\u5165\u5C45\u4E2D\u306B\u3064\u304D\u3001\u5BA4\u5185\u306E\u898B\u5B66\u306F\u307E\u3060\u3067\u304D\u306A\u3044\u304A\u90E8\u5C4B\u3068\u306A\u308A\u307E\u3059\u3002\n\u540C\u3058\u7269\u4EF6\u3067\u985E\u4F3C\u306E\u304A\u90E8\u5C4B\u304C\u898B\u5B66\u53EF\u80FD\u3067\u3059\u306E\u3067\u3001\u305D\u3061\u3089\u306E\u3054\u6848\u5185\u306F\u53EF\u80FD\u3067\u3059\u3002\n\n{VISIT}\u306F\u3054\u90FD\u5408\u3044\u304B\u304C\u3067\u3057\u3087\u3046\u304B\uFF1F",
  D: "\u21D2\u3054\u7D39\u4ECB\u53EF\u80FD\u306A\u304A\u90E8\u5C4B\u3067\u3059\u3002\n\u73FE\u5728\u306F\u5EFA\u7BC9\u4E2D\u3068\u306A\u3063\u3066\u304A\u308A\u3001\u307E\u3060\u5185\u898B\u306E\u3067\u304D\u306A\u3044\u304A\u90E8\u5C4B\u3067\u3059\u3002\n\u5B8C\u6210\u524D\u306B8\u5272\uFF5E9\u5272\u304A\u7533\u8FBC\u307F\u304C\u5165\u3063\u3066\u3057\u307E\u3044\u307E\u3059\u3002\u5C11\u3057\u3067\u3082\u524D\u5411\u304D\u306B\u3054\u691C\u8A0E\u9802\u3051\u308B\u3088\u3046\u3067\u3057\u305F\u3089\u304A\u65E9\u3081\u306B\u304A\u58F0\u304C\u3051\u304F\u3060\u3055\u3044\u307E\u305B\u3002\n\n{VISIT}\u306F\u3054\u90FD\u5408\u3044\u304B\u304C\u3067\u3057\u3087\u3046\u304B\uFF1F",
  E: "\u21D2\u3054\u7D39\u4ECB\u53EF\u80FD\u306A\u304A\u90E8\u5C4B\u3067\u3059\u3002\n\u6B63\u78BA\u306A\u898B\u5B66\u53EF\u80FD\u65E5\u6642\u306B\u95A2\u3057\u3066\u306F\u3001\u78BA\u8A8D\u304C\u5FC5\u8981\u3068\u306A\u308A\u307E\u3059\u306E\u3067\u3001\u898B\u5B66\u5E0C\u671B\u306E\u5834\u5408\u306F\u5E0C\u671B\u65E5\u7A0B\u3092\u3054\u9023\u7D61\u304F\u3060\u3055\u3044\u307E\u305B\u3002\n\n{VISIT}\u306F\u3054\u90FD\u5408\u3044\u304B\u304C\u3067\u3057\u3087\u3046\u304B\uFF1F",
  F: "\u21D2\u3042\u3044\u306B\u304F\u4ED6\u306E\u304A\u5BA2\u69D8\u3088\u308A\u304A\u7533\u8FBC\u307F\u304C\u5165\u308A\u3001\u52DF\u96C6\u7D42\u4E86\u3068\u306A\u308A\u307E\u3057\u305F\u3002\n\u305C\u3072\u4E00\u5EA6\u5E97\u982D\u3067\u8A73\u3057\u3044\u304A\u8A71\u3092\u4F3A\u3063\u305F\u4E0A\u3067\u3001\u3053\u306E\u4ED6\u306B\u3082\u304A\u90E8\u5C4B\u306E\u3054\u7D39\u4ECB\u304C\u3067\u304D\u308C\u3070\u3068\u601D\u3044\u307E\u3059\u3002\n\n\u304A\u5F15\u8D8A\u3057\u6642\u671F\u306F\u3044\u3064\u9803\u3092\u4E88\u5B9A\u3055\u308C\u3066\u3044\u307E\u3059\u304B\uFF1F",
  G: "\u21D2\u305F\u3060\u3044\u307E\u52DF\u96C6\u72B6\u6CC1\u306E\u78BA\u8A8D\u3092\u3057\u3066\u304A\u308A\u307E\u3059\u3002\n\u540C\u3058\u7269\u4EF6\u3067\u4ED6\u306E\u304A\u90E8\u5C4B\u3082\u3054\u3056\u3044\u307E\u3059\u306E\u3067\u3001\u3054\u6848\u5185\u53EF\u80FD\u3067\u3059\u3002\n\n\u304A\u5F15\u8D8A\u3057\u6642\u671F\u306F\u3044\u3064\u9803\u3092\u4E88\u5B9A\u3055\u308C\u3066\u3044\u307E\u3059\u304B\uFF1F",
  H: "\u21D2\u305F\u3060\u3044\u307E\u7A7A\u304D\u72B6\u6CC1\u3092\u78BA\u8A8D\u3057\u3066\u304A\u308A\u307E\u3059\u3002\n2\u756A\u624B\u4EE5\u964D\u306E\u3054\u6848\u5185\u3082\u53EF\u80FD\u3067\u3059\u306E\u3067\u3001\u3054\u8208\u5473\u3054\u3056\u3044\u307E\u3057\u305F\u3089\u304A\u65E9\u3081\u306B\u3054\u9023\u7D61\u304F\u3060\u3055\u3044\u307E\u305B\u3002\n\n\u304A\u5F15\u8D8A\u3057\u6642\u671F\u306F\u3044\u3064\u9803\u3092\u4E88\u5B9A\u3055\u308C\u3066\u3044\u307E\u3059\u304B\uFF1F",
};

// ====== URL-based vacancy detection (Phase 2 Step 2: Browserless) ======
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_API_TOKEN || "";

async function scrapeVacancyFromUrl(portalUrl: string): Promise<{ pattern: string; source: string; detail: string }> {
  if (!portalUrl) return { pattern: "E", source: "no_url", detail: "URL\u306A\u3057" };
  if (!BROWSERLESS_TOKEN) return { pattern: "E", source: "no_token", detail: "BROWSERLESS_API_TOKEN\u672A\u8A2D\u5B9A" };

  try {
    // Use Browserless /scrape API to get rendered page content
    const scrapeRes = await fetch(`https://production-sfo.browserless.io/scrape?token=${BROWSERLESS_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: portalUrl,
        waitForSelector: { selector: "body", timeout: 8000 },
        elements: [{ selector: "body" }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!scrapeRes.ok) {
      const errText = await scrapeRes.text().catch(() => "");
      return { pattern: "E", source: "browserless_err", detail: `HTTP ${scrapeRes.status}: ${errText.slice(0, 60)}` };
    }

    const scrapeData = await scrapeRes.json();
    const bodyText = scrapeData?.data?.[0]?.results?.[0]?.text || "";
    const text = bodyText.replace(/\s+/g, " ").slice(0, 15000);
    if (!text || text.length < 100) return { pattern: "E", source: "empty_page", detail: "\u30DA\u30FC\u30B8\u5185\u5BB9\u304C\u7A7A" };

    // SUUMO specific patterns
    if (portalUrl.includes("suumo.jp")) {
      if (/\u3053\u306E\u7269\u4EF6\u306F\u639B\u8F09\u7D42\u4E86|\u63B2\u8F09\u671F\u9593\u304C\u7D42\u4E86|\u53D6\u308A\u6271\u3044\u7D42\u4E86/.test(text))
        return { pattern: "F", source: "suumo", detail: "SUUMO\u639B\u8F09\u7D42\u4E86" };
      // Check SUUMO "入居" field in property table (stop before 取引態様)
      const nyukyoMatch = text.match(/\u5165\u5C45\s+(.+?)(?:\s+\u53D6\u5F15\u614B\u69D8|\s+\u6761\u4EF6|\s+\u53D6\u308A\u6271\u3044)/);
      if (nyukyoMatch) {
        const nyukyoVal = nyukyoMatch[1].trim();
        // Immediate availability
        if (/\u5373\u5165\u5C45\u53EF|\u5373\u53EF|\u5373\u65E5/.test(nyukyoVal))
          return { pattern: "A", source: "suumo_nyukyo", detail: `\u5165\u5C45: ${nyukyoVal} (\u5373\u5165\u5C45\u53EF)` };
        // Consultation needed
        if (/^\u76F8\u8AC7$/.test(nyukyoVal))
          return { pattern: "E", source: "suumo_nyukyo", detail: `\u5165\u5C45: ${nyukyoVal} (\u8981\u76F8\u8AC7)` };
        // Future date: distinguish construction (D) vs occupied (B)
        if (/\d{2}\u5E74\d{1,2}\u6708|\d{1,2}\u6708[\u4E0A\u4E2D\u4E0B]\u65EC|\d{1,2}\u6708\u672B|\d{4}\/\d{2}|\d{4}\u5E74\d{1,2}\u6708/.test(nyukyoVal) || /^\d{1,2}\u6708/.test(nyukyoVal)) {
          // Best check: 築年数 field shows "新築" for new construction
          const chikuNesuMatch = text.match(/\u7BC9\u5E74\u6570\s+(\S+)/);
          const chikuNesu = chikuNesuMatch ? chikuNesuMatch[1] : "";
          if (/\u65B0\u7BC9/.test(chikuNesu)) {
            return { pattern: "D", source: "suumo_shinchiku", detail: `\u5165\u5C45: ${nyukyoVal} / \u7BC9\u5E74\u6570: ${chikuNesu} (\u65B0\u7BC9=\u5EFA\u7BC9\u4E2D)` };
          }
          // Fallback: check 築年月 is in the future
          const chikuMatch = text.match(/\u7BC9\u5E74\u6708\s+(\d{4})\u5E74(\d{1,2})\u6708/);
          if (chikuMatch) {
            const chikuYM = parseInt(chikuMatch[1]) * 100 + parseInt(chikuMatch[2]);
            const nowYM = new Date().getFullYear() * 100 + (new Date().getMonth() + 1);
            if (chikuYM > nowYM) {
              return { pattern: "D", source: "suumo_chiku_future", detail: `\u5165\u5C45: ${nyukyoVal} / \u7BC9\u5E74\u6708: ${chikuMatch[1]}\u5E74${chikuMatch[2]}\u6708 (\u7BC9\u5E74\u6708\u304C\u672A\u6765)` };
            }
          }
          // Also check for 建築中/完成予定 keywords in the page text
          if (/\u5EFA\u7BC9\u4E2D|\u5B8C\u6210\u4E88\u5B9A|\u672A\u5B8C\u6210/.test(text)) {
            return { pattern: "D", source: "suumo_keyword", detail: `\u5165\u5C45: ${nyukyoVal} (\u5EFA\u7BC9\u4E2D\u30AD\u30FC\u30EF\u30FC\u30C9\u691C\u51FA)` };
          }
          // Existing building = occupied
          return { pattern: "B", source: "suumo_nyukyo", detail: `\u5165\u5C45: ${nyukyoVal} / \u7BC9\u5E74\u6570: ${chikuNesu || "?"} (\u5165\u5C45\u4E2D)` };
        }
        // Dash or empty = unknown
        if (/^[-\u2014\u2015\u2500]$/.test(nyukyoVal))
          return { pattern: "E", source: "suumo_nyukyo", detail: `\u5165\u5C45: - (\u60C5\u5831\u306A\u3057)` };
      }
    }
    // APAMANSHOP specific
    if (portalUrl.includes("apamanshop.com")) {
      if (/\u3053\u306E\u7269\u4EF6\u306F\u7D42\u4E86|\u52DF\u96C6\u7D42\u4E86|\u304A\u53D6\u308A\u6271\u3044\u3067\u304D\u307E\u305B\u3093/.test(text))
        return { pattern: "F", source: "apaman", detail: "APAMAN\u52DF\u96C6\u7D42\u4E86" };
    }
    // HOME'S specific
    if (portalUrl.includes("homes.co.jp")) {
      if (/\u3053\u306E\u7269\u4EF6\u306F\u73FE\u5728\u63B2\u8F09\u3055\u308C\u3066\u3044\u307E\u305B\u3093|\u63B2\u8F09\u7D42\u4E86|\u53D6\u308A\u6271\u3044\u7D42\u4E86/.test(text))
        return { pattern: "F", source: "homes", detail: "HOME'S\u63B2\u8F09\u7D42\u4E86" };
    }

    // Generic keyword detection
    if (/\u52DF\u96C6\u7D42\u4E86|\u6210\u7D04\u6E08|\u6E80\u5BA4|\u53D6\u6271\u7D42\u4E86|\u63B2\u8F09\u304C\u7D42\u4E86/.test(text))
      return { pattern: "F", source: "keyword", detail: "\u52DF\u96C6\u7D42\u4E86\u30AD\u30FC\u30EF\u30FC\u30C9\u691C\u51FA" };
    if (/\u5EFA\u7BC9\u4E2D|\u5B8C\u6210\u4E88\u5B9A|\u65B0\u7BC9\u672A\u5B8C\u6210/.test(text))
      return { pattern: "D", source: "keyword", detail: "\u5EFA\u7BC9\u4E2D\u30AD\u30FC\u30EF\u30FC\u30C9\u691C\u51FA" };
    if (/\u5373\u5165\u5C45\u53EF|\u7A7A\u5BA4|\u5165\u5C45\u53EF\u80FD|\u898B\u5B66\u53EF/.test(text))
      return { pattern: "A", source: "keyword", detail: "\u7A7A\u5BA4\u30FB\u5373\u5165\u5C45\u53EF\u30AD\u30FC\u30EF\u30FC\u30C9\u691C\u51FA" };
    if (/\u5165\u5C45\u4E2D|\u73FE\u5165\u5C45|\u9000\u53BB\u4E88\u5B9A/.test(text))
      return { pattern: "B", source: "keyword", detail: "\u5165\u5C45\u4E2D\u30AD\u30FC\u30EF\u30FC\u30C9\u691C\u51FA" };

    // Page exists, content looks normal = likely available (E = confirm needed)
    if (text.length > 500) {
      return { pattern: "E", source: "page_exists", detail: "\u30DA\u30FC\u30B8\u5B58\u5728\u3001\u78BA\u8A8D\u5FC5\u8981" };
    }
    return { pattern: "E", source: "unknown", detail: "\u5224\u5B9A\u4E0D\u80FD" };
  } catch (e: any) {
    if (e.name === "AbortError") return { pattern: "E", source: "timeout", detail: "\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8" };
    return { pattern: "E", source: "error", detail: e.message?.slice(0, 50) || "\u30A8\u30E9\u30FC" };
  }
}

// Generate visit proposal: next available weekend/weekday slots
function generateVisitProposal(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const slots: string[] = [];
  const dayNames = ["\u65E5", "\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F"];
  for (let d = 1; d <= 14 && slots.length < 3; d++) {
    const date = new Date(jst.getTime() + d * 24 * 60 * 60 * 1000);
    const dow = date.getDay();
    if (dow === 2 || dow === 3) continue; // skip Tue/Wed (定休日)
    const m = date.getMonth() + 1;
    const day = date.getDate();
    const dayName = dayNames[dow];
    if (dow === 0 || dow === 6) {
      slots.push(`${m}/${day}(${dayName})10:00\uFF5E`);
    } else {
      slots.push(`${m}/${day}(${dayName})13:00\uFF5E`);
    }
  }
  return slots.join("\u3001");
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
  
  // Find initial response template (AgentTemplate tpl_1st > CRM Template 初回)
  const agentTpl1st = dbTpls["tpl_1st"];
  const crmTmpl = templates.find((t: any) => t.name.includes("\u521D\u56DE"));
  const tmplBody = agentTpl1st || crmTmpl?.body || "";
  const tmplSubject = crmTmpl?.subject || "\u304A\u554F\u3044\u5408\u308F\u305B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059";
  if (!tmplBody) { console.log("[Agent] No initial template found"); return; }
  
  // Step 2: Scrape vacancy from portal URL
  const portalUrl = (props[0] as any)?.portalUrl || props[0]?.url || "";
  const scrapeResult = await scrapeVacancyFromUrl(portalUrl);
  console.log(`[Agent] Vacancy scrape: pattern=${scrapeResult.pattern} source=${scrapeResult.source} detail=${scrapeResult.detail}`);
  
  // Ask AI for vacancy pattern + comment response (with scrape hint)
  const systemPrompt = `あなたは不動産賃貸仲介のアシスタントです。顧客の問い合わせ内容から、(1)空室パターン(A-H)と、(2)質問への回答を判断してください。

重要: 物件ページのURL読み取り結果が提供されています。この結果を最優先で空室パターン判定に使用してください。
- URL読み取りで「F」(募集終了)の場合 → vacancy="F"とすること
- URL読み取りで「A」(空室)の場合 → vacancy="A"とすること
- URL読み取りで「D」(建築中)の場合 → vacancy="D"とすること
- URL読み取りで「E」(確認必要)の場合 → AIの判断でA-Hを選択（わからなければE）

回答はJSON形式で: {"vacancy":"E","comment":"回答文 or 空文字"}
ペットの質問には必ず以下を使うこと: 「ペット飼育の相談可否については物件や飼育内容によって都度確認となりますので、以下ご教示いただくこと可能でしょうか?\\n・飼育されているペットの種別:\\n・飼育されているペットの頭数:\\n・お引越し時期:」
初期費用の質問には: 「初期費用につきましては、入居時期やお申込み内容によって変動いたしますので、概算のご案内も含めて一度ご来店ください。」
質問がなければcommentは空文字にすること。`;
  
  const aiResponse = await callOpenAI(systemPrompt, `顧客名: ${customer.name}\n問い合わせ内容: ${inquiry}\n物件: ${props[0]?.name || "不明"}\n物件URL: ${portalUrl}\n\n【URL読み取り結果】パターン: ${scrapeResult.pattern} / ソース: ${scrapeResult.source} / 詳細: ${scrapeResult.detail}`);
  
  let vacancy = "E", comment = "";
  try {
    const parsed = JSON.parse(aiResponse.replace(/```json|```/g, "").trim());
    vacancy = parsed.vacancy || "E";
    comment = parsed.comment || "";
  } catch { console.log("[Agent] AI parse error, using defaults"); }
  
  // Override: if scrape found a definitive pattern (not E), use it regardless of AI
  if (scrapeResult.pattern !== "E") {
    console.log(`[Agent] Scrape override: AI=${vacancy} -> Scrape=${scrapeResult.pattern}`);
    vacancy = scrapeResult.pattern;
  }
  
  // Pet template fallback from DB
  if (dbTpls["tpl_pet"] && ["ペット","犬","猫","動物"].some(w => inquiry.includes(w))) {
    if (!comment || !comment.includes("ペット")) comment = comment ? comment + "\n\n" + dbTpls["tpl_pet"] : dbTpls["tpl_pet"];
  }
  
  // Build email from template
  const assignee = customer.assigneeId ? await prisma.user.findUnique({ where: { id: customer.assigneeId } }) : null;
  const staffName = assignee?.name || "本田みなみ";
  const storeName = org.storeName || org.name || "";
  const vacancyTextRaw = VACANCY_TEXTS[vacancy] || VACANCY_TEXTS["E"];
  // Generate visit proposal dates (next 3 available slots: Sat/Sun preferred)
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
  const subject = (tmplSubject).replace(/\{\{customer_name\}\}/g, customer.name || "").replace(/\{\{store_name\}\}/g, storeName);
  
  // Import Resend dynamically
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  // textToHtml conversion
  let html = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // [■ text] URL → plain text with hyperlink (not CTA button)
  html = html.replace(/\[\u25A0\s*(.+?)\]\s*(https?:\/\/\S+)/g, (_m: string, label: string, url: string) => {
    return `<a href="${url}" style="color:#0891b2;text-decoration:underline;">${label}</a>`;
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
  const storeAccess = [
    "\u25BC\u304A\u554F\u3044\u5408\u308F\u305B\u7269\u4EF6\u306E\u53D6\u308A\u6271\u3044\u5E97\u8217",
    org.storeName ? `\u5E97\u8217\u540D\uFF1A${org.storeName}` : null,
    org.storeAddress ? `\u4F4F\u6240\uFF1A${org.storeAddress}` : null,
    (org as any).storeAccess ? `\u30A2\u30AF\u30BB\u30B9\uFF1A${(org as any).storeAccess}` : null,
    org.storePhone ? `TEL\uFF1A${org.storePhone}` : null,
    (org as any).storeWebsite ? `\u5E97\u8217web\u30B5\u30A4\u30C8\uFF1A${(org as any).storeWebsite}` : null,
    (org as any).storeHours ? `\u55B6\u696D\u6642\u9593\uFF1A${(org as any).storeHours}` : null,
    (org as any).storeClosedDays ? `\u5B9A\u4F11\u65E5\uFF1A${(org as any).storeClosedDays}` : null,
    (org as any).storeParking ? `\u99D0\u8ECA\u5834\uFF1A${(org as any).storeParking}` : null,
  ].filter(Boolean).join("\n");
  const dbTpls = await getAgentTemplates(org.id);
  const useLineChannel = !!customer.lineUserId;
  
  // Helper: send via LINE or Email based on customer's channel
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
    // A層: 空室状況に応じた【未確定】テンプレートを選択（会話フロー 3-2-2 a/b/c/d）
    // 最後の1stメールの空室パターンをmemoから推測、なければAI判定
    const lastOutbound = await prisma.message.findFirst({ where: { customerId: customer.id, direction: "OUTBOUND" }, orderBy: { createdAt: "desc" } });
    let vacancyPattern = "E"; // default
    const lastBody = lastOutbound?.body || "";
    if (lastBody.includes("見学も可能")) vacancyPattern = "A";
    else if (lastBody.includes("入居中")) vacancyPattern = "B";
    else if (lastBody.includes("建築中")) vacancyPattern = "D";
    else if (lastBody.includes("募集終了") || lastBody.includes("募集が終了")) vacancyPattern = "F";
    
    // 空室パターン → 未確定テンプレートパターン選択
    let tentKey = "tpl_tent_c"; // default: 見れる
    if (["F","G"].includes(vacancyPattern)) tentKey = "tpl_tent_b";      // 募集終了
    else if (["B","E"].includes(vacancyPattern)) tentKey = "tpl_tent_a"; // 入居中
    else if (vacancyPattern === "D") tentKey = "tpl_tent_d";             // 建築中
    // A,C,H → tpl_tent_c（見れる）
    
    const FALLBACK_TEMPLATES: Record<string, string> = {
      tpl_tent_a: "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\nお問い合わせ物件は現在は入居中で内見できないお部屋ですので、外観・共用部のご案内や似ている物件のご紹介ができればと思います。\n\n{visit_proposal}に下記の店舗にてご予約できればと思うのですが、【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}",
      tpl_tent_b: "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\nお問い合わせ物件は募集が終了しておりますので、ぜひ店頭で他のお部屋のご紹介ができればと思います。\n\n{visit_proposal}に下記の店舗にてご予約できればと思うのですが、【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}",
      tpl_tent_c: "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\n当日は店頭でお話を伺い、お問い合わせ物件に加えて候補物件を洗い出して一気に回る流れでご案内できればと思います。\n\n{visit_proposal}に下記の店舗にてご予約できればと思うのですが、【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}",
      tpl_tent_d: "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\nお問い合わせ物件は建築中で内見できないお部屋ですので、外観・現状のご案内や似ている物件のご紹介ができればと思います。\n\n{visit_proposal}に下記の店舗にてご予約できればと思うのですが、【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}",
    };
    
    const tentBody = dbTpls[tentKey] || FALLBACK_TEMPLATES[tentKey] || FALLBACK_TEMPLATES["tpl_tent_c"];
    const resolvedBody = tentBody
      .replace(/\{\{customer_name\}\}/g, customer.name || "")
      .replace(/\{visit_proposal\}/g, "\u25CF\u6708\u25CF\u65E5\uFF08\u25CF\uFF09\u25CF\u25CF:\u25CF\u25CF\u3082\u3057\u304F\u306F\u25CF\u6708\u25CF\u65E5\uFF08\u25CF\uFF09\u25CF\u25CF:\u25CF\u25CF")
      .replace(/\{store_access\}/g, storeAccess || storeName);
    
    await sendReply(resolvedBody, `【ご来店のご案内】${customer.name}様`);
    console.log(`[Agent] A層: 【未確定】${tentKey} (vacancy=${vacancyPattern}) via ${useLineChannel ? 'LINE' : 'EMAIL'}`);
    
  } else if (classification === "B") {
    // B層: ソムリエ提案
    const bBody = `${customer.name}様\n\nご返信いただきありがとうございます。\n${storeName}の${staffName}です。\n\nお問い合わせいただいた物件に加えて、お客様のご条件に合いそうなお部屋をいくつかピックアップしております。\n\nネット非掲載の物件も含め、ぜひ一度ご来店いただければ、より詳しいご案内が可能です。\n\nお引越しの時期はいつ頃をご予定されていますか？`;
    await sendReply(bBody, `【物件のご提案】${customer.name}様へ`);
    
  } else {
    // C層: 追客対象マーク
    console.log(`[Agent] C層: ${customer.name} marked for follow-up`);
  }

  // Update memo
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
    "\u25BC\u304A\u554F\u3044\u5408\u308F\u305B\u7269\u4EF6\u306E\u53D6\u308A\u6271\u3044\u5E97\u8217",
    org.storeName ? `\u5E97\u8217\u540D\uFF1A${org.storeName}` : null,
    org.storeAddress ? `\u4F4F\u6240\uFF1A${org.storeAddress}` : null,
    (org as any).storeAccess ? `\u30A2\u30AF\u30BB\u30B9\uFF1A${(org as any).storeAccess}` : null,
    org.storePhone ? `TEL\uFF1A${org.storePhone}` : null,
    (org as any).storeWebsite ? `\u5E97\u8217web\u30B5\u30A4\u30C8\uFF1A${(org as any).storeWebsite}` : null,
    (org as any).storeHours ? `\u55B6\u696D\u6642\u9593\uFF1A${(org as any).storeHours}` : null,
    (org as any).storeClosedDays ? `\u5B9A\u4F11\u65E5\uFF1A${(org as any).storeClosedDays}` : null,
    (org as any).storeParking ? `\u99D0\u8ECA\u5834\uFF1A${(org as any).storeParking}` : null,
  ].filter(Boolean).join("\n");
  const useLineChannel = !!customer.lineUserId;
  const dbTpls = await getAgentTemplates(org.id);
  
  // AIで返信内容から日時・電話番号を抽出
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

  // 【確定】メール送信 — 定型文DB「【アポ確定】★アポ用_来店」を使用
  const CONFIRM_FALLBACK = `\u305D\u308C\u3067\u306F{appointment_datetime}\u306B\u4E0B\u8A18\u306E\u5E97\u8217\u306B\u3054\u4E88\u7D04\u3044\u305F\u3057\u307E\u3059\u3002\n\n{store_access}\n\n\u307E\u305F\u3001\u6765\u5E97\u6642\u306E\u3054\u6848\u5185\u306B\u969B\u3057\u3066\n\n\u3010\u304A\u96FB\u8A71\u756A\u53F7\u3011\u3068\u4E0B\u8A18\u3010\u5E0C\u671B\u6761\u4EF6\u3011\u3092\u304A\u77E5\u3089\u305B\u304F\u3060\u3055\u3044\u3002\n\n----------------------------------------------\n\n\u25A0\u5E0C\u671B\u6761\u4EF6\n\n\u30FB\u8CC3\u6599\uFF1A\uFF08\u3000\u3000\uFF09\u5186\u307E\u3067\n\n\u30FB\u9593\u53D6\uFF1A\uFF08\u3000\u3000\uFF09\n\n\u30FB\u5E83\u3055\uFF1A\uFF08\u3000\u3000\uFF09\u33A1\u4EE5\u4E0A\n\n\u30FB\u99D0\u8ECA\u5834\uFF08\u3000\u3000\uFF09\u53F0\u5E0C\u671B\n\n\u30FB\u30A8\u30EA\u30A2\uFF1A\uFF08\u3000\u3000\uFF09\n\n\u30FB\u99C5\u304B\u3089\uFF1A\uFF08\u3000\u3000\uFF09\u5206\n\n\u30FB\u5165\u5C45\u4EBA\u6570\uFF1A\uFF08\u3000\u3000\uFF09\u4EBA\n\n\u30FB\u5165\u5C45\u5E0C\u671B\u6642\u671F\uFF1A\uFF08\u3000\u5E74\u3000\u6708\u3000\u65E5\u9803\uFF09\n\n\u30FB\u5F15\u3063\u8D8A\u3057\u7406\u7531\uFF08\u3000\u3000\uFF09\n\n\u30FB\u305D\u306E\u4ED6\u3001\u3053\u3060\u308F\u308A\u6761\u4EF6\uFF08\u3000\u3000\uFF09\n\n----------------------------------------------\n\n\u25A0\u3054\u7559\u610F\u4E8B\u9805\n\n\u203B\u3054\u6848\u5185\u5F53\u65E5\u307E\u3067\u306B\u304A\u554F\u3044\u5408\u308F\u305B\u7269\u4EF6\u306E\u52DF\u96C6\u304C\u7D42\u4E86\u3057\u3066\u3057\u307E\u3046\u53EF\u80FD\u6027\u3082\u3054\u3056\u3044\u307E\u3059\u3001\u305D\u306E\u5834\u5408\u3082\u8FD1\u3044\u6761\u4EF6\u3067\u304A\u90E8\u5C4B\u306E\u3054\u7D39\u4ECB\u3092\u3055\u305B\u3066\u9802\u304D\u307E\u3059\u306E\u3067\u3001\u3054\u5B89\u5FC3\u304F\u3060\u3055\u3044\n\n\u203B\u3054\u6848\u5185\u306E\u969B\u3001\u9375\u624B\u914D\u304C\u5FC5\u8981\u3067\u3059\u3002\u72B6\u6CC1\u306B\u3088\u308A\u3054\u6848\u5185\u51FA\u6765\u306A\u3044\u5834\u5408\u304C\u3054\u3056\u3044\u307E\u3059\u3001\u305D\u306E\u969B\u306F\u3054\u4E86\u627F\u304F\u3060\u3055\u3044`;
  const confirmTpl = dbTpls["snippet_appointment_48"] || dbTpls["tpl_confirm"] || CONFIRM_FALLBACK;
  const confirmBody = confirmTpl
    .replace(/\{\{customer_name\}\}/g, customer.name || "")
    .replace(/\{appointment_datetime\}/g, datetime)
    .replace(/\{appointment_location\}/g, storeName)
    .replace(/\{store_access\}/g, storeAccess)
    .replace(/\u25CF\u5E97\u8217\u30A2\u30AF\u30BB\u30B9\u8CBC\u308B\u25CF/g, storeAccess);

  // Send via LINE or Email
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

  // 担当者に通知（確定時のみ通知 — 会話フロー準拠）
  const notifyBody = `【アポ確定】${customer.name}様\n日時：${datetime}\n電話：${phone || "未取得"}\n場所：${storeName}\n分類：A層\nURL：https://tama-fudosan-crm-2026.vercel.app/customers?id=${customer.id}`;
  // TODO: LINE/Slack通知。現在はmemoに記録
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      memo: (customer.memo || "").replace("[CONFIRM_PENDING]", `[アポ確定] ${datetime} ${phone}`),
      isNeedAction: true,
    },
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

  // 3. Process A-layer confirmations (CONFIRM_PENDING) → ConfirmAgent
  const confirmPending = await prisma.customer.findMany({
    where: { memo: { contains: "[CONFIRM_PENDING]" } },
    take: 5,
    orderBy: { updatedAt: "asc" },
  });
  for (const c of confirmPending) {
    if (!c.email && !c.lineUserId) continue;
    const lastMsg = await prisma.message.findFirst({
      where: { customerId: c.id, direction: "INBOUND" },
      orderBy: { createdAt: "desc" },
    });
    if (!lastMsg?.body) continue;
    try {
      await confirmAppointment(c, org, lastMsg.body);
      processed++;
    } catch (e: any) { console.error(`[Agent] Error confirm ${c.name}:`, e.message); }
  }

  return NextResponse.json({ success: true, processed, pending: pending.length, classify: classifyPending.length, confirm: confirmPending.length });
}
