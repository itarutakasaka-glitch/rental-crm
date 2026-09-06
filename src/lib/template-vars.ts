// implementation-spec-v1.md §1.3: テンプレート変数の置換はこのファイル1箇所に集約する。
// 以前は customer-detail.tsx / api/send-message / api/workflow-run / api/cron/workflow /
// api/store-visit-bookings の5箇所に同じ replace チェーンが重複しており、変数を足すたびに
// 一部だけ対応漏れが起きていた（実際 {{visit_url}} は3箇所にしか無かった）。
// **新しい変数はここの buildVarMap に足し、仕様書 §1.3 の表も同時に更新する。**

// D-1(§6.1 OrganizationChannel)で会社ごとの LINE 公式に置き換えるまでの暫定既定値。
// 会社の lineUrl が未設定のときだけ、明示的に要求された呼び出し元でのみ使う。
// **2社目を入れる前に必ず廃止する**（他社名義でヘヤクレスの LINE を案内してしまうため）。
const LEGACY_DEFAULT_LINE_URL = "https://line.me/R/ti/p/@331fxngy";

/**
 * LINE 友だち追加の案内 URL。会社に設定があればそれ、無ければ暫定既定値。
 * テンプレ変数ではなく本文に直接埋め込む箇所（初回メール末尾の LINE 案内）用。
 * D-1 の OrganizationChannel 移行でこの関数ごと会社別設定に置き換える。
 */
export function lineInviteUrl(org: any): string {
  return org?.lineUrl || LEGACY_DEFAULT_LINE_URL;
}

// D-1 で独自ドメインへ移行する想定。env で上書きできるようにしておく。
export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://tama-fudosan-crm-2026.vercel.app";
}

/** 来店予約ページの URL。organizationId は必須（実在しない値を混ぜない）。 */
export function buildVisitUrl(organizationId: string, customerId?: string | null): string {
  if (!organizationId) return "";
  return `${appBaseUrl()}/visit/${organizationId}${customerId ? `?c=${customerId}` : ""}`;
}

export type TemplateVarContext = {
  customer?: any;
  org?: any;
  /** 送信者名。未指定なら顧客の担当者名を使う */
  staffName?: string | null;
  /** 画面固有の追加変数（来店予約の visit_date 等）。キーは中括弧なしの名前 */
  extra?: Record<string, string | number | null | undefined>;
  /**
   * org.lineUrl が空のとき LEGACY_DEFAULT_LINE_URL を使うか（既定 false）。
   * 既存の挙動を変えないため、従来フォールバックしていた呼び出し元だけ true を渡す。
   */
  useLegacyLineFallback?: boolean;
};

function buildVarMap(ctx: TemplateVarContext): Record<string, string> {
  const c = ctx.customer || {};
  const org = ctx.org || {};
  const organizationId = org.id || c.organizationId || "";
  const map: Record<string, string> = {
    customer_name: c.name || "",
    customer_email: c.email || "",
    customer_phone: c.phone || "",
    staff_name: ctx.staffName || c.assignee?.name || "",
    property_name: c.properties?.[0]?.name || "",
    property_url: c.properties?.[0]?.portalUrl || c.properties?.[0]?.url || "",
    company_name: org.name || "",
    store_name: org.storeName || org.name || "",
    store_address: org.storeAddress || org.address || "",
    store_phone: org.storePhone || org.phone || "",
    store_hours: org.storeHours || "",
    line_url: org.lineUrl || (ctx.useLegacyLineFallback ? LEGACY_DEFAULT_LINE_URL : ""),
    license_number: org.licenseNumber || "",
    visit_url: buildVisitUrl(organizationId, c.id),
  };
  for (const [k, v] of Object.entries(ctx.extra || {})) {
    map[k] = v == null ? "" : String(v);
  }
  return map;
}

const VAR_RE = /\{\{(\w+)\}\}/g;

/**
 * `{{var}}` を1回のパスで置換する。
 * 値の中に `{{...}}` が含まれていても二重展開しない（チェーン replace の弊害を避ける）。
 * 未知の変数はそのまま残す（テンプレの書き間違いを黙って消さない）。
 */
export function resolveTemplateVars(text: string | null | undefined, ctx: TemplateVarContext): string {
  if (!text) return "";
  const map = buildVarMap(ctx);
  return text.replace(VAR_RE, (whole, key: string) => (key in map ? map[key] : whole));
}

/** 置換に使える変数名の一覧（設定画面の「変数を挿入」ボタン用）。 */
export function listTemplateVarNames(): string[] {
  return Object.keys(buildVarMap({}));
}
