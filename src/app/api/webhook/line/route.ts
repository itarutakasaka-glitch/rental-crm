import { NextRequest, NextResponse } from "next/server";
import { verifyLineSignature, getLineProfile, sendLineMessage, type LineWebhookEvent } from "@/lib/channels/line";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-line-signature") || "";
    if (!(await verifyLineSignature(rawBody, signature))) {
      console.log("LINE webhook: invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    const { events = [] }: { events: LineWebhookEvent[] } = JSON.parse(rawBody);
    for (const event of events) {
      const lineUserId = event.source.userId;
      console.log("LINE event:", event.type, "userId:", lineUserId);

      if (event.type === "follow") {
        const profile = await getLineProfile(lineUserId);
        console.log("LINE profile:", JSON.stringify(profile));

        const existing = await prisma.customer.findFirst({ where: { lineUserId } });
        if (existing) {
          await sendLineMessage(lineUserId, "\u304A\u554F\u3044\u5408\u308F\u305B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\u305F\u307E\u4E0D\u52D5\u7523\u3067\u3059\u3002\u304A\u6C17\u8EFD\u306BLINE\u3067\u3054\u9023\u7D61\u304F\u3060\u3055\u3044\u3002");
          continue;
        }

        await prisma.linePending.upsert({
          where: { lineUserId },
          update: { displayName: profile?.displayName, pictureUrl: profile?.pictureUrl },
          create: { lineUserId, code: "PENDING", displayName: profile?.displayName, pictureUrl: profile?.pictureUrl },
        });

        await sendLineMessage(lineUserId, "\u304A\u554F\u3044\u5408\u308F\u305B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\u305F\u307E\u4E0D\u52D5\u7523\u3067\u3059\u3002\n\n\u304A\u624B\u6570\u3067\u3059\u304C\u3001\u30E1\u30FC\u30EB\u306B\u8A18\u8F09\u306E4\u6841\u306E\u8A8D\u8A3C\u30B3\u30FC\u30C9\u3092\u3053\u306E\u30C1\u30E3\u30C3\u30C8\u306B\u9001\u4FE1\u3057\u3066\u304F\u3060\u3055\u3044\u3002");

      } else if (event.type === "unfollow") {
        await prisma.customer.updateMany({ where: { lineUserId }, data: { lineBlockedAt: new Date() } });
        await prisma.linePending.deleteMany({ where: { lineUserId } });

      } else if (event.type === "message" && event.message.type === "text") {
        const text = event.message.text.trim();
        console.log("LINE message from:", lineUserId, "text:", text);

        const linked = await prisma.customer.findFirst({ where: { lineUserId } });
        if (linked) {
          await prisma.message.create({ data: { customerId: linked.id, direction: "INBOUND", channel: "LINE", body: text, status: "SENT" } });
          await prisma.customer.update({ where: { id: linked.id }, data: { lastActiveAt: new Date(), isNeedAction: true } });
          continue;
        }

        if (/^\d{4}$/.test(text)) {
          const pending = await prisma.linePending.findFirst({ where: { lineUserId } });
          if (pending) {
            const customer = await prisma.customer.findFirst({ where: { lineCode: text, lineUserId: null } });
            if (customer) {
              await prisma.customer.update({
                where: { id: customer.id },
                data: { lineUserId, lineDisplayName: pending.displayName, lineLinkedAt: new Date(), lastActiveAt: new Date(), lineCode: null },
              });
              await prisma.linePending.delete({ where: { id: pending.id } });
              await sendLineMessage(lineUserId, `${customer.name}\u69D8\u3001\u9023\u643A\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\uFF01\u4ECA\u5F8C\u306FLINE\u3067\u3082\u304A\u6C17\u8EFD\u306B\u3054\u9023\u7D61\u304F\u3060\u3055\u3044\u3002`);
              continue;
            }
          }
          await sendLineMessage(lineUserId, "\u8A8D\u8A3C\u30B3\u30FC\u30C9\u304C\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u304A\u624B\u6570\u3067\u3059\u304C\u3001\u3082\u3046\u4E00\u5EA6\u3054\u78BA\u8A8D\u304F\u3060\u3055\u3044\u3002");
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) { console.error("LINE webhook error:", e); return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}
