import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MEMBER";
  organizationId: string;
  organizationName: string;
  isStaff: boolean;
  staffOrgs: { id: string; name: string }[]; // isStaff=trueの場合、横断アクセスできる組織一覧
};

async function toAuthUser(dbUser: any): Promise<AuthUser> {
  let staffOrgs: { id: string; name: string }[] = [];
  if (dbUser.isStaff) {
    const accesses = await prisma.staffOrgAccess.findMany({
      where: { userId: dbUser.id },
      include: { organization: { select: { id: true, name: true } } },
    });
    staffOrgs = accesses.map((a) => a.organization);
  }
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as "ADMIN" | "MEMBER",
    organizationId: dbUser.organizationId,
    organizationName: dbUser.organization.name,
    isStaff: dbUser.isStaff,
    staffOrgs,
  };
}

// 2026-09-06: Supabase Auth から自前認証（lib/session.ts）へ移行。
// User テーブルが唯一の正本なので、旧実装にあった「初回ログイン時に自動でユーザーを作る」
// 処理は廃止した（2社目で誤った組織に割り当てる事故の温床だった）。
// ユーザーは管理者が /settings/staff から登録する。
export async function getCurrentUser(): Promise<AuthUser> {
  const user = await getAuthUserForAction();
  if (!user) redirect("/login");
  return user;
}

// アクセス境界の判定を1箇所に集約(architecture-v2.md §2)。
// ページ・API route・server actionすべてこれを通す。
export function canAccessOrg(user: AuthUser, organizationId: string): boolean {
  if (user.organizationId === organizationId) return true;
  if (user.isStaff && user.staffOrgs.some((o) => o.id === organizationId)) return true;
  return false;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user.role !== "ADMIN") redirect("/customers");
  return user;
}

export async function getAuthUserForAction(): Promise<AuthUser | null> {
  try {
    const userId = await getSessionUserId();
    if (!userId) return null;
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    if (!dbUser) return null;
    return toAuthUser(dbUser);
  } catch (e) {
    return null;
  }
}

// architecture-v2.md §10 S-1: API routeの「所属チェック忘れ＝他社データ漏えい」を構造的に防ぐ。
// 顧客IDを受け取るrouteは必ず requireCustomerAccess() を通し、返ってきた error をそのまま返す。
// (ログイン確認だけのmiddlewareでは「どの会社の顧客か」は判定できない)
export type Denied = { error: NextResponse };

export async function requireUser(): Promise<{ user: AuthUser } | Denied> {
  const user = await getAuthUserForAction();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user };
}

export async function requireAdminUser(): Promise<{ user: AuthUser } | Denied> {
  const r = await requireUser();
  if ("error" in r) return r;
  if (r.user.role !== "ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return r;
}

export async function requireCustomerAccess(
  customerId: string
): Promise<{ user: AuthUser; customer: { id: string; organizationId: string } } | Denied> {
  const r = await requireUser();
  if ("error" in r) return r;
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, organizationId: true } });
  if (!customer) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!canAccessOrg(r.user, customer.organizationId)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user: r.user, customer };
}
