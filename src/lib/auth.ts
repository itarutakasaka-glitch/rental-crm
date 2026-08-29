import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { resolveSingleOrgOrNull } from "@/lib/resolve-single-org";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MEMBER";
  organizationId: string;
  organizationName: string;
};

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

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as "ADMIN" | "MEMBER",
    organizationId: dbUser.organizationId,
    organizationName: dbUser.organization.name,
  };
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
    return {
      id: dbUser.id, email: dbUser.email, name: dbUser.name,
      role: dbUser.role as "ADMIN" | "MEMBER",
      organizationId: dbUser.organizationId, organizationName: dbUser.organization.name,
    };
  } catch (e) { return null; }
}
