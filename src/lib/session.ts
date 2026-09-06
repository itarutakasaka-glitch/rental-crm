import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// 2026-09-06: Supabase Auth からの移行。ログイン状態をDBのSessionで持つ。
// Cookie にはランダムな32バイトのトークン、DB にはその SHA-256 だけを保存する。
// DB が漏れてもそのままログインできるトークンにはならない。
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
// 有効期限の残りがこれを下回ったら延長する（毎リクエスト書き込むとDBが重くなる）
const SLIDING_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function createSession(userId: string, meta?: { ip?: string | null; userAgent?: string | null }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ip: meta?.ip || null,
      userAgent: meta?.userAgent?.slice(0, 300) || null,
    },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
  return { token, expiresAt };
}

/** Cookie のセッションを検証して userId を返す。無効なら null。 */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    // 期限切れは掃除しておく（残しても意味がない）
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // 使われている間は有効期限を延ばす。Server Component からは Cookie を書けないので
  // 失敗しても無視する（次に Route Handler を通ったときに延びる）。
  if (session.expiresAt.getTime() - Date.now() < SLIDING_THRESHOLD_MS) {
    const expiresAt = new Date(Date.now() + SESSION_MS);
    await prisma.session.update({ where: { id: session.id }, data: { expiresAt, lastSeenAt: new Date() } }).catch(() => {});
    try {
      store.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
    } catch {
      /* Server Component では書けない */
    }
  }
  return session.userId;
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => {});
  }
  try {
    store.set(SESSION_COOKIE, "", { ...cookieOptions(new Date(0)), maxAge: 0 });
  } catch {
    /* ignore */
  }
}

/** そのユーザーの全セッションを無効化する（パスワード変更・退職時）。 */
export async function destroyAllSessionsForUser(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}
