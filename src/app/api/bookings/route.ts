import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";

// implementation-spec-v1.md §2.5 (M-6): 担当者向けの予約一覧。
// 未確定(PENDING)の予約を拾って、詳細画面や受信トレイで「確定させる」導線に使う。
export async function GET(req: NextRequest) {
  const r = await requireUser();
  if ("error" in r) return r.error;

  const customerId = req.nextUrl.searchParams.get("customerId");
  const status = req.nextUrl.searchParams.get("status"); // 既定は PENDING のみ

  const bookings = await prisma.storeVisitBooking.findMany({
    where: {
      organizationId: r.user.organizationId,
      ...(customerId ? { customerId } : {}),
      ...(status === "ALL" ? {} : { status: (status as any) || "PENDING" }),
    },
    orderBy: [{ visitDate: "asc" }, { visitTime: "asc" }],
    take: 200,
    include: {
      store: { select: { id: true, name: true } },
      confirmedByUser: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ bookings });
}
