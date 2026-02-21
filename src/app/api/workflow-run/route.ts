import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function calcNextRunAt(startedAt: Date, daysAfter: number, timeOfDay: string) {
  const jstOffset = 9 * 60 * 60 * 1000;
  const startJST = new Date(startedAt.getTime() + jstOffset);
  startJST.setDate(startJST.getDate() + daysAfter);
  const [h, m] = timeOfDay.split(":").map(Number);
  startJST.setHours(h, m, 0, 0);
  return new Date(startJST.getTime() - jstOffset);
}

function resolveTemplate(body: string, customer: any, org: any) {
  return body
    .replace(/\{\{customer_name\}\}/g, customer.name || "")
    .replace(/\{\{customer_email\}\}/g, customer.email || "")
    .replace(/\{\{customer_phone\}\}/g, customer.phone || "")
    .replace(/\{\{staff_name\}\}/g, customer.assignee?.name || "")
    .replace(/\{\{property_name\}\}/g, customer.properties?.[0]?.name || "")
    .replace(/\{\{property_url\}\}/g, customer.properties?.[0]?.url || "")
    .replace(/\{\{company_name\}\}/g, org?.name || "")
    .replace(/\{\{store_name\}\}/g, org?.storeName || org?.name || "")
    .replace(/\{\{store_address\}\}/g, org?.storeAddress || org?.address || "")
    .replace(/\{\{store_phone\}\}/g, org?.storePhone || org?.phone || "")
    .replace(/\{\{store_hours\}\}/g, org?.storeHours || "")
    .replace(/\{\{line_url\}\}/g, org?.lineUrl || "")
    .replace(/\{\{license_number\}\}/g, org?.licenseNumber || "");
}

async function executeImmediateStep(run: any, step: any, customer: any, org: any) {
  try {
    const template = await prisma.template.findUnique({ where: { id: step.templateId } });
    if (!template) { console.error("[Immediate] Template not found:", step.templateId); return; }

    const body = resolveTemplate(template.body, customer, org);
    const subject = resolveTemplate(template.subject || template.name, customer, org);

    if (step.channel === "EMAIL" && customer.email) {
      const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com";
      const fromName = customer.assignee?.name || org?.storeName || org?.name || "CRM";
      await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: customer.email,
        subject,
        text: body,
      });
      await prisma.message.create({
        data: {
          customerId: customer.id,
          direction: "OUTBOUND",
          channel: "EMAIL",
          subject,
          body,
          status: "SENT",
          senderName: fromName,
          senderEmail: fromEmail,
        },
      });
    }

    // Record step execution
    await prisma.workflowStepRun.create({
      data: { workflowRunId: run.id, workflowStepId: step.id, status: "SENT", sentAt: new Date() },
    });

    console.log(`[Immediate] Step "${step.name}" sent to ${customer.name}`);
  } catch (e) {
    console.error("[Immediate] Failed:", e);
  }
}

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get("customerId");
  if (!customerId) return NextResponse.json({ run: null });
  const run = await prisma.workflowRun.findFirst({
    where: { customerId, status: "RUNNING" },
    include: { workflow: { include: { steps: { orderBy: { order: "asc" } } } } },
    orderBy: { startedAt: "desc" },
  });
  return NextResponse.json({ run });
}

export async function DELETE(req: NextRequest) {
  const { runId } = await req.json();
  await prisma.workflowRun.update({ where: { id: runId }, data: { status: "STOPPED_BY_REPLY", stoppedAt: new Date(), stopReason: "Manual stop" } });
  return NextResponse.json({ ok: true });
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
  const firstStep = workflow.steps[0];

  // Check if first step is immediate
  if (firstStep.isImmediate) {
    // Fetch customer + org for immediate send
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { assignee: true, properties: true },
    });
    const org = await prisma.organization.findFirst({ where: { id: customer?.organizationId || "org_default" } });

    // Determine next step info
    const hasNextStep = workflow.steps.length > 1;
    const nextStepIndex = hasNextStep ? 1 : workflow.steps.length;
    const nextRunAt = hasNextStep
      ? calcNextRunAt(now, workflow.steps[1].daysAfter, workflow.steps[1].timeOfDay)
      : now;
    const status = hasNextStep ? "RUNNING" : "COMPLETED";

    const run = await prisma.workflowRun.create({
      data: { workflowId, customerId, status, startedAt: now, currentStepIndex: nextStepIndex, nextRunAt },
    });

    // Execute immediately (non-blocking)
    if (customer) {
      executeImmediateStep(run, firstStep, customer, org).catch(console.error);
    }

    return NextResponse.json(run);
  }

  // Normal (non-immediate) flow
  const nextRunAt = calcNextRunAt(now, firstStep.daysAfter, firstStep.timeOfDay);
  const run = await prisma.workflowRun.create({
    data: { workflowId, customerId, status: "RUNNING", startedAt: now, currentStepIndex: 0, nextRunAt },
  });
  return NextResponse.json(run);
}