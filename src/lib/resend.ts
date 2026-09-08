import { Resend } from "resend";

// 2026-09-08: モジュール読み込み時に `new Resend(process.env.RESEND_API_KEY)` していたため、
// キーが未設定の環境では **import しただけで例外**になっていた
// （CI のビルドが "Failed to collect page data for /api/agent/send" で落ちて発覚）。
// 本番で env が欠けた場合も同じで、原因の分からない 500 になる。
// 実際に送る直前に作り、未設定なら null を返して呼び出し側が扱えるようにする。
let cached: Resend | null = null;

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

/** 送信元アドレス。未設定なら既定値。 */
export function resendFrom(): string {
  return process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com";
}
