// フラットエージェンシー 一次対応店 振り分け判定エンジン(TypeScript移植版)
// 移植元: heyacules-ai リポジトリ inquiry-agent/router.js (Chrome拡張・旧flat-agency-router)
// scope: 物件なし・エリア不明 の初回反響に対する一次対応店の推奨
// 出力は「推奨」であり、最終確定は人間がCRMで行う前提(Phase1=下書き承認方式)。
//
// 元の拡張は「カナリー顧客ページにパネルを注入」する形だったが、CRM組み込み版は
// Customer/Messageレコードを直接読んで判定する。店舗マスタ・臨時休業・対応不要物件は
// 当面このファイルにハードコードしたまま(店舗ごとの振り分けロジックはパターンが出揃うまで
// DB汎用テーブル化しない方針。store-hierarchy-design.md参照)。

const STORES: Record<string, { 言語対応: string[]; 定休曜日: string[]; 定休日曜: number[]; 祝日休: boolean }> = {
  左京店: { 言語対応: ["英語", "中国語"], 定休曜日: ["水"], 定休日曜: [1, 3], 祝日休: false },
  本店: { 言語対応: [], 定休曜日: ["水"], 定休日曜: [2, 4], 祝日休: false },
  産業大学前店: { 言語対応: [], 定休曜日: ["水", "日"], 定休日曜: [], 祝日休: true },
};

const 臨時休業: { 対象: string; from: string; to: string; 理由?: string; 振替?: string }[] = [
  { 対象: "全店", from: "2026-05-03", to: "2026-05-06", 理由: "GW" },
  { 対象: "産業大学前店", from: "2026-04-30", to: "2026-05-02", 振替: "本店" },
  { 対象: "産業大学前店", from: "2026-05-07", to: "2026-05-09", 振替: "本店" },
];

const 祝日 = new Set<string>([]);
const 対応不要物件リスト = ["東山区芳野町京町家"];
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const STORE_VALUES = ["左京店", "本店", "産大前店"];

function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, dow };
}

function nthWeekday(d: number): number {
  return Math.ceil(d / 7);
}

function isOpen(storeName: string, dateStr: string): boolean {
  const s = STORES[storeName];
  if (!s) throw new Error(`未知の店舗: ${storeName}`);
  const { d, dow } = parseDate(dateStr);
  const wd = WEEKDAYS[dow];

  for (const t of 臨時休業) {
    if ((t.対象 === "全店" || t.対象 === storeName) && dateStr >= t.from && dateStr <= t.to) return false;
  }
  if (s.定休曜日.includes(wd)) return false;
  if (dow === 0 && s.定休日曜.includes(nthWeekday(d))) return false;
  if (s.祝日休 && 祝日.has(dateStr)) return false;
  return true;
}

// 受験生ルールの有効期間: 8〜3月(受験〜春の入学ピーク)。4〜7月はOFF。
function 受験生ルール有効(dateStr: string): boolean {
  const m = parseDate(dateStr).m;
  return m >= 8 || m <= 3;
}

function 全店休(dateStr: string): boolean {
  return !isOpen("左京店", dateStr) && !isOpen("本店", dateStr);
}

export type RouterInput = {
  対応不要物件?: boolean;
  短期?: boolean;
  テナント?: boolean;
  受験生?: "京都大学" | "京都工芸繊維大学" | null;
  対応言語?: "日本語" | "英語" | "中国語" | "韓国語";
  元付京都駅前店?: boolean;
  物件あり?: boolean;
  反響店舗?: string | null;
};

export type RouterResult = {
  rule: number;
  action: "対応不要" | "LINE投稿" | "振り分け" | "いい生活";
  store: string | null;
  lineTargets?: string[];
  投稿タイミング?: "翌営業日" | "本日";
  固定?: boolean;
  要確認?: boolean;
  hint?: string | null;
  route: string;
  terminal?: boolean;
  理由: string;
};

/** 一次対応の推奨を出す(上から先勝ち)。出力は推奨、確定は人間。 */
export function recommendStore(input: RouterInput, dateStr: string): RouterResult {
  const i = input || {};

  // 1 対応不要物件(最優先・終了)
  if (i.対応不要物件) {
    return { rule: 1, action: "対応不要", store: null, terminal: true, route: "対応不要", 理由: "対応不要物件リスト該当。店舗タグ＋メモのみ設定して終了" };
  }

  // 2 外国語(英/中/韓) → 左京固定。言語対応スタッフがいる唯一の店のため他条件より優先。
  if (i.対応言語 && i.対応言語 !== "日本語") {
    const 韓 = i.対応言語 === "韓国語";
    return { rule: 2, action: "振り分け", store: "左京店", 固定: true, 要確認: 韓, route: "言語", 理由: `${i.対応言語}対応 → 左京店固定（他店に言語スタッフなし）${韓 ? "／韓国語は要確認" : ""}` };
  }

  // 3 受験生(京大/京都工繊大) ※8〜3月のみ有効 → 左京固定
  if ((i.受験生 === "京都大学" || i.受験生 === "京都工芸繊維大学") && 受験生ルール有効(dateStr)) {
    return { rule: 3, action: "振り分け", store: "左京店", 固定: true, route: "受験生", 理由: `${i.受験生}の受験生 → 左京店固定（8〜3月有効）` };
  }

  // 4 マンスリー/短期 → 本店・左京 両グループLINEへ投稿
  if (i.短期) {
    return { rule: 4, action: "LINE投稿", store: null, lineTargets: ["本店", "左京店"], route: "マンスリー短期", 理由: "マンスリー/短期 → 本店・左京の両グループLINEへ投稿" };
  }

  // 5 テナント/事務所利用 → 本店・左京 両グループLINEへ投稿
  if (i.テナント) {
    return { rule: 5, action: "LINE投稿", store: null, lineTargets: ["本店", "左京店"], route: "テナント", 理由: "テナント/事務所利用 → 本店・左京の両グループLINEへ投稿" };
  }

  // 6 元付＝京都駅前店 → 本店(京都駅前店は本店が運営)
  if (i.元付京都駅前店) {
    return { rule: 6, action: "振り分け", store: "本店", route: "元付京都駅前店", 理由: "元付が京都駅前店のため本店で対応" };
  }

  // 7 物件指定あり → いい生活で元付会社(店舗)を確認して対応(実確認は人)
  if (i.物件あり) {
    const hint = i.反響店舗 && STORE_VALUES.includes(i.反響店舗) ? i.反響店舗 : null;
    return { rule: 7, action: "いい生活", store: null, hint, route: "物件指定", 理由: "物件指定あり：いい生活で元付会社（店舗）を確認して対応" };
  }

  // 8 物件指定なし: 本文に店舗名 → その店舗。店舗名なし → 全店LINE(全店休なら翌営業日)。
  if (i.反響店舗 && STORE_VALUES.includes(i.反響店舗)) {
    return { rule: 8, action: "振り分け", store: i.反響店舗, route: "反響店舗", 理由: `本文に店舗名（${i.反響店舗}）→ その店舗で対応` };
  }
  const 翌 = 全店休(dateStr);
  return {
    rule: 8,
    action: "LINE投稿",
    store: null,
    lineTargets: ["全店"],
    投稿タイミング: 翌 ? "翌営業日" : "本日",
    route: "定休日",
    理由: 翌 ? "物件・店舗名なし → 全店休のため翌営業日に全店グループLINEへ投稿" : "物件・店舗名なし → 全店グループLINEへ投稿",
  };
}

export { isOpen, nthWeekday, parseDate, 受験生ルール有効, 全店休, STORES, 臨時休業, 対応不要物件リスト };
