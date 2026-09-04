import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// architecture-v2.md §10 S-2: 実在しない "org_default" 直書き(同型バグ5件目)。
// 追客ワークフロー設定画面はGETが常に空、POSTは孤立レコードを作っていた。
// ログインユーザーの所属組織を使い、更新系は「その組織のワークフローか」を必ず確認する。
function mapSteps(steps: any[]) {
  return (steps || []).map((s: any, i: number) => ({
    name: s.name,
    daysAfter: s.daysAfter,
    timeOfDay: s.timeOfDay,
    channel: s.channel,
    templateId: s.templateId,
    order: i,
    isImmediate: s.isImmediate || false,
  }));
}

export async function GET() {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const workflows = await prisma.workflow.findMany({
    where: { organizationId: r.user.organizationId },
    include: { steps: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ workflows });
}

export async function POST(req: NextRequest) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const data = await req.json();
  const workflow = await prisma.workflow.create({
    data: { organizationId: r.user.organizationId, name: data.name, steps: { create: mapSteps(data.steps) } },
  });
  await logAudit({ userId: r.user.id, action: "workflow.create", field: workflow.id, newValue: data.name });
  return NextResponse.json(workflow);
}

async function ownedWorkflow(id: string, organizationId: string) {
  return prisma.workflow.findFirst({ where: { id, organizationId }, select: { id: true, name: true } });
}

export async function PUT(req: NextRequest) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const data = await req.json();
  if (!(await ownedWorkflow(data.id, r.user.organizationId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.workflowStep.deleteMany({ where: { workflowId: data.id } });
  const workflow = await prisma.workflow.update({
    where: { id: data.id },
    data: { name: data.name, steps: { create: mapSteps(data.steps) } },
  });
  await logAudit({ userId: r.user.id, action: "workflow.update", field: data.id, newValue: data.name });
  return NextResponse.json(workflow);
}

export async function PATCH(req: NextRequest) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const body = await req.json();
  const { id } = body;
  if (!(await ownedWorkflow(id, r.user.organizationId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.isDefault === true) {
    await prisma.workflow.updateMany({ where: { organizationId: r.user.organizationId }, data: { isDefault: false } });
    const workflow = await prisma.workflow.update({ where: { id }, data: { isDefault: true, isActive: true } });
    await logAudit({ userId: r.user.id, action: "workflow.update", field: "isDefault", newValue: id });
    return NextResponse.json(workflow);
  }
  if (typeof body.isActive === "boolean") {
    const workflow = await prisma.workflow.update({ where: { id }, data: { isActive: body.isActive } });
    await logAudit({ userId: r.user.id, action: "workflow.update", field: `${id}.isActive`, newValue: String(body.isActive) });
    return NextResponse.json(workflow);
  }
  return NextResponse.json({ error: "No valid field" }, { status: 400 });
}
