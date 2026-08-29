import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthUserForAction, canAccessOrg } from "@/lib/auth";

// architecture-v2.md §9(穴#16): 二重対応防止ロック。
// 詳細画面を開いている間、フロント側が一定間隔でPOSTしてロックを保持(ハートビート)する。
// ロックは LOCK_STALE_MS を過ぎると自動失効し、他オペが取得できる(異常終了・タブを閉じた場合の救済)。
const LOCK_STALE_MS = 90_000;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { organizationId: true, lockedByUserId: true, lockedAt: true, lockedByUser: { select: { id: true, name: true } } },
    });
    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!canAccessOrg(user, customer.organizationId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const isStale = !customer.lockedAt || Date.now() - customer.lockedAt.getTime() > LOCK_STALE_MS;
    const isOwnLock = customer.lockedByUserId === user.id;

    if (!isOwnLock && !isStale) {
      // 他人が今まさに対応中。ロックは奪わず、誰が持っているかだけ返す(画面にバナー表示させる)。
      return NextResponse.json(
        { locked: true, lockedBy: customer.lockedByUser?.name || null, lockedAt: customer.lockedAt },
        { status: 409 }
      );
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: { lockedByUserId: user.id, lockedAt: new Date() },
      select: { lockedByUserId: true, lockedAt: true },
    });
    return NextResponse.json({ locked: false, lockedByUserId: updated.lockedByUserId, lockedAt: updated.lockedAt });
  } catch (e) {
    console.error("[POST /api/customers/[id]/lock]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // 自分のロックしか解除できない(他人のロックを外側から奪えないように)。
    await prisma.customer.updateMany({
      where: { id, lockedByUserId: user.id },
      data: { lockedByUserId: null, lockedAt: null },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/customers/[id]/lock]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
