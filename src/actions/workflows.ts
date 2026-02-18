"use server";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";

export async function createWorkflowStep(data: {
  workflowId: string; name: string; daysAfter: number; timeOfDay: string; channel: any; templateId: string;
}) {
  const maxOrder = await prisma.workflowStep.aggregate({ where: { workflowId: data.workflowId }, _max: { order: true } });
  await prisma.workflowStep.create({ data: { ...data, order: (maxOrder._max.order || 0) + 1 } });
  revalidatePath("/settings/workflow");
}

export async function deleteWorkflowStep(id: string) {
  await prisma.workflowStep.delete({ where: { id } });
  revalidatePath("/settings/workflow");
}

export async function toggleWorkflow(id: string) {
  const wf = await prisma.workflow.findUnique({ where: { id } });
  if (!wf) return;
  await prisma.workflow.update({ where: { id }, data: { isActive: !wf.isActive } });
  revalidatePath("/settings/workflow");
}

export async function startWorkflow(customerId: string, workflowId: string) {
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId }, include: { steps: { orderBy: { order: "asc" } } } });
  if (!workflow || !workflow.isActive) return;
  const now = new Date();
  const run = await prisma.workflowRun.create({ data: { customerId, workflowId } });
  for (const step of workflow.steps) {
    const scheduledAt = new Date(now.getTime() + step.daysAfter * 86400000);
    const [h, m] = step.timeOfDay.split(":").map(Number);
    scheduledAt.setHours(h, m, 0, 0);
    await prisma.workflowStepRun.create({ data: { workflowRunId: run.id, stepId: step.id, scheduledAt } });
  }
  return run;
}

export async function checkAutoStop(customerId: string, reason: "REPLY"|"LINE_ADD"|"VISIT"|"CALL") {
  const statusMap: Record<string, string> = { REPLY: "STOPPED_BY_REPLY", LINE_ADD: "STOPPED_BY_LINE_ADD", VISIT: "STOPPED_BY_VISIT", CALL: "STOPPED_BY_CALL" };
  const runs = await prisma.workflowRun.findMany({ where: { customerId, status: "RUNNING" } });
  for (const run of runs) {
    await prisma.workflowRun.update({ where: { id: run.id }, data: { status: statusMap[reason] as any, stoppedAt: new Date(), stopReason: reason } });
    await prisma.workflowStepRun.updateMany({ where: { workflowRunId: run.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  }
  revalidatePath(`/customers/${customerId}`);
}
