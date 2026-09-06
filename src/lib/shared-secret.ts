import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

// architecture-v2.md §10 A-5: cron / webhook / 管理用API の共有秘密鍵の検証を1箇所に集約する。
// - 環境変数が未設定なら「認証なしで通す」のではなく必ず拒否する(fail-closed)。
//   以前は `if (process.env.CRON_SECRET && ...)` で、env が消えると認証ごと消えていた。
// - 既定は Authorization: Bearer ヘッダ(または x-agent-secret)のみ。
//   URLクエリ(?secret=)はアクセスログや履歴に残るため、ヘッダを付けられない外部webhookに限って
//   allowQuery: true で明示的に許可する(Resend等。送信元固有の署名検証への置換が次の手)。
// - 比較は timingSafeEqual(長さが違えば即不一致)。
export function verifySharedSecret(req: NextRequest, opts: { allowQuery?: boolean } = {}): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[shared-secret] CRON_SECRET is not configured; refusing request");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const header =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-agent-secret")?.trim() ||
    "";
  const query = opts.allowQuery ? req.nextUrl.searchParams.get("secret") || "" : "";
  const given = header || query;
  if (!given || !safeEqual(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * 共有秘密鍵が正しいかを真偽値で返す（エージェント経路と人間のセッション経路が同居する route 用）。
 * 「鍵が無い＝人間のログイン経路」と判断したい場合だけ使う。拒否のレスポンスは呼び出し側で作る。
 */
export function hasValidSharedSecret(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // fail-closed: env が無ければエージェントとして扱わない
  const given =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-agent-secret")?.trim() ||
    "";
  return !!given && safeEqual(given, expected);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
