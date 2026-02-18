import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";

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
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error("組織が見つかりません。シードデータを実行してください。");

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
  } catch { return null; }
}
