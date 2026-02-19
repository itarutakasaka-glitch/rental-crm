import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendLineMessage } from "@/lib/channels/line";

export async function POST(req: NextRequest) {
  try {
    const { customerId, code } = await req.json();
    if (!customerId || !code) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const pending = await prisma.linePending.findFirst({ where: { code } });
    if (!pending) return NextResponse.json({ error: "Invalid code" }, { status: 404 });

    await prisma.customer.update({
      where: { id: customerId },
      data: { lineUserId: pending.lineUserId, lineDisplayName: pending.displayName, lineLinkedAt: new Date(), lastActiveAt: new Date() },
    });
    await prisma.linePending.delete({ where: { id: pending.id } });

    await sendLineMessage(pending.lineUserId, "\u9023\u643A\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\uFF01\u4ECA\u5F8C\u306FLINE\u3067\u3082\u304A\u6C17\u8EFD\u306B\u3054\u9023\u7D61\u304F\u3060\u3055\u3044\u3002");

    return NextResponse.json({ ok: true, displayName: pending.displayName });
  } catch (e) { console.error("LINE link error:", e); return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}
