import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireCustomerAccess, requireUser, canAccessOrg } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// architecture-v2.md §10 S-1: 所属チェック追加。organizationId はリクエスト本文から受けず顧客の所属を使う。
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await requireCustomerAccess(id);
    if ("error" in r) return r.error;
    const schedules = await prisma.schedule.findMany({
      where: { customerId: id },
      orderBy: { startAt: "asc" },
      include: { user: { select: { id: true, name: true } } },
    });
    return NextResponse.json(schedules);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await requireCustomerAccess(id);
    if ("error" in r) return r.error;
    const body = await req.json();
    const { title, description, type, startAt, endAt, isAllDay, location, userId } = body;
    if (!title || !startAt) {
      return NextResponse.json({ error: "title, startAt required" }, { status: 400 });
    }
    const schedule = await prisma.schedule.create({
      data: {
        customerId: id, organizationId: r.customer.organizationId, title,
        description: description || null,
        type: type || "FOLLOW_UP",
        startAt: new Date(startAt),
        endAt: endAt ? new Date(endAt) : new Date(new Date(startAt).getTime() + 3600000),
        isAllDay: isAllDay || false,
        location: location || null,
        userId: userId || null,
      },
      include: { user: { select: { id: true, name: true } } },
    });
    await logAudit({ customerId: id, userId: r.user.id, action: "schedule.create", field: type || "FOLLOW_UP", newValue: `${title} ${startAt}` });
    return NextResponse.json(schedule, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create schedule", detail: String(e) }, { status: 500 });
  }
}

// PATCH/DELETE は scheduleId で対象を指定するため、その予定の所属組織で判定する。
async function loadAccessibleSchedule(scheduleId: string) {
  const r = await requireUser();
  if ("error" in r) return r;
  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId }, select: { id: true, organizationId: true, customerId: true, title: true, startAt: true } });
  if (!schedule) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!canAccessOrg(r.user, schedule.organizationId)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user: r.user, schedule };
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { scheduleId, title, description, type, startAt, endAt, userId } = body;
    if (!scheduleId) {
      return NextResponse.json({ error: "scheduleId required" }, { status: 400 });
    }
    const r = await loadAccessibleSchedule(scheduleId);
    if ("error" in r) return r.error;
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (type !== undefined) data.type = type;
    if (startAt !== undefined) data.startAt = new Date(startAt);
    if (endAt !== undefined) data.endAt = new Date(endAt);
    if (userId !== undefined) data.userId = userId || null;
    const schedule = await prisma.schedule.update({
      where: { id: scheduleId },
      data,
      include: { user: { select: { id: true, name: true } } },
    });
    await logAudit({ customerId: r.schedule.customerId, userId: r.user.id, action: "schedule.update", field: scheduleId, oldValue: `${r.schedule.title} ${r.schedule.startAt.toISOString()}`, newValue: JSON.stringify(data) });
    return NextResponse.json(schedule);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update schedule", detail: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const scheduleId = url.searchParams.get("scheduleId");
    if (!scheduleId) {
      return NextResponse.json({ error: "scheduleId required" }, { status: 400 });
    }
    const r = await loadAccessibleSchedule(scheduleId);
    if ("error" in r) return r.error;
    await prisma.schedule.delete({ where: { id: scheduleId } });
    await logAudit({ customerId: r.schedule.customerId, userId: r.user.id, action: "schedule.delete", field: scheduleId, oldValue: `${r.schedule.title} ${r.schedule.startAt.toISOString()}` });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete schedule", detail: String(e) }, { status: 500 });
  }
}
