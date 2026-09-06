import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthUserForAction } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const reminders = await prisma.visitReminder.findMany({ where: { organizationId: user.organizationId }, orderBy: { order: "asc" } });
    return NextResponse.json(reminders);
  } catch (error) {
    console.error("Failed to fetch reminders:", error);
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const maxOrder = await prisma.visitReminder.aggregate({ where: { organizationId: user.organizationId }, _max: { order: true } });
    const reminder = await prisma.visitReminder.create({
      data: {
        organizationId: user.organizationId, channel: body.channel || "EMAIL", timing: body.timing || "1_day_before",
        timingHour: body.timingHour || "10:00", subject: body.subject || null, body: body.body || "",
        skipLineNotAdded: body.skipLineNotAdded || false, order: (maxOrder._max.order ?? -1) + 1,
      },
    });
    // implementation-spec-v1.md §3: リマインダーは顧客へ自動送信されるので作成・変更・削除を監査ログに残す
    await logAudit({ userId: user.id, organizationId: user.organizationId, action: "reminder.create", field: reminder.id, newValue: `${reminder.channel} ${reminder.timing} ${reminder.timingHour}` });
    return NextResponse.json(reminder);
  } catch (error) {
    console.error("Failed to create reminder:", error);
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const reminder = await prisma.visitReminder.updateMany({
      where: { id, organizationId: user.organizationId },
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
    if (reminder.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await logAudit({ userId: user.id, organizationId: user.organizationId, action: "reminder.update", field: id, newValue: JSON.stringify(data).slice(0, 400) });
    return NextResponse.json(reminder);
  } catch (error) {
    console.error("Failed to update reminder:", error);
    return NextResponse.json({ error: "Failed to update reminder" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const removed = await prisma.visitReminder.deleteMany({ where: { id, organizationId: user.organizationId } });
    if (removed.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await logAudit({ userId: user.id, organizationId: user.organizationId, action: "reminder.delete", field: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete reminder:", error);
    return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 });
  }
}
