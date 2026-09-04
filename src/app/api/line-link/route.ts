import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendLineMessage } from "@/lib/channels/line";
import { requireCustomerAccess } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// architecture-v2.md §10 S-1: 所属チェック追加(以前は無認証で任意の顧客にLINEを紐付けられた)
export async function POST(req: NextRequest) {
  try {
    const { customerId, code } = await req.json();
    if (!customerId || !code) return NextResponse.json({ error: "Missing params" }, { status: 400 });
    const r = await requireCustomerAccess(customerId);
    if ("error" in r) return r.error;

    const pending = await prisma.linePending.findFirst({ where: { code } });
    if (!pending) return NextResponse.json({ error: "Invalid code" }, { status: 404 });

    await prisma.customer.update({
      where: { id: customerId },
      data: { lineUserId: pending.lineUserId, lineDisplayName: pending.displayName, lineLinkedAt: new Date(), lastActiveAt: new Date() },
    });
    await prisma.linePending.delete({ where: { id: pending.id } });
    await logAudit({ customerId, userId: r.user.id, action: "line.link", newValue: pending.displayName });

    await sendLineMessage(pending.lineUserId, "連携が完了しました！今後はLINEでもお気軽にご連絡ください。");

    return NextResponse.json({ ok: true, displayName: pending.displayName });
  } catch (e) { console.error("LINE link error:", e); return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}
