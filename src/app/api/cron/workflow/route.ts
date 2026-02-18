import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const pendingSteps = await prisma.workflowStepRun.findMany({
    where: { status: "PENDING", scheduledAt: { lte: now }, workflowRun: { status: "RUNNING" } },
    include: { step: { include: { template: true } }, workflowRun: { include: { customer: true } } },
    take: 50,
  });
  let sent = 0;
  for (const stepRun of pendingSteps) {
    try {
      const customer = stepRun.workflowRun.customer;
      const template = stepRun.step.template;
      const body = template.body.replace(/{顧客名}/g, customer.name);
      await prisma.message.create({ data: { customerId: customer.id, direction: "OUTBOUND", channel: stepRun.step.channel, subject: template.subject, body, status: "SENT", workflowStepRunId: stepRun.id } });
      await prisma.workflowStepRun.update({ where: { id: stepRun.id }, data: { status: "SENT", executedAt: now } });
      sent++;
    } catch (e: any) {
      await prisma.workflowStepRun.update({ where: { id: stepRun.id }, data: { status: stepRun.retryCount >= 3 ? "FAILED" : "PENDING", retryCount: stepRun.retryCount + 1, errorMessage: e.message } });
    }
  }
  return NextResponse.json({ sent, total: pendingSteps.length });
}
