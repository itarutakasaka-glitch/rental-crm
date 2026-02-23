import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const org = await prisma.organization.findFirst();
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const reminders = await prisma.visitReminder.findMany({ where: { organizationId: org.id }, orderBy: { order: "asc" } });
    return NextResponse.json(reminders);
  } catch (error) {
    console.error("Failed to fetch reminders:", error);
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const org = await prisma.organization.findFirst();
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const body = await request.json();
    const maxOrder = await prisma.visitReminder.aggregate({ where: { organizationId: org.id }, _max: { order: true } });
    const reminder = await prisma.visitReminder.create({
      data: {
        organizationId: org.id, channel: body.channel || "EMAIL", timing: body.timing || "1_day_before",
        timingHour: body.timingHour || "10:00", subject: body.subject || null, body: body.body || "",
        skipLineNotAdded: body.skipLineNotAdded || false, order: (maxOrder._max.order ?? -1) + 1,
      },
    });
    return NextResponse.json(reminder);
  } catch (error) {
    console.error("Failed to create reminder:", error);
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const reminder = await prisma.visitReminder.update({
      where: { id },
      data: {
        ...(data.channel !== undefined && { channel: data.channel }),
        ...(data.timing !== undefined && { timing: data.timing }),
        ...(data.timingHour !== undefined && { timingHour: data.timingHour }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.body !== undefined && { body: data.body }),
        ...(data.skipLineNotAdded !== undefined && { skipLineNotAdded: data.skipLineNotAdded }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });
    return NextResponse.json(reminder);
  } catch (error) {
    console.error("Failed to update reminder:", error);
    return NextResponse.json({ error: "Failed to update reminder" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await prisma.visitReminder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete reminder:", error);
    return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 });
  }
}
