import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/session";
import { appBaseUrl } from "@/lib/template-vars";

// パスワード設定・再設定の一回限りトークン。
// Cookie と同じ方針で、DB には SHA-256 だけを保存する。
const RESET_TTL_MS = 60 * 60 * 1000; // 1時間

export async function createPasswordResetToken(userId: string) {
  // 同じユーザーの未使用トークンは無効化する（最後に発行したものだけ有効）
  await prisma.passwordReset.deleteMany({ where: { userId, usedAt: null } });
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  await prisma.passwordReset.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  return { token, expiresAt, url: `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}` };
}

export async function consumePasswordResetToken(token: string) {
  const row = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) return null;
  await prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.userId;
}

export async function sendPasswordResetEmail(to: string, name: string, url: string, isFirstTime: boolean) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "RESEND_API_KEY が未設定" };
  const from = process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com";
  const subject = isFirstTime ? "【heyacules cloud】パスワード設定のご案内" : "【heyacules cloud】パスワード再設定のご案内";
  const lead = isFirstTime
    ? "heyacules cloud のアカウントが作成されました。下のボタンからパスワードを設定してください。"
    : "パスワード再設定のリクエストを受け付けました。下のボタンから新しいパスワードを設定してください。";
  const html = `<div style="font-family:'Noto Sans JP',sans-serif;line-height:1.8;color:#1a1a1a">
<p>${name} 様</p>
<p>${lead}</p>
<p style="margin:24px 0"><a href="${url}" style="display:inline-block;padding:12px 28px;background:#d4a017;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">パスワードを設定する</a></p>
<p style="font-size:12px;color:#6b6b6b">このリンクは1時間で無効になります。ボタンが押せない場合は次のURLをブラウザに貼り付けてください。<br>${url}</p>
<p style="font-size:12px;color:#6b6b6b">心当たりが無い場合は、このメールを破棄してください。パスワードは変更されません。</p>
</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `heyacules cloud <${from}>`, to: [to], subject, html }),
    });
    if (!res.ok) return { ok: false, reason: `Resend ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "send failed" };
  }
}
