import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendLineMessage } from "@/lib/channels/line";

function calcNextRunAt(startedAt: Date, daysAfter: number, timeOfDay: string) {
  const jstOffset = 9 * 60 * 60 * 1000;
  const startJST = new Date(startedAt.getTime() + jstOffset);
  startJST.setDate(startJST.getDate() + daysAfter);
  const [h, m] = timeOfDay.split(":").map(Number);
  startJST.setHours(h, m, 0, 0);
  return new Date(startJST.getTime() - jstOffset);
}

async function resolveAndSend(step: any, template: any, customer: any, org: any) {
  let body = template.body
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
  let subject = template.subject ? template.subject.replace(/\{\{customer_name\}\}/g, customer.name || "") : null;

  if (step.channel === "EMAIL" && customer.email && process.env.RESEND_API_KEY) {
    if (!customer.lineUserId) {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      await prisma.customer.update({ where: { id: customer.id }, data: { lineCode: code } });
      body += `\n\n---\nLINE\u3067\u3082\u304A\u6C17\u8EFD\u306B\u3054\u9023\u7D61\u304F\u3060\u3055\u3044\u3002\n\u53CB\u3060\u3061\u8FFD\u52A0: ${org?.lineUrl || "https://line.me/R/ti/p/@331fxngy"}\n\u8FFD\u52A0\u5F8C\u3001\u8A8D\u8A3C\u30B3\u30FC\u30C9\u300C${code}\u300D\u3092LINE\u3067\u9001\u4FE1\u3057\u3066\u304F\u3060\u3055\u3044\u3002`;
    }
    await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: `${org?.name || "CRM"} <${process.env.RESEND_FROM_EMAIL || "noreply@example.com"}>`, to: customer.email, subject: subject || "(No subject)", text: body }) });
  } else if (step.channel === "LINE" && customer.lineUserId) {
    await sendLineMessage(customer.lineUserId, body);
  }

  await prisma.message.create({ data: { customerId: customer.id, direction: "OUTBOUND", channel: step.channel, subject, body, status: "SENT" } });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const runs = await prisma.workflowRun.findMany({
    where: { status: "RUNNING", nextRunAt: { lte: now } },
    include: { workflow: { include: { steps: { orderBy: { order: "asc" }, include: { template: true } } } }, customer: { include: { assignee: true, properties: true } } },
  });

  const org = await prisma.organization.findUnique({ where: { id: "org_default" } });
  let processed = 0;

  for (const run of runs) {
    const step = run.workflow.steps[run.currentStepIndex];
    if (!step) { await prisma.workflowRun.update({ where: { id: run.id }, data: { status: "COMPLETED", stoppedAt: now } }); continue; }

    try {
      await resolveAndSend(step, step.template, run.customer, org);
      processed++;
    } catch (e) { console.error("Workflow step error:", e); }

    const nextIndex = run.currentStepIndex + 1;
    if (nextIndex >= run.workflow.steps.length) {
      await prisma.workflowRun.update({ where: { id: run.id }, data: { status: "COMPLETED", stoppedAt: now, currentStepIndex: nextIndex } });
    } else {
      const nextStep = run.workflow.steps[nextIndex];
      const nextRunAt = calcNextRunAt(run.startedAt, nextStep.daysAfter, nextStep.timeOfDay);
      await prisma.workflowRun.update({ where: { id: run.id }, data: { currentStepIndex: nextIndex, nextRunAt } });
    }
  }

  return NextResponse.json({ ok: true, processed, total: runs.length });
}
