import { getCurrentUser } from "@/lib/auth";
import { getSchedulesByMonth } from "@/actions/schedules";
import { prisma } from "@/lib/db/prisma";
import { CalendarView } from "@/components/schedule/calendar-view";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string }> }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const now = new Date();
  const year = parseInt(params.year || String(now.getFullYear()));
  const month = parseInt(params.month || String(now.getMonth() + 1));
  const schedules = await getSchedulesByMonth(user.organizationId, year, month);
  const customers = await prisma.customer.findMany({ where: { organizationId: user.organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 200 });
  return <CalendarView schedules={schedules} customers={customers} currentUser={user} initialYear={year} initialMonth={month} />;
}
