import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser, canAccessOrg } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// 名寄せ(2顧客の統合)。implementation-spec-v1.md §3: 両顧客が同じ会社で、かつ操作者がその会社に
// アクセスできる(staff 横断を含む)ことを確認。統合は監査ログに必ず残す(削除を伴うため)。
export async function POST(request: NextRequest) {
  try {
    const r = await requireUser();
    if ("error" in r) return r.error;

    const { keepId, removeId } = await request.json();
    if (!keepId || !removeId) return NextResponse.json({ error: "Missing keepId or removeId" }, { status: 400 });
    if (keepId === removeId) return NextResponse.json({ error: "Cannot merge same customer" }, { status: 400 });

    const keep = await prisma.customer.findUnique({ where: { id: keepId } });
    const remove = await prisma.customer.findUnique({ where: { id: removeId } });
    if (!keep || !remove) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if (keep.organizationId !== remove.organizationId) return NextResponse.json({ error: "Not in same org" }, { status: 400 });
    if (!canAccessOrg(r.user, keep.organizationId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.$transaction(async (tx) => {
      await tx.message.updateMany({ where: { customerId: removeId }, data: { customerId: keepId } });
      await tx.inquiryProperty.updateMany({ where: { customerId: removeId }, data: { customerId: keepId } });
      await tx.workflowRun.updateMany({ where: { customerId: removeId }, data: { customerId: keepId } });
      await tx.customerRecord.updateMany({ where: { customerId: removeId }, data: { customerId: keepId } });
      await tx.schedule.updateMany({ where: { customerId: removeId }, data: { customerId: keepId } });
      await tx.auditLog.updateMany({ where: { customerId: removeId }, data: { customerId: keepId } });

      const updates: Record<string, any> = {};
      if (!keep.email && remove.email) updates.email = remove.email;
      if (!keep.phone && remove.phone) updates.phone = remove.phone;
      if (!keep.nameKana && remove.nameKana) updates.nameKana = remove.nameKana;
      if (!keep.lineUserId && remove.lineUserId) {
        updates.lineUserId = remove.lineUserId;
        updates.lineDisplayName = remove.lineDisplayName;
        updates.lineLinkedAt = remove.lineLinkedAt;
      }
      if (!keep.sourcePortal && remove.sourcePortal) updates.sourcePortal = remove.sourcePortal;
      if (!keep.memo && remove.memo) updates.memo = remove.memo;
      if (Object.keys(updates).length > 0) {
        await tx.customer.update({ where: { id: keepId }, data: updates });
      }
      await tx.customer.delete({ where: { id: removeId } });
    });

    await logAudit({
      customerId: keepId, userId: r.user.id, organizationId: keep.organizationId, action: "customer.merge",
      field: "removedCustomerId", oldValue: `${removeId} ${remove.name} ${remove.email || ""} ${remove.phone || ""}`, newValue: keepId,
    });

    return NextResponse.json({ success: true, keepId, removedId: removeId });
  } catch (e: any) {
    console.error("[POST /api/customers/merge]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
