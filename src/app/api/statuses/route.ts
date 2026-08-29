import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthUserForAction } from "@/lib/auth";

// ★2026-08-30発見・修正: 全ハンドラが実在しない"org_default"という文字列IDで
// organizationIdを検索/書き込みしていた。GET は常に空配列を返し、POSTは
// どの組織にも属さない孤立レコードを作り続けていた(cron/workflowのorg_defaultバグと同型)。
export async function GET() {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const statuses = await prisma.status.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(statuses);
  } catch (e) {
    console.error("[GET /api/statuses]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { name, color, order, systemCategory } = await request.json();
    if (!name) return NextResponse.json({ error: "名前は必須です" }, { status: 400 });
    const count = await prisma.status.count({ where: { organizationId: user.organizationId } });
    if (count >= 20) return NextResponse.json({ error: "ステータスは最大20個です" }, { status: 400 });
    const status = await prisma.status.create({
      data: {
        name,
        color: color || "#6B7280",
        order: order ?? count,
        organizationId: user.organizationId,
        ...(systemCategory !== undefined && { systemCategory }),
      },
    });
    return NextResponse.json(status, { status: 201 });
  } catch (e: any) {
    console.error("[POST /api/statuses]", e);
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, name, color, systemCategory } = await request.json();
    if (!id) return NextResponse.json({ error: "IDは必須です" }, { status: 400 });
    const updated = await prisma.status.updateMany({
      where: { id, organizationId: user.organizationId },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(systemCategory !== undefined && { systemCategory }),
      },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    console.error("[PATCH /api/statuses]", e);
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { orders } = await request.json();
    if (!orders || !Array.isArray(orders)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
    await Promise.all(
      orders.map((item: { id: string; order: number }) =>
        prisma.status.updateMany({ where: { id: item.id, organizationId: user.organizationId }, data: { order: item.order } })
      )
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[PUT /api/statuses]", e);
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "IDは必須です" }, { status: 400 });
    const status = await prisma.status.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!status) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (status.isDefault) return NextResponse.json({ error: "デフォルトステータスは削除できません" }, { status: 400 });
    await prisma.status.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[DELETE /api/statuses]", e);
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
