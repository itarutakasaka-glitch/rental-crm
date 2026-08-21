import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const { type, data } = payload;
    if (type === "email.opened" && data?.email_id) {
      const msg = await prisma.message.findUnique({ where: { externalId: data.email_id } });
      if (msg) {
        await prisma.message.update({ where: { id: msg.id }, data: { openedAt: msg.openedAt || new Date(), openCount: msg.openCount + 1 } });
        await prisma.messageEvent.create({ data: { messageId: msg.id, type: "opened", occurredAt: new Date() } });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}
