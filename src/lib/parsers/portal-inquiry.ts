// implementation-spec-v1.md §4 F-5: ポータルからの反響メールを読み取る。
//
// 受信口が2つ（/api/webhook/email と /api/webhook/inbound）あり、それぞれ別の実装を
// 持っていた。片方は実在しないラベル（「氏名：」）を探していて何も拾えない状態だったため、
// **実データで確認した書式だけ**をここに集約し、両方から使う。
//
// 書式は 2026-09-15 にカナリーの実反響（エスエストラスト）で確認した。
// ポータルが決める書式なので、会社が違っても同じ。

export type PortalInquiry = {
  name: string;
  nameKana?: string;
  email: string;
  phone: string;
  source: string;
  inquiryContent: string;
  propertyName?: string;
  propertyUrl?: string;
  propertyStation?: string;
  propertyAddress?: string;
  propertyRent?: string;
  propertyLayout?: string;
  propertyArea?: string;
  propertyRoomNo?: string;
  propertyCode?: string;
  /** 賃料を円に直した値。「3万円」を 3 と読む事故を防ぐため、表示用とは別に持つ */
  rentYen?: number;
};

const pick = (text: string, ...patterns: RegExp[]): string => {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1].trim();
  }
  return "";
};

// ポータルの判定は「決定的な目印」だけで行う。
//
// エスエストラストのようにアパマンショップのFC店を運営している会社では、
// HOME'S やカナリーからの反響でも本文の冒頭に「アパマンショップ○○店 様」と入る。
// 単語「アパマンショップ」の有無で判定すると、他ポータルの反響が全部アパマン扱いになる
// （2026-09-15 に実データで確認）。ドメインや定型の見出しで判定する。
const CANARY_MARKERS = [/Canary問合せID/i, /canary-app\./i, /お問合せ物件情報/];
const HOMES_MARKERS = [/homes\.co\.jp/i, /LIFULL\s*HOME'?S/i];
const SUUMO_MARKERS = [/suumo\.jp/i, /【SUUMO】/, /SUUMOから/];
const APAMAN_MARKERS = [/apamanshop\.com/i, /■\s*アパマンショップホームページ/];

/**
 * 賃料の文字列を円に直す。
 * ポータルによって「93000円」「3万円」「9.3万円」「93,000円」と揺れる。
 * 「万」をただ削ると 3万円 → 3（円）になってしまうので、必ずこの関数を通す。
 */
export function parseRentYen(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const s = String(raw).replace(/[,\s]/g, "");
  const man = s.match(/([\d.]+)万/);
  if (man) {
    const v = Number(man[1]);
    if (!Number.isFinite(v)) return undefined;
    return Math.round(v * 10000);
  }
  const yen = s.match(/([\d.]+)/);
  if (!yen) return undefined;
  const v = Number(yen[1]);
  return Number.isFinite(v) ? Math.round(v) : undefined;
}

// ---- SUUMO ---------------------------------------------------------------
function parseSuumo(text: string): PortalInquiry | null {
  if (!SUUMO_MARKERS.some((m) => m.test(text))) return null;
  const name = pick(text, /名前[(（]漢字[)）][：:]\s*(.+)/, /お名前[：:]\s*(.+)/, /名前[：:]\s*(.+)/);
  const nameKana = pick(text, /名前[(（]カナ[)）][：:]\s*(.+)/);
  const email = pick(text, /メールアドレス[：:]\s*(\S+)/);
  const phone = pick(text, /[ＴT][ＥE][ＬL][：:]\s*(\S+)/, /電話番号[：:]\s*(\S+)/);
  const propertyRent = pick(text, /賃料[：:]\s*(.+)/);
  return {
    name, nameKana, email, phone, source: "SUUMO",
    inquiryContent: pick(text, /お問合せ内容[：:]\s*([\s\S]*?)(?:\n\n|$)/, /お問い合わせ内容[：:]\s*([\s\S]*?)(?:\n\n|$)/),
    propertyName: pick(text, /物件名[：:]\s*(.+)/),
    propertyUrl: pick(text, /物件詳細画面[：:]\s*(https?:\/\/\S+)/, /(https?:\/\/suumo\.jp\S+)/),
    propertyStation: pick(text, /最寄り駅[：:]\s*(.+)/, /最寄駅[：:]\s*(.+)/),
    propertyAddress: pick(text, /所在地[：:]\s*(.+)/),
    propertyRent,
    rentYen: parseRentYen(propertyRent),
    propertyLayout: pick(text, /間取り[：:]\s*(.+)/, /間取[：:]\s*(.+)/),
    propertyArea: pick(text, /専有面積[：:]\s*(.+)/),
  };
}

// ---- アパマンショップ ------------------------------------------------------
// 実データ: 「■アパマンショップホームページ」で始まり、項目は 【名前】【メールアドレス】【電話番号】
function parseApamanshop(text: string): PortalInquiry | null {
  if (!APAMAN_MARKERS.some((m) => m.test(text))) return null;
  const propertyRent = pick(text, /【賃料】\s*(.+)/, /賃料[：:]\s*(.+)/);
  return {
    name: pick(text, /【名前】\s*(.+)/, /【お名前】\s*(.+)/),
    nameKana: pick(text, /【名前カナ】\s*(.+)/, /【フリガナ】\s*(.+)/),
    email: pick(text, /【メールアドレス】\s*(\S+)/),
    phone: pick(text, /【電話番号】\s*(.+)/),
    source: "アパマンショップ",
    inquiryContent: pick(text, /【お問い合わせ内容】\s*([\s\S]*?)(?:【|$)/, /【ご要望】\s*([\s\S]*?)(?:【|$)/),
    propertyName: pick(text, /〔物\s*件\s*名〕\s*(.+)/, /【物件名】\s*(.+)/, /物件名[：:]\s*(.+)/),
    propertyUrl: pick(text, /(https?:\/\/(?:www\.)?apamanshop\.com\S+)/),
    propertyAddress: pick(text, /【所在地】\s*(.+)/, /所在地[：:]\s*(.+)/),
    propertyRent,
    rentYen: parseRentYen(propertyRent),
  };
}

// ---- LIFULL HOME'S --------------------------------------------------------
// 実データ: 「■物件情報」の下に 物件種別: 賃料: 所在地: 交通:。賃料は「3万円」表記。
// 電話問合せ（通話不成立→折り返し番号発行）の通知は**氏名もメールも無い**。
// 以前はその場合に丸ごと捨てていたが、物件情報だけでも取り込む。
function parseHomes(text: string): PortalInquiry | null {
  if (!HOMES_MARKERS.some((m) => m.test(text))) return null;
  const propertyRent = pick(text, /賃料[：:]\s*(.+)/);
  return {
    name: pick(text, /名前[：:]\s*(.+)/, /お名前[：:]\s*(.+)/),
    email: pick(text, /メールアドレス[：:]\s*(\S+)/),
    phone: pick(text, /電話番号[：:]\s*(\S+)/, /かけ直し用電話番号[：:]\s*(\S+)/),
    source: "HOME'S",
    inquiryContent: [
      pick(text, /お問合せ内容[：:]\s*([\s\S]*?)(?:\n\n|$)/),
      pick(text, /備考[：:]\s*([\s\S]*?)(?:\n\n|$)/),
    ].filter(Boolean).join("\n"),
    propertyName: pick(text, /物件名[：:]\s*(.+)/),
    propertyUrl: pick(text, /(https?:\/\/(?:www\.)?homes\.co\.jp\S+)/),
    propertyAddress: pick(text, /所在地[：:]\s*(.+)/),
    propertyStation: pick(text, /交通[：:]\s*(.+)/),
    propertyRent,
    rentYen: parseRentYen(propertyRent),
    propertyLayout: pick(text, /間取り[：:]\s*(.+)/, /間取[：:]\s*(.+)/),
    propertyArea: pick(text, /面積[：:]\s*(.+)/),
    propertyCode: pick(text, /問合せ番号[：:]\s*(\S+)/, /物件番号[：:]\s*(\S+)/, /自社管理番号[：:]\s*(\S+)/),
  };
}

// ---- カナリー -------------------------------------------------------------
// 実データ: 「お問合せ物件情報」の下に 物件名: 部屋番号: 階層: 所在地: 賃料: 間取り:
// 自社管理番号: 路線: 駅: 物件URL:、末尾に「Canary問合せID」。
function parseCanary(text: string): PortalInquiry | null {
  if (!CANARY_MARKERS.some((m) => m.test(text))) return null;
  const propertyRent = pick(text, /賃料[：:]\s*(.+)/);
  const layoutArea = pick(text, /間取り[：:]\s*(.+)/);
  return {
    name: pick(text, /お名前[：:]\s*(.+)/, /氏名[：:]\s*(.+)/, /名前[：:]\s*(.+)/),
    email: pick(text, /メールアドレス[：:]\s*(\S+)/),
    phone: pick(text, /電話番号[：:]\s*(\S+)/),
    source: "カナリー",
    inquiryContent: pick(text, /お問合せ内容[：:]\s*([\s\S]*?)(?:\n\n|$)/, /ご要望[：:]\s*([\s\S]*?)(?:\n\n|$)/),
    propertyName: pick(text, /物件名[：:]\s*(.+)/),
    propertyRoomNo: pick(text, /部屋番号[：:]\s*(.+)/),
    propertyAddress: pick(text, /所在地[：:]\s*(.+)/),
    propertyStation: pick(text, /駅[：:]\s*(.+)/),
    propertyRent,
    rentYen: parseRentYen(propertyRent),
    // 「2LDK(55.43m²)」のように面積が括弧で続く
    propertyLayout: layoutArea.replace(/[(（].*$/, "").trim(),
    propertyArea: (layoutArea.match(/[(（]([^)）]+)[)）]/) || [])[1] || "",
    propertyCode: pick(text, /自社管理番号[：:]\s*(\S+)/),
    propertyUrl: pick(text, /物件URL[：:]\s*(https?:\/\/\S+)/),
  };
}

const PARSERS = [parseCanary, parseHomes, parseSuumo, parseApamanshop];

/**
 * 反響メールを読み取る。どのポータルにも当てはまらなければ null。
 *
 * **氏名もメールも取れなかった場合でも捨てない**。ポータルによっては電話問合せの通知に
 * 顧客名が入らない（HOME'S の折り返し番号発行など）。物件情報だけでも残したほうが、
 * オペレーターが対応できる。
 */
export function parsePortalInquiry(subject: string, body: string): PortalInquiry | null {
  const text = `${subject || ""}\n${body || ""}`;
  for (const parser of PARSERS) {
    const r = parser(text);
    if (!r) continue;
    // 何ひとつ拾えていない場合だけ、誤検出として捨てる
    const gotSomething = r.name || r.email || r.phone || r.propertyName || r.propertyAddress || r.propertyCode;
    if (!gotSomething) continue;
    return r;
  }
  return null;
}
