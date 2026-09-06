import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    // implementation-spec-v1.md §3: 認証は lib/auth.ts のヘルパーに統一
    const r = await requireUser();
    if ("error" in r) return r.error;

    const customers = await prisma.customer.findMany({
      where: { organizationId: r.user.organizationId },
      include: {
        status: { select: { id: true, name: true, color: true, order: true } },
        assignee: { select: { id: true, name: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { body: true, subject: true, direction: true, createdAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const result = customers.map((c) => ({
      ...c,
      lastMessage: c.messages[0] || null,
      messages: undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/customers] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const r = await requireUser();
    if ("error" in r) return r.error;
    const dbUser = r.user;

    const body = await request.json();
    const { name, nameKana, email, phone, sourcePortal, inquiryContent, statusId, assigneeId } = body;

    if (!name) return NextResponse.json({ error: "名前は必須です" }, { status: 400 });

    const customer = await prisma.customer.create({
      data: {
        name,
        nameKana: nameKana || null,
        email: email || null,
        phone: phone || null,
        sourcePortal: sourcePortal || null,
        inquiryContent: inquiryContent || null,
        statusId: statusId || null,
        assigneeId: assigneeId || dbUser.id,
        organizationId: dbUser.organizationId,
        isNeedAction: true,
      },
    });

    // implementation-spec-v1.md §3: 個人情報レコードの新規作成を監査ログに残す
    await logAudit({ customerId: customer.id, userId: dbUser.id, organizationId: dbUser.organizationId, action: "customer.create", newValue: name });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("[POST /api/customers] Error:", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}