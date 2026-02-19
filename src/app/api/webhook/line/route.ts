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
          console.log("LINE already linked to customer:", existing.id);
          await sendLineMessage(lineUserId, "\u304A\u554F\u3044\u5408\u308F\u305B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\u305F\u307E\u4E0D\u52D5\u7523\u3067\u3059\u3002\u304A\u6C17\u8EFD\u306BLINE\u3067\u3054\u9023\u7D61\u304F\u3060\u3055\u3044\u3002");
          continue;
        }

        const code = String(Math.floor(1000 + Math.random() * 9000));
        await prisma.linePending.upsert({
          where: { lineUserId },
          update: { code, displayName: profile?.displayName, pictureUrl: profile?.pictureUrl },
          create: { lineUserId, code, displayName: profile?.displayName, pictureUrl: profile?.pictureUrl },
        });
        console.log("LINE pending created, code:", code);

        await sendLineMessage(lineUserId, `\u304A\u554F\u3044\u5408\u308F\u305B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\u305F\u307E\u4E0D\u52D5\u7523\u3067\u3059\u3002\n\n\u304A\u5BA2\u69D8\u60C5\u5831\u3068\u306ELINE\u3092\u9023\u643A\u3059\u308B\u305F\u3081\u306E\u8A8D\u8A3C\u30B3\u30FC\u30C9\u3092\u304A\u9001\u308A\u3057\u307E\u3059\u3002\n\n\u3010\u8A8D\u8A3C\u30B3\u30FC\u30C9\u3011${code}\n\n\u62C5\u5F53\u8005\u306B\u3053\u306E\u30B3\u30FC\u30C9\u3092\u304A\u4F1D\u3048\u304F\u3060\u3055\u3044\u3002`);

      } else if (event.type === "unfollow") {
        await prisma.customer.updateMany({ where: { lineUserId }, data: { lineBlockedAt: new Date() } });
        await prisma.linePending.deleteMany({ where: { lineUserId } });

      } else if (event.type === "message" && event.message.type === "text") {
        console.log("LINE message from:", lineUserId, "text:", event.message.text);
        const customer = await prisma.customer.findFirst({ where: { lineUserId } });
        if (customer) {
          await prisma.message.create({ data: { customerId: customer.id, direction: "INBOUND", channel: "LINE", body: event.message.text, status: "SENT" } });
          await prisma.customer.update({ where: { id: customer.id }, data: { lastActiveAt: new Date(), isNeedAction: true } });
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) { console.error("LINE webhook error:", e); return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}
