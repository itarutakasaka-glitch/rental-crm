import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const workflows = await prisma.workflow.findMany({
    where: { organizationId: "org_default" },
    include: { steps: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ workflows });
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const workflow = await prisma.workflow.create({
    data: {
      organizationId: "org_default",
      name: data.name,
      steps: {
        create: data.steps.map((s: any, i: number) => ({
          name: s.name,
          daysAfter: s.daysAfter,
          timeOfDay: s.timeOfDay,
          channel: s.channel,
          templateId: s.templateId,
          order: i,
        })),
      },
    },
  });
  return NextResponse.json(workflow);
}

export async function PUT(req: NextRequest) {
  const data = await req.json();
  await prisma.workflowStep.deleteMany({ where: { workflowId: data.id } });
  const workflow = await prisma.workflow.update({
    where: { id: data.id },
    data: {
      name: data.name,
      steps: {
        create: data.steps.map((s: any, i: number) => ({
          name: s.name,
          daysAfter: s.daysAfter,
          timeOfDay: s.timeOfDay,
          channel: s.channel,
          templateId: s.templateId,
          order: i,
        })),
      },
    },
  });
  return NextResponse.json(workflow);
}

export async function PATCH(req: NextRequest) {
  const { id, isActive } = await req.json();
  const workflow = await prisma.workflow.update({ where: { id }, data: { isActive } });
  return NextResponse.json(workflow);
}
