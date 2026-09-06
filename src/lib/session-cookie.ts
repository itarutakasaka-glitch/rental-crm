// Cookie名だけを持つ依存ゼロのモジュール。
// middleware は Edge ランタイムで動くため Prisma を読み込めない。
// middleware（Cookieの有無だけ見る）と lib/session.ts（実際に検証する）の両方から使う。
export const SESSION_COOKIE = "hc_session";
