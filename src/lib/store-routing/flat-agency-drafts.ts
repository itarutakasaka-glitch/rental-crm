// フラットエージェンシー 下書き生成(TypeScript移植版)
// 移植元: heyacules-ai リポジトリ inquiry-agent/drafts.js
// recommendStore() の推奨をもとに、顧客向け初回メール・LINE投稿文・社内向けコメントの
// 「下書き」を生成する。送信は人間が確認のうえ実施する(Phase1=下書き承認方式)。
import { recommendStore, type RouterInput, type RouterResult } from "./flat-agency-router";

// architecture-v2.md §8 Step4: 下記のmailEN/mailZHはDBにテンプレ(AgentTemplate)が
// 無い組織向けのフォールバック文面。呼び出し側(API route)がAgentTemplateから
// tpl_mail_en/tpl_mail_zh/tpl_foreign_generalを取得しtemplatesとして渡した場合はそちらを優先する。
// (旧実装はsetForeignSections()というモジュール変数でDB文面を差し込む設計だったが、
//  複数組織のリクエストが同一Nodeプロセスで並行処理されると他組織の文面が混ざる恐れがあるため、
//  純粋関数の引数として渡す方式に変更した)
export type DraftTemplates = {
  tpl_mail_en?: string;
  tpl_mail_zh?: string;
  tpl_foreign_general?: string;
};

function fillCustomerName(body: string, name: string) {
  return body.replace(/\{\{customer_name\}\}/g, name);
}

function mailEN(name: string) {
  return `Dear ${name},

Thank you very much for your inquiry to Flat Agency.

We would be happy to help you find a place to live. Could you please share a little more about what you are looking for?

- Preferred area (train line, station, or school name)
- Budget (maximum monthly rent)
- Layout / size
- Desired move-in date

Once we receive these details, we can suggest the most suitable properties for you.
We look forward to hearing from you.

Best regards,
Flat Agency`;
}

// 中国語テンプレは要・人間レビュー(機械生成の暫定文)
function mailZH(name: string) {
  return `${name}您好，

感谢您向Flat Agency咨询。

我们很乐意帮您寻找合适的房源。能否请您告知以下信息？

・希望的区域（沿线、车站或学校名称）
・预算（每月租金上限）
・户型／面积
・希望入住时间

收到后我们会为您推荐最合适的房源。
期待您的回复。

Flat Agency`;
}

function pickMail(lang: string | undefined, name: string, templates: DraftTemplates): { 言語: string; 本文: string } | null {
  if (lang === "英語") return { 言語: "EN", 本文: templates.tpl_mail_en ? fillCustomerName(templates.tpl_mail_en, name) : mailEN(name) };
  if (lang === "中国語") return { 言語: "ZH（要レビュー）", 本文: templates.tpl_mail_zh ? fillCustomerName(templates.tpl_mail_zh, name) : mailZH(name) };
  if (lang === "韓国語" || lang === "外国語") {
    if (!templates.tpl_foreign_general) return null;
    return { 言語: "外国籍確認（要人間確認）", 本文: `${name}様\n\n${templates.tpl_foreign_general}` };
  }
  if (!lang || lang === "日本語") return null;
  return null;
}

export type DraftCustomer = { name: string; phone?: string; url?: string; caseNo?: string };

function lineGroupPost(c: DraftCustomer, rec: RouterResult) {
  const targets = (rec.lineTargets || []).join("・");
  const kind = rec.route === "マンスリー短期" ? "マンスリー/短期" : rec.route === "テナント" ? "テナント/事務所利用" : "物件・エリア未指定";
  const timing = rec.投稿タイミング === "翌営業日" ? "\n※本日は全店休のため、翌営業日のご対応をお願いいたします。" : "";
  return `${c.caseNo || ""}
${kind}のお問い合わせが入りました。対応可能な店舗にてご対応をお願いいたします。${timing}

${c.name}　${c.phone || "（電話番号なし）"}　${c.url || ""}

（${targets}グループLINE宛）`;
}

function commentIiseikatsu(dateStr: string, rec: RouterResult) {
  const hint = rec.hint ? `\n・反響本文の元付表記：${rec.hint}（要・いい生活で確認）` : "";
  return `【メモ】${dateStr}\n・物件指定あり。いい生活で物件を調べ、記載の元付会社（店舗）のタグを付与して対応。${hint}`;
}

function commentNormal(dateStr: string, rec: RouterResult) {
  return `【メモ】${dateStr}\n・一次対応店：【${rec.store}】\n・理由：${rec.理由}`;
}

function commentLine(dateStr: string, rec: RouterResult) {
  const t = (rec.lineTargets || []).join("・");
  return `【一次対応メモ】${dateStr}\n・${rec.理由}\n・${t}グループLINEへ投稿（対応店は店舗側判断）。`;
}

function comment対応不要(dateStr: string, rec: RouterResult) {
  return `【対応不要メモ】${dateStr}\n・${rec.理由}\n・店舗タグ設定済み。追客対応なしで終了。`;
}

export type GenerateDraftsResult = {
  recommendation: RouterResult;
  必要な操作: string[];
  drafts: { comment?: string; lineMention?: string; mail?: { 言語: string; 本文: string } };
};

/** 反響情報＋顧客情報＋日付から、推奨と下書き一式を生成する。 */
export function generateDrafts(params: { 反響?: RouterInput; customer?: DraftCustomer; dateStr: string; templates?: DraftTemplates }): GenerateDraftsResult {
  const r = params.反響 || {};
  const c = params.customer || { name: "" };
  const templates = params.templates || {};
  const rec = recommendStore(r, params.dateStr);

  if (rec.action === "対応不要") {
    return { recommendation: rec, 必要な操作: ["店舗タグ設定", "ヘヤクレス社内向けコメント"], drafts: { comment: comment対応不要(params.dateStr, rec) } };
  }
  if (rec.action === "LINE投稿") {
    return { recommendation: rec, 必要な操作: ["グループLINEへ投稿", "ヘヤクレス社内向けコメント"], drafts: { lineMention: lineGroupPost(c, rec), comment: commentLine(params.dateStr, rec) } };
  }
  if (rec.action === "いい生活") {
    return { recommendation: rec, 必要な操作: ["いい生活で元付会社を確認", "その店舗タグを付与", "通常対応"], drafts: { comment: commentIiseikatsu(params.dateStr, rec) } };
  }

  const drafts: GenerateDraftsResult["drafts"] = { comment: commentNormal(params.dateStr, rec) };
  const ops = [`店舗タグ付与（${rec.store}）`, "通常対応"];
  if (rec.route === "言語" && r.対応言語 && ["英語", "中国語", "韓国語", "外国語"].includes(r.対応言語)) {
    const mail = pickMail(r.対応言語, c.name, templates);
    if (mail) {
      drafts.mail = mail;
      ops.unshift("初回メール送付");
    }
  }
  return { recommendation: rec, 必要な操作: ops, drafts };
}
