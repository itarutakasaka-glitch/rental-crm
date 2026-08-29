// フラットエージェンシー 下書き生成(TypeScript移植版)
// 移植元: heyacules-ai リポジトリ inquiry-agent/drafts.js
// recommendStore() の推奨をもとに、顧客向け初回メール・LINE投稿文・社内向けコメントの
// 「下書き」を生成する。送信は人間が確認のうえ実施する(Phase1=下書き承認方式)。
import { recommendStore, type RouterInput, type RouterResult } from "./flat-agency-router";

// 外国籍向け一般文面(定型文DBから取得して差し込む想定。未取得時はnull=下書きを付けない)
let _foreignGeneralText = "";
export function setForeignSections(secs: { general?: string } | null) {
  _foreignGeneralText = secs?.general || "";
}

function mailJP(name: string) {
  return `${name}様

お問い合わせいただき、誠にありがとうございます。
株式会社フラットエージェンシーでございます。

お部屋探しのお手伝いをさせていただきたく存じます。
つきましては、ご希望の条件についてもう少し詳しくお聞かせいただけますでしょうか。

・ご希望のエリア（沿線・駅・学校名など）
・ご予算（家賃の上限）
・間取り／広さ
・ご入居希望時期

上記をご返信いただけますと、最適なお部屋をご提案できるかと存じます。
何卒よろしくお願いいたします。`;
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

function pickMail(lang: string | undefined, name: string): { 言語: string; 本文: string } | null {
  if (lang === "英語") return { 言語: "EN", 本文: mailEN(name) };
  if (lang === "中国語") return { 言語: "ZH（要レビュー）", 本文: mailZH(name) };
  if ((lang === "韓国語" || lang === "外国語") && _foreignGeneralText) {
    return { 言語: "外国籍確認（要人間確認）", 本文: `${name}様\n\n${_foreignGeneralText}` };
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
export function generateDrafts(params: { 反響?: RouterInput; customer?: DraftCustomer; dateStr: string }): GenerateDraftsResult {
  const r = params.反響 || {};
  const c = params.customer || { name: "" };
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
    const mail = pickMail(r.対応言語, c.name);
    if (mail) {
      drafts.mail = mail;
      ops.unshift("初回メール送付");
    }
  }
  return { recommendation: rec, 必要な操作: ops, drafts };
}
