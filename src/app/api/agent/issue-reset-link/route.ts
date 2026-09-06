import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifySharedSecret } from "@/lib/shared-secret";
import { createPasswordResetToken } from "@/lib/password-reset";
import { logAudit } from "@/lib/audit";

// 管理用の緊急口。メール送信が失敗する・届かない場合に、パスワード設定リンクを
// その場で発行して返す（メールを経由しない）。共有秘密鍵で保護。
// **発行は必ず監査ログに残す**（誰かのアカウントを乗っ取れる操作のため）。
export async function POST(req: NextRequest) {
  const denied = verifySharedSecret(req);
  if (denied) return denied;

  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true, email: true, organizationId: true, passwordHash: true },
  });
  if (!user) return NextResponse.json({ error: `user not found: ${normalizedEmail}` }, { status: 404 });

  const { url, expiresAt } = await createPasswordResetToken(user.id);
  await logAudit({
    userId: user.id, organizationId: user.organizationId,
    action: "auth.password.linkIssued", field: normalizedEmail, newValue: "admin API",
  });
  return NextResponse.json({
    email: user.email,
    name: user.name,
    hasPassword: !!user.passwordHash,
    url,
    expiresAt,
  });
}
