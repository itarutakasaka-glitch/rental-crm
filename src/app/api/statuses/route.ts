import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const statuses = await prisma.status.findMany({
      where: { organizationId: "org_default" },
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { name, color, order } = await request.json();
    if (!name) return NextResponse.json({ error: "名前は必須です" }, { status: 400 });
    const count = await prisma.status.count({ where: { organizationId: "org_default" } });
    if (count >= 20) return NextResponse.json({ error: "ステータスは最大20個です" }, { status: 400 });
    const status = await prisma.status.create({
      data: { name, color: color || "#6B7280", order: order ?? count, organizationId: "org_default" },
    });
    return NextResponse.json(status, { status: 201 });
  } catch (e: any) {
    console.error("[POST /api/statuses]", e);
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, name, color } = await request.json();
    if (!id) return NextResponse.json({ error: "IDは必須です" }, { status: 400 });
    const updated = await prisma.status.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { orders } = await request.json();
    if (!orders || !Array.isArray(orders)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
    await Promise.all(
      orders.map((item: { id: string; order: number }) =>
        prisma.status.update({ where: { id: item.id }, data: { order: item.order } })
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "IDは必須です" }, { status: 400 });
    const status = await prisma.status.findUnique({ where: { id } });
    if (status?.isDefault) return NextResponse.json({ error: "デフォルトステータスは削除できません" }, { status: 400 });
    await prisma.status.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[DELETE /api/statuses]", e);
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}