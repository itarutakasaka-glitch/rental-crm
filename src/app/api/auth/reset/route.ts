import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, validatePassword } from "@/lib/password";
import { consumePasswordResetToken } from "@/lib/password-reset";
import { destroyAllSessionsForUser, createSession } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

// 一回限りトークンで新しいパスワードを設定する。
// 設定したら**そのユーザーの既存セッションを全て無効化**する（乗っ取られていた場合に追い出す）。
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`reset-submit:${ip}`, 10, 60_000).ok) {
    return NextResponse.json({ error: "試行が多すぎます。しばらく待ってからお試しください" }, { status: 429 });
  }
  const { token, password } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "リンクが正しくありません" }, { status: 400 });
  }
  const invalid = validatePassword(password);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    return NextResponse.json({ error: "リンクの有効期限が切れているか、既に使用されています" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
    select: { id: true, email: true, organizationId: true },
  });
  await destroyAllSessionsForUser(userId);
  await logAudit({ userId: user.id, organizationId: user.organizationId, action: "auth.password.reset", field: user.email });

  // そのままログイン状態にする（設定直後にもう一度入力させない）
  await createSession(user.id, { ip, userAgent: req.headers.get("user-agent") });
  return NextResponse.json({ ok: true });
}
