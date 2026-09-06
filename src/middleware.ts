import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// 2026-09-06: Supabase Auth から自前認証へ移行。
// middleware は Edge ランタイムで動きDBに触れないので、ここでは **Cookieの有無しか見ない**。
// これは「未ログインならログイン画面へ送る」という体験のためのもので、
// 認可の判断ではない。実際の検証は各ページ・APIの requireUser / requireCustomerAccess /
// canAccessOrg が行う（route-auth-guard.test.ts がその漏れを検査している）。
const PUBLIC_PREFIXES = [
  "/_next",
  "/favicon",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth", // ログイン・ログアウト・パスワード再設定そのもの
  "/api/webhook",
  "/api/cron",
  "/api/agent",
  "/api/public",
  "/api/store-visit-bookings",
  "/api/track",
  "/visit",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // エージェント（cron等）は共有秘密鍵で /api/send-message を直接叩く
  if (pathname.startsWith("/api/send-message") && request.headers.get("x-agent-secret")) {
    return NextResponse.next();
  }

  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value;
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
