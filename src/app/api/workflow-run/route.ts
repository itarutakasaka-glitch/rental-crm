import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Resend } from "resend";
import { requireCustomerAccess, requireUser, canAccessOrg } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { resolveTemplateVars } from "@/lib/template-vars";

const resend = new Resend(process.env.RESEND_API_KEY);

function calcNextRunAt(startedAt: Date, daysAfter: number, timeOfDay: string) {
  const jstOffset = 9 * 60 * 60 * 1000;
  const startJST = new Date(startedAt.getTime() + jstOffset);
  startJST.setDate(startJST.getDate() + daysAfter);
  const [h, m] = timeOfDay.split(":").map(Number);
  startJST.setHours(h, m, 0, 0);
  return new Date(startJST.getTime() - jstOffset);
}

// implementation-spec-v1.md §1.3: 変数置換は lib/template-vars.ts に集約
function resolveTemplate(body: string, customer: any, org: any) {
  return resolveTemplateVars(body, { customer, org });
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
        },
      });
    }

    // Record step execution
    await prisma.workflowStepRun.create({
      data: { workflowRun: { connect: { id: run.id } }, step: { connect: { id: step.id } }, status: "SENT", scheduledAt: new Date() },
    });

    console.log(`[Immediate] Step "${step.name}" sent to ${customer.name}`);
  } catch (e) {
    console.error("[Immediate] Failed:", e);
  }
}

// architecture-v2.md §10 S-1: 所属チェック追加(以前は無認証)。
export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get("customerId");
  if (!customerId) return NextResponse.json([]);
  const r = await requireCustomerAccess(customerId);
  if ("error" in r) return r.error;
  const runs = await prisma.workflowRun.findMany({
    where: { customerId },
    include: { workflow: { include: { steps: { orderBy: { order: "asc" } } } } },
    orderBy: { startedAt: "desc" },
  });
  return NextResponse.json(runs);
}

export async function PATCH(req: NextRequest) {
  const { runId } = await req.json();
  const u = await requireUser();
  if ("error" in u) return u.error;
  const run = await prisma.workflowRun.findUnique({ where: { id: runId }, select: { id: true, customer: { select: { id: true, organizationId: true } } } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessOrg(u.user, run.customer.organizationId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // implementation-spec-v1.md §2.4: 人が止めた場合は STOPPED_MANUAL（以前は返信による停止と区別が付かなかった）
  await prisma.workflowRun.update({ where: { id: runId }, data: { status: "STOPPED_MANUAL", stoppedAt: new Date(), stopReason: "Manual stop" } });
  await logAudit({ customerId: run.customer.id, userId: u.user.id, action: "workflow.run.stop", field: runId });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const { customerId, workflowId } = await req.json();
  if (!customerId || !workflowId) return NextResponse.json({ error: "Missing params" }, { status: 400 });
  const r = await requireCustomerAccess(customerId);
  if ("error" in r) return r.error;
  // ワークフローは顧客の所属組織のものに限る
  const owned = await prisma.workflow.findFirst({ where: { id: workflowId, organizationId: r.customer.organizationId }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  await logAudit({ customerId, userId: r.user.id, action: "workflow.run.start", field: workflowId });

  const existing = await prisma.workflowRun.findFirst({ where: { customerId, status: "RUNNING" } });
  if (existing) {
    await prisma.workflowRun.update({ where: { id: existing.id }, data: { status: "STOPPED_MANUAL", stoppedAt: new Date(), stopReason: "Replaced by new workflow" } });
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
    const org = customer ? await prisma.organization.findUnique({ where: { id: customer.organizationId } }) : null;

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