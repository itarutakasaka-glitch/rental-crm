import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const dbUser = await prisma.user.findUnique({ where: { email: user.email! }, select: { organizationId: true } });
    if (!dbUser) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const staff = await prisma.user.findMany({
      where: { organizationId: dbUser.organizationId! },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(staff);
  } catch (e) {
    console.error("[GET /api/staff]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const dbUser = await prisma.user.findUnique({ where: { email: user.email! }, select: { organizationId: true, role: true } });
    if (!dbUser || dbUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { name, email, role, avatarUrl } = await request.json();
    if (!name || !email) return NextResponse.json({ error: "名前とメールは必須です" }, { status: 400 });

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 409 });

    const staff = await prisma.user.create({
      data: {
        name,
        email,
        role: role || "MEMBER",
        avatarUrl: avatarUrl || null,
        organizationId: dbUser.organizationId!,
      },
    });
    return NextResponse.json(staff, { status: 201 });
  } catch (e: any) {
    console.error("[POST /api/staff]", e);
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const dbUser = await prisma.user.findUnique({ where: { email: user.email! }, select: { organizationId: true, role: true } });
    if (!dbUser || dbUser.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id, name, email, role, avatarUrl } = await request.json();
    if (!id) return NextResponse.json({ error: "IDは必須です" }, { status: 400 });
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(role !== undefined && { role }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    console.error("[PATCH /api/staff]", e);
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}