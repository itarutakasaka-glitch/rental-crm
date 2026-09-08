import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit";
import { isStoreOpen } from "@/lib/store-routing/closed-days";
import { checkAvailability, parseHHMM, type Slot } from "@/lib/schedule-slots";

// implementation-spec-v1.md §2.5 (M-6) / §6.2 (M-10)
//
// 予約を入れた時点では確定しない。確定の仕方は店舗の状態で2つに分かれる:
//   連動あり … 空き照会して空いていれば即時確定（confirmedBy=SCHEDULE_LINK）
//   連動なし … 未確定のまま受け付け、担当者が連絡した事実で確定（confirmedBy=STAFF_CONTACT）
// 確定してはじめて Schedule(VISIT) を作り、追客を止め、isBookingConfirmed を立てる。

/** 予約の日時を Date に組み立てる。visitDate は日付のみ、visitTime は "14:00"。 */
export function bookingStartEnd(visitDate: Date, visitTime: string, slotMinutes = 60): { startAt: Date; endAt: Date } {
  const mins = parseHHMM(visitTime) ?? 0;
  const startAt = new Date(visitDate);
  startAt.setHours(0, 0, 0, 0);
  startAt.setMinutes(mins);
  const endAt = new Date(startAt.getTime() + slotMinutes * 60_000);
  return { startAt, endAt };
}

// 判別子は文字列にする（strict:false では boolean リテラルで絞り込めない）
export type LinkState =
  | { kind: "unlinked"; reason: string }
  | { kind: "linked"; slotMinutes: number; hoursStart: string; hoursEnd: string; provider: string };

/**
 * その店舗が「連動あり」かを判断する。
 * 連動先が失敗中（lastErrorAt が直近）なら連動なし扱いにする。黙って確定にしないため。
 */
export async function getScheduleLinkState(
  storeId: string | null | undefined,
  fallback: { hoursStart: string; hoursEnd: string }
): Promise<LinkState> {
  if (!storeId) return { kind: "unlinked", reason: "店舗が特定できていません" };
  const link = await prisma.storeScheduleLink.findUnique({ where: { storeId } });
  if (!link || !link.isActive) return { kind: "unlinked", reason: "店舗スケジュール連動が未設定です" };
  if (link.lastErrorAt && Date.now() - link.lastErrorAt.getTime() < 24 * 60 * 60 * 1000) {
    return { kind: "unlinked", reason: `連動先でエラーが続いています: ${link.lastError || ""}` };
  }
  // INTERNAL 以外は接続実装が入るまで「連動なし」（勝手に確定にしない）
  if (link.provider !== "INTERNAL") {
    return { kind: "unlinked", reason: `${link.provider} との連動は未実装です` };
  }
  return {
    kind: "linked",
    provider: link.provider,
    slotMinutes: link.slotMinutes,
    hoursStart: link.hoursStart || fallback.hoursStart,
    hoursEnd: link.hoursEnd || fallback.hoursEnd,
  };
}

/** その日にすでに入っている来店予定（分単位）を集める。 */
export async function busySlotsOfDay(organizationId: string, storeId: string | null, day: Date, slotMinutes: number): Promise<Slot[]> {
  const from = new Date(day); from.setHours(0, 0, 0, 0);
  const to = new Date(from); to.setDate(to.getDate() + 1);

  // 店舗ごとの予定は「その店舗の顧客の来店予定」で数える（Schedule に storeId が無いため）
  const schedules = await prisma.schedule.findMany({
    where: {
      organizationId,
      type: "VISIT",
      startAt: { gte: from, lt: to },
      ...(storeId ? { customer: { storeId } } : {}),
    },
    select: { startAt: true, endAt: true },
  });
  return schedules.map((s) => {
    const start = s.startAt.getHours() * 60 + s.startAt.getMinutes();
    const end = s.endAt ? s.endAt.getHours() * 60 + s.endAt.getMinutes() : start + slotMinutes;
    return { start, end: Math.max(end, start + 1) };
  });
}

/** 連動ありの店舗で、その希望時刻を受けられるか。 */
export async function checkStoreAvailability(params: {
  organizationId: string;
  storeId: string;
  visitDate: Date;
  visitTime: string;
  slotMinutes: number;
  hoursStart: string;
  hoursEnd: string;
}) {
  const dateStr = `${params.visitDate.getFullYear()}-${String(params.visitDate.getMonth() + 1).padStart(2, "0")}-${String(params.visitDate.getDate()).padStart(2, "0")}`;
  const [isOpen, busy] = await Promise.all([
    isStoreOpen(params.storeId, dateStr),
    busySlotsOfDay(params.organizationId, params.storeId, params.visitDate, params.slotMinutes),
  ]);
  return checkAvailability({
    visitTime: params.visitTime,
    hoursStart: params.hoursStart,
    hoursEnd: params.hoursEnd,
    slotMinutes: params.slotMinutes,
    busy,
    isOpen,
  });
}

/**
 * 予約を確定する。Schedule(VISIT) の作成・追客停止・isBookingConfirmed をここでまとめて行う。
 * 二重確定を避けるため、PENDING の行だけを更新する（updateMany の件数で判定）。
 */
export async function confirmBooking(params: {
  bookingId: string;
  by: "SCHEDULE_LINK" | "STAFF_CONTACT";
  userId?: string | null;
  slotMinutes?: number;
}): Promise<{ ok: boolean; reason?: string }> {
  const booking = await prisma.storeVisitBooking.findUnique({ where: { id: params.bookingId } });
  if (!booking) return { ok: false, reason: "予約が見つかりません" };
  if (booking.status === "CONFIRMED") return { ok: false, reason: "すでに確定しています" };
  if (booking.status !== "PENDING") return { ok: false, reason: "確定できる状態ではありません" };

  const updated = await prisma.storeVisitBooking.updateMany({
    where: { id: booking.id, status: "PENDING" },
    data: { status: "CONFIRMED", confirmedBy: params.by, confirmedAt: new Date(), confirmedByUserId: params.userId || null },
  });
  if (updated.count === 0) return { ok: false, reason: "他の操作で状態が変わりました" };

  const { startAt, endAt } = bookingStartEnd(booking.visitDate, booking.visitTime, params.slotMinutes ?? 60);
  await prisma.schedule.create({
    data: {
      organizationId: booking.organizationId,
      customerId: booking.customerId,
      title: `${booking.name} - 来店`,
      description: `${booking.visitMethod ? booking.visitMethod + "\n" : ""}${booking.memo || ""}`,
      type: "VISIT",
      startAt,
      endAt,
    },
  });

  if (booking.customerId) {
    await prisma.customer.update({
      where: { id: booking.customerId },
      data: { isBookingConfirmed: true, isNeedAction: false },
    });
    await prisma.workflowRun.updateMany({
      where: { customerId: booking.customerId, status: "RUNNING" },
      data: { status: "STOPPED_BY_VISIT" },
    });
  }

  await logAudit({
    customerId: booking.customerId,
    organizationId: booking.organizationId,
    userId: params.userId || undefined,
    action: "booking.confirm",
    field: params.by,
    newValue: `${booking.visitDate.toISOString().slice(0, 10)} ${booking.visitTime}`,
  });
  return { ok: true };
}
