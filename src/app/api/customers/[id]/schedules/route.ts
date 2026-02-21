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
        customerId: id,
        organizationId: orgId,
        title,
        description: description || null,
        type: type || "FOLLOW_UP",
        startAt: new Date(startAt),
        endAt: endAt ? new Date(endAt) : null,
        isAllDay: isAllDay || false,
        location: location || null,
        userId: userId || null,
      },
    });
    return NextResponse.json(schedule, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create schedule", detail: String(e) }, { status: 500 });
  }
}