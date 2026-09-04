import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { resolveSingleOrgOrNull } from "@/lib/resolve-single-org";

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

export async function getCurrentUser(): Promise<AuthUser> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { organization: true },
  });

  if (!dbUser) {
    // Auto-create user on first login
    // TODO: 招待制が無いため、組織が1社しか無い間だけ自動でその組織に割り当てる。
    // 2社以上になったら「最初の1社」に誤って割り当てる事故を防ぐため失敗させる
    // (招待リンク等でorganizationIdを明示指定する仕組みが必要)。
    const org = await resolveSingleOrgOrNull();
    if (!org) throw new Error("所属組織を自動判定できません。管理者にユーザー登録を依頼してください。");

    dbUser = await prisma.user.create({
      data: {
        email: user.email!,
        name: user.email!.split("@")[0],
        organizationId: org.id,
      },
      include: { organization: true },
    });
  }

  return toAuthUser(dbUser);
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      include: { organization: true },
    });
    if (!dbUser) return null;
    return toAuthUser(dbUser);
  } catch (e) { return null; }
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
