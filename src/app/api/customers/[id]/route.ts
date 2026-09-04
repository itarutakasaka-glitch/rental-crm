import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireCustomerAccess } from "@/lib/auth";
import { logAudit, logFieldChanges } from "@/lib/audit";

// architecture-v2.md §10 S-1: 以前は認証も所属チェックも無く、ログイン済みなら顧客IDを指定して
// 他社の顧客を読める・書き換えられた(IDOR)。requireCustomerAccess を必ず通す。
const EDITABLE = ["statusId", "isNeedAction", "assigneeId", "name", "email", "phone", "nameKana", "inquiryContent", "memo"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const r = await requireCustomerAccess(id);
    if ("error" in r) return r.error;

    const body = await request.json();
    const updateData: Record<string, unknown> = {};
    for (const k of EDITABLE) {
      if (body[k] === undefined) continue;
      updateData[k] = k === "assigneeId" ? body[k] || null : body[k];
    }
    // 担当者は同じ会社のユーザーに限る(他社ユーザーIDを割り当てられないように)
    if (updateData.assigneeId) {
      const assignee = await prisma.user.findFirst({ where: { id: String(updateData.assigneeId), organizationId: r.customer.organizationId }, select: { id: true } });
      const staff = assignee ? null : await prisma.staffOrgAccess.findFirst({ where: { userId: String(updateData.assigneeId), organizationId: r.customer.organizationId }, select: { id: true } });
      if (!assignee && !staff) return NextResponse.json({ error: "assigneeId is not a member of this organization" }, { status: 400 });
    }
    // ステータスも同じ会社のものに限る
    if (updateData.statusId) {
      const st = await prisma.status.findFirst({ where: { id: String(updateData.statusId), organizationId: r.customer.organizationId }, select: { id: true } });
      if (!st) return NextResponse.json({ error: "statusId does not belong to this organization" }, { status: 400 });
    }

    const before = await prisma.customer.findUnique({
      where: { id },
      select: { statusId: true, isNeedAction: true, assigneeId: true, name: true, email: true, phone: true, nameKana: true, inquiryContent: true, memo: true },
    });
    const updated = await prisma.customer.update({
      where: { id },
      data: updateData,
      select: {
        id: true, statusId: true, isNeedAction: true, assigneeId: true,
        status: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true } },
      },
    });
    await logFieldChanges({ customerId: id, userId: r.user.id, action: "customer.update" }, (before || {}) as any, updateData);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/customers/[id]] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const r = await requireCustomerAccess(id);
    if ("error" in r) return r.error;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        status: true,
        properties: true,
        assignee: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, direction: true, channel: true, subject: true, body: true, status: true, openedAt: true, openCount: true, createdAt: true, sender: { select: { id: true, name: true } } },
        },
      },
    });
    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await logAudit({ customerId: id, userId: r.user.id, action: "customer.view" });
    return NextResponse.json(customer);
  } catch (error) {
    console.error("[GET /api/customers/[id]] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
