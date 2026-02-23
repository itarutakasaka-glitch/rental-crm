import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { keepId, removeId } = await request.json();
    if (!keepId || !removeId) return NextResponse.json({ error: "Missing keepId or removeId" }, { status: 400 });
    if (keepId === removeId) return NextResponse.json({ error: "Cannot merge same customer" }, { status: 400 });

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { organizationId: true },
    });
    if (!dbUser?.organizationId) return NextResponse.json({ error: "No org" }, { status: 400 });

    const keep = await prisma.customer.findUnique({ where: { id: keepId } });
    const remove = await prisma.customer.findUnique({ where: { id: removeId } });
    if (!keep || !remove) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if (keep.organizationId !== dbUser.organizationId || remove.organizationId !== dbUser.organizationId) {
      return NextResponse.json({ error: "Not in same org" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      // Move messages
      await tx.message.updateMany({
        where: { customerId: removeId },
        data: { customerId: keepId },
      });

      // Move inquiry properties
      await tx.inquiryProperty.updateMany({
        where: { customerId: removeId },
        data: { customerId: keepId },
      });

      // Move workflow runs
      await tx.workflowRun.updateMany({
        where: { customerId: removeId },
        data: { customerId: keepId },
      });

      // Fill in missing fields on keep from remove
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

      // Delete removed customer
      await tx.customer.delete({ where: { id: removeId } });
    });

    return NextResponse.json({ success: true, keepId, removedId: removeId });
  } catch (e: any) {
    console.error("[POST /api/customers/merge]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
