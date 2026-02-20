import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { organizationId: true },
    });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const staff = await prisma.user.findMany({
      where: { organizationId: dbUser.organizationId },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error("[GET /api/staff] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { organizationId: true, role: true },
    });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await request.json();
    const { name, email, role } = body;
    if (!name || !email) return NextResponse.json({ error: "名前とメールは必須です" }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 409 });

    const newUser = await prisma.user.create({
      data: { name, email, role: role || "MEMBER", organizationId: dbUser.organizationId },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("[POST /api/staff] Error:", error);
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }
}