import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updateData: Record<string, unknown> = {};
    if (body.statusId !== undefined) updateData.statusId = body.statusId;
    if (body.isNeedAction !== undefined) updateData.isNeedAction = body.isNeedAction;
    if (body.assigneeId !== undefined) updateData.assigneeId = body.assigneeId || null;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.nameKana !== undefined) updateData.nameKana = body.nameKana;
    const updated = await prisma.customer.update({
      where: { id },
      data: updateData,
      select: {
        id: true, statusId: true, isNeedAction: true, assigneeId: true,
        status: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/customers/[id]] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        status: true,
        assignee: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, direction: true, channel: true, subject: true, body: true, status: true, createdAt: true, sender: { select: { id: true, name: true } } },
        },
        inquiryProperties: true,
        workflowRuns: { include: { workflow: { select: { id: true, name: true } } }, take: 5 },
      },
    });
    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(customer);
  } catch (error) {
    console.error("[GET /api/customers/[id]] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}