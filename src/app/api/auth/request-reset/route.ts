import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createPasswordResetToken, sendPasswordResetEmail } from "@/lib/password-reset";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

// パスワード設定・再設定メールの送信。
// **アカウントの有無に関わらず同じ応答を返す**（存在確認に使われないように）。
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`reset-ip:${ip}`, 5, 60_000).ok) {
    return NextResponse.json({ error: "リクエストが多すぎます。しばらく待ってからお試しください" }, { status: 429 });
  }
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "メールアドレスを入力してください" }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!rateLimit(`reset-email:${normalizedEmail}`, 3, 10 * 60_000).ok) {
    return NextResponse.json({ ok: true }); // 連投しても同じ応答（存在を漏らさない）
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true, email: true, passwordHash: true, organizationId: true },
  });

  if (user) {
    const { url } = await createPasswordResetToken(user.id);
    const sent = await sendPasswordResetEmail(user.email, user.name, url, !user.passwordHash);
    await logAudit({
      userId: user.id, organizationId: user.organizationId,
      action: "auth.password.resetRequested", field: normalizedEmail,
      newValue: sent.ok ? "sent" : `failed: ${sent.reason}`,
    });
    if (!sent.ok) console.error("[auth] reset mail failed:", sent.reason);
  }
  return NextResponse.json({ ok: true });
}
