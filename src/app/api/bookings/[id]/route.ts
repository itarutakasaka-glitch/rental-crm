import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser, canAccessOrg } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { confirmBooking } from "@/lib/booking";

// implementation-spec-v1.md §2.5 (M-6):
//   confirm … 担当者が顧客に連絡した事実をもって確定する（confirmedBy=STAFF_CONTACT）
//   reject  … 店舗都合で受けられない（理由を残し、顧客への案内に使う）
//   cancel  … 顧客都合の取り消し
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const { id } = await params;

  const booking = await prisma.storeVisitBooking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessOrg(r.user, booking.organizationId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action, reason } = await req.json().catch(() => ({}));

  if (action === "confirm") {
    const result = await confirmBooking({ bookingId: id, by: "STAFF_CONTACT", userId: r.user.id });
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 409 });
    return NextResponse.json({ ok: true, status: "CONFIRMED" });
  }

  if (action === "reject" || action === "cancel") {
    const next = action === "reject" ? "REJECTED" : "CANCELLED";
    // 確定済みを取り消すときは、作った来店予定も消す（カレンダーに幽霊予定を残さない）
    const updated = await prisma.storeVisitBooking.updateMany({
      where: { id, status: { in: ["PENDING", "CONFIRMED"] } },
      data: { status: next as any, rejectReason: reason || null },
    });
    if (updated.count === 0) return NextResponse.json({ error: "変更できる状態ではありません" }, { status: 409 });

    if (booking.status === "CONFIRMED" && booking.customerId) {
      const from = new Date(booking.visitDate); from.setHours(0, 0, 0, 0);
      const to = new Date(from); to.setDate(to.getDate() + 1);
      await prisma.schedule.deleteMany({
        where: { customerId: booking.customerId, type: "VISIT", startAt: { gte: from, lt: to } },
      });
      await prisma.customer.update({ where: { id: booking.customerId }, data: { isBookingConfirmed: false } });
    }

    await logAudit({
      customerId: booking.customerId,
      organizationId: booking.organizationId,
      userId: r.user.id,
      action: action === "reject" ? "booking.reject" : "booking.cancel",
      field: `${booking.visitDate.toISOString().slice(0, 10)} ${booking.visitTime}`,
      newValue: reason || "",
    });
    return NextResponse.json({ ok: true, status: next });
  }

  return NextResponse.json({ error: "action は confirm / reject / cancel のいずれかです" }, { status: 400 });
}
