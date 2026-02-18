import { NextRequest, NextResponse } from "next/server";
import { verifyLineSignature, getLineProfile, type LineWebhookEvent } from "@/lib/channels/line";
import { prisma } from "@/lib/db/prisma";
import { recordInboundMessage } from "@/actions/send-message";
import { checkAutoStop } from "@/actions/workflows";
import { processAutoStatusChange } from "@/lib/status-rules";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-line-signature") || "";
    if (!(await verifyLineSignature(rawBody, signature))) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    const { events = [] }: { events: LineWebhookEvent[] } = JSON.parse(rawBody);
    for (const event of events) {
      const lineUserId = event.source.userId;
      if (event.type === "follow") {
        const profile = await getLineProfile(lineUserId);
        let customer = await prisma.customer.findFirst({ where: { lineUserId } });
        if (!customer && profile) customer = await prisma.customer.findFirst({ where: { name: { contains: profile.displayName }, lineUserId: null } });
        if (customer) {
          await prisma.customer.update({ where: { id: customer.id }, data: { lineUserId, lineDisplayName: profile?.displayName, lineLinkedAt: new Date(), lastActiveAt: new Date() } });
          await processAutoStatusChange(customer.id, "LINE_ADDED");
          await checkAutoStop(customer.id, "LINE_ADD");
        }
      } else if (event.type === "unfollow") {
        await prisma.customer.updateMany({ where: { lineUserId }, data: { lineBlockedAt: new Date() } });
      } else if (event.type === "message" && event.message.type === "text") {
        const customer = await prisma.customer.findFirst({ where: { lineUserId } });
        if (customer) {
          await recordInboundMessage({ customerId: customer.id, channel: "LINE", body: event.message.text });
          await checkAutoStop(customer.id, "REPLY");
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) { console.error("LINE webhook error:", e); return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}
