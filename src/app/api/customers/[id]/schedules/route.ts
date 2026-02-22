import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    const body = await req.json();
    const { title, description, type, startAt, endAt, isAllDay, location, userId, organizationId } = body;
    if (!title || !startAt) {
      return NextResponse.json({ error: "title, startAt required" }, { status: 400 });
    }
    const customer = await prisma.customer.findUnique({ where: { id }, select: { organizationId: true } });
    const orgId = organizationId || customer?.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "organizationId not found" }, { status: 400 });
    }
    const schedule = await prisma.schedule.create({
      data: {
        customerId: id, organizationId: orgId, title,
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
    return NextResponse.json(schedule, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create schedule", detail: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { scheduleId, title, description, type, startAt, endAt, userId } = body;
    if (!scheduleId) {
      return NextResponse.json({ error: "scheduleId required" }, { status: 400 });
    }
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
    await prisma.schedule.delete({ where: { id: scheduleId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete schedule", detail: String(e) }, { status: 500 });
  }
}