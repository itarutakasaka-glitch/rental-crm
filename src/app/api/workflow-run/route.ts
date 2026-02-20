import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

function calcNextRunAt(startedAt: Date, daysAfter: number, timeOfDay: string) {
  const d = new Date(startedAt);
  d.setDate(d.getDate() + daysAfter);
  const [h, m] = timeOfDay.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export async function POST(req: NextRequest) {
  const { customerId, workflowId } = await req.json();
  if (!customerId || !workflowId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const existing = await prisma.workflowRun.findFirst({ where: { customerId, status: "RUNNING" } });
  if (existing) {
    await prisma.workflowRun.update({ where: { id: existing.id }, data: { status: "STOPPED_BY_REPLY", stoppedAt: new Date(), stopReason: "Replaced by new workflow" } });
  }

  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId }, include: { steps: { orderBy: { order: "asc" } } } });
  if (!workflow || workflow.steps.length === 0) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  const now = new Date();
  const step = workflow.steps[0];
  const nextRunAt = calcNextRunAt(now, step.daysAfter, step.timeOfDay);

  const run = await prisma.workflowRun.create({
    data: { workflowId, customerId, status: "RUNNING", startedAt: now, currentStepIndex: 0, nextRunAt },
  });
  return NextResponse.json(run);
}
