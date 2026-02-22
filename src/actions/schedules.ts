"use server";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { processAutoStatusChange } from "@/lib/status-rules";
import { checkAutoStop } from "@/actions/workflows";

export async function getSchedulesByMonth(organizationId: string, year: number, month: number) {
  const start = new Date(year, month - 1, 1); start.setDate(start.getDate() - start.getDay());
  const end = new Date(year, month, 0); end.setDate(end.getDate() + (6 - end.getDay())); end.setHours(23, 59, 59);
  return prisma.schedule.findMany({
    where: { organizationId, startAt: { gte: start, lte: end } },
    include: { customer: { select: { id: true, name: true } }, user: { select: { id: true, name: true } } },
    orderBy: { startAt: "asc" },
  });
}

export async function createSchedule(data: {
  organizationId: string; userId?: string; customerId?: string; title: string; description?: string;
  type: "VISIT"|"VIEWING"|"CALL"|"FOLLOW_UP"|"OTHER"; startAt: Date; endAt?: Date; isAllDay?: boolean; location?: string; color?: string;
}) {
  const endAt = data.endAt || new Date(data.startAt.getTime() + 3600000);
  const schedule = await prisma.schedule.create({ data: { ...data, endAt, isAllDay: data.isAllDay || false } });
  if (data.customerId && (data.type === "VISIT" || data.type === "VIEWING")) await processAutoStatusChange(data.customerId, "VISIT_RESERVED");
  revalidatePath("/schedule");
  return schedule;
}

export async function updateSchedule(id: string, data: {
  title?: string; description?: string;
  type?: "VISIT"|"VIEWING"|"CALL"|"FOLLOW_UP"|"CONTRACT"|"OTHER";
  startAt?: Date; endAt?: Date; isAllDay?: boolean;
  location?: string; color?: string; userId?: string | null; customerId?: string | null;
}) {
  const schedule = await prisma.schedule.update({ where: { id }, data });
  revalidatePath("/schedule");
  return schedule;
}

export async function deleteSchedule(id: string) {
  await prisma.schedule.delete({ where: { id } });
  revalidatePath("/schedule");
}

export async function completeVisit(scheduleId: string) {
  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) throw new Error("スケジュールが見つかりません");
  if (schedule.customerId) {
    await processAutoStatusChange(schedule.customerId, "VISIT_COMPLETED");
    await checkAutoStop(schedule.customerId, "VISIT");
  }
  revalidatePath("/schedule");
}
