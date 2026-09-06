import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

// 2026-09-06: Supabase Auth からの移行。
// 認証そのものの入口なので middleware は通さない（公開route）。
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  // 総当たり対策。IP単位とメール単位の両方で制限する
  if (!rateLimit(`login-ip:${ip}`, 20, 60_000).ok) {
    return NextResponse.json({ error: "試行が多すぎます。しばらく待ってからお試しください" }, { status: 429 });
  }

  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "メールアドレスとパスワードを入力してください" }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!rateLimit(`login-email:${normalizedEmail}`, 10, 60_000).ok) {
    return NextResponse.json({ error: "試行が多すぎます。しばらく待ってからお試しください" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true, passwordHash: true, organizationId: true },
  });

  // 「メールが存在しない」と「パスワードが違う」を区別しない（アカウントの存在を漏らさない）
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    await logAudit({
      userId: user?.id, organizationId: user?.organizationId,
      action: "auth.login.failed", field: normalizedEmail,
      newValue: user && !user.passwordHash ? "パスワード未設定" : undefined,
    });
    // パスワード未設定（Supabaseからの移行直後）だけは案内を出す。存在の有無は漏れるが、
    // 全員が移行対象なので実害より「設定メールに気づけない」ほうが問題になる。
    if (user && !user.passwordHash) {
      return NextResponse.json(
        { error: "パスワードが未設定です。「パスワードを忘れた方」から設定してください", needsSetup: true },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません" }, { status: 401 });
  }

  await createSession(user.id, { ip, userAgent: req.headers.get("user-agent") });
  await logAudit({ userId: user.id, organizationId: user.organizationId, action: "auth.login", field: normalizedEmail });
  return NextResponse.json({ ok: true });
}
