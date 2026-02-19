import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const templates = await prisma.template.findMany({
    where: { organizationId: "org_default", isActive: true },
    include: { category: true },
    orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
  });
  const categories = await prisma.templateCategory.findMany({
    where: { organizationId: "org_default" },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ templates, categories });
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const template = await prisma.template.create({
    data: {
      organizationId: "org_default",
      categoryId: data.categoryId,
      name: data.name,
      channel: data.channel || "EMAIL",
      subject: data.subject || null,
      body: data.body,
      order: data.order || 0,
    },
  });
  return NextResponse.json(template);
}

export async function PUT(req: NextRequest) {
  const data = await req.json();
  const template = await prisma.template.update({
    where: { id: data.id },
    data: { name: data.name, categoryId: data.categoryId, channel: data.channel, subject: data.subject, body: data.body },
  });
  return NextResponse.json(template);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await prisma.template.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
