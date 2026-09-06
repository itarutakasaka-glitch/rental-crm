import { createHmac, timingSafeEqual } from "node:crypto";

// implementation-spec-v1.md §3 / architecture-v2.md §10 A-5:
// Resend の webhook は svix 形式で署名される。共有秘密鍵（誰でも同じ値を送れば通る）より、
// 送信元固有の署名検証のほうが強い。svix パッケージを足さずに自前で検証する
// （HMAC-SHA256 だけなので依存を増やす価値がない）。
//
// 有効化の条件: Vercel env に `RESEND_WEBHOOK_SECRET`（Resend ダッシュボードの
// signing secret、`whsec_` で始まる）を登録する。未登録の間は呼び出し側が
// 従来の共有秘密鍵にフォールバックする（移行期間）。

const TOLERANCE_SEC = 300; // リプレイ防止（±5分）

export type SvixVerifyResult = { ok: boolean; reason?: string };

export type SvixHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export function readSvixHeaders(req: Request): SvixHeaders {
  const h = req.headers;
  return {
    id: h.get("svix-id") || h.get("webhook-id"),
    timestamp: h.get("svix-timestamp") || h.get("webhook-timestamp"),
    signature: h.get("svix-signature") || h.get("webhook-signature"),
  };
}

export function verifySvixSignature(opts: {
  secret: string;
  headers: SvixHeaders;
  rawBody: string;
  nowSec?: number;
}): SvixVerifyResult {
  const { id, timestamp, signature } = opts.headers;
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing svix headers" };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad timestamp" };
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TOLERANCE_SEC) return { ok: false, reason: "timestamp out of tolerance" };

  const rawSecret = opts.secret.startsWith("whsec_") ? opts.secret.slice("whsec_".length) : opts.secret;
  let key: Buffer;
  try {
    key = Buffer.from(rawSecret, "base64");
  } catch {
    return { ok: false, reason: "bad secret" };
  }
  if (key.length === 0) return { ok: false, reason: "bad secret" };

  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${opts.rawBody}`).digest("base64");

  // 署名ヘッダは "v1,<base64> v1,<base64>" 形式（鍵ローテーション中は複数）
  for (const part of signature.split(" ")) {
    const idx = part.indexOf(",");
    if (idx < 0) continue;
    const version = part.slice(0, idx);
    const value = part.slice(idx + 1);
    if (version !== "v1" || !value) continue;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true };
  }
  return { ok: false, reason: "signature mismatch" };
}
