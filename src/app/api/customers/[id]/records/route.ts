import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireCustomerAccess } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// architecture-v2.md §10 S-1: 所属チェック追加(以前は無認証・他社顧客の対応記録を読み書きできた)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await requireCustomerAccess(id);
    if ("error" in r) return r.error;
    const records = await prisma.customerRecord.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(records);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch records" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await requireCustomerAccess(id);
    if ("error" in r) return r.error;
    const body = await req.json();
    const { type, callResult, title, body: recordBody, visitDate } = body;

    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    const record = await prisma.customerRecord.create({
      data: {
        customerId: id,
        type,
        callResult: callResult || null,
        title: title || null,
        body: recordBody || null,
        visitDate: visitDate ? new Date(visitDate) : null,
      },
    });

    if (type === "CALL" && callResult === "success") {
      await prisma.customer.update({
        where: { id },
        data: { isNeedAction: false, lastActiveAt: new Date() },
      });
    }
    await logAudit({ customerId: id, userId: r.user.id, action: "customer.record.create", field: type, newValue: title || recordBody || callResult });

    return NextResponse.json(record, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create record" }, { status: 500 });
  }
}
