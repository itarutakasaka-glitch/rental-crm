import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser, requireAdminUser } from "@/lib/auth";
import { logAudit, logFieldChanges } from "@/lib/audit";

// implementation-spec-v1.md §3: ユーザー管理は管理者のみ。staff 付与(全社横断アクセス)は最重要操作なので
// 必ず監査ログに残す。更新対象は自組織のユーザーに限る。
export async function GET() {
  try {
    const r = await requireUser();
    if ("error" in r) return r.error;
    const staff = await prisma.user.findMany({
      where: { organizationId: r.user.organizationId },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true, isStaff: true },
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
    const r = await requireAdminUser();
    if ("error" in r) return r.error;
    const { name, email, role, avatarUrl } = await request.json();
    if (!name || !email) return NextResponse.json({ error: "名前とメールは必須です" }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 409 });

    const staff = await prisma.user.create({
      data: { name, email, role: role || "MEMBER", avatarUrl: avatarUrl || null, organizationId: r.user.organizationId },
    });
    await logAudit({ userId: r.user.id, organizationId: r.user.organizationId, action: "staff.create", field: staff.id, newValue: `${name} <${email}> ${role || "MEMBER"}` });
    return NextResponse.json(staff, { status: 201 });
  } catch (e: any) {
    console.error("[POST /api/staff]", e);
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const r = await requireAdminUser();
    if ("error" in r) return r.error;
    const { id, name, email, role, avatarUrl, isStaff } = await request.json();
    if (!id) return NextResponse.json({ error: "IDは必須です" }, { status: 400 });

    const before = await prisma.user.findFirst({ where: { id, organizationId: r.user.organizationId }, select: { id: true, name: true, email: true, role: true, avatarUrl: true, isStaff: true } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const patch = {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(role !== undefined && { role }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(isStaff !== undefined && { isStaff }),
    };
    const updated = await prisma.user.update({ where: { id }, data: patch });

    // isStaff=trueにする時、現時点で存在する全組織へのアクセスを付与する(全社ダッシュボード。architecture-v2.md §2)
    if (isStaff === true) {
      const orgs = await prisma.organization.findMany({ select: { id: true } });
      for (const org of orgs) {
        await prisma.staffOrgAccess.upsert({
          where: { userId_organizationId: { userId: id, organizationId: org.id } },
          update: {},
          create: { userId: id, organizationId: org.id },
        });
      }
    } else if (isStaff === false) {
      await prisma.staffOrgAccess.deleteMany({ where: { userId: id } });
    }
    await logFieldChanges({ userId: r.user.id, organizationId: r.user.organizationId, action: "staff.update" }, before as any, { ...patch, targetUserId: id });
    return NextResponse.json(updated);
  } catch (e: any) {
    console.error("[PATCH /api/staff]", e);
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
