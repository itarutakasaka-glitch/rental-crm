import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getResend } from "@/lib/resend";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { resolveTemplateVars } from "@/lib/template-vars";
import { resolveEmailChannel, buildEmailFrom } from "@/lib/channel-resolver";
import { getScheduleLinkState, checkStoreAvailability, confirmBooking } from "@/lib/booking";


export async function POST(request: Request) {
  try {
    // implementation-spec-v1.md §3: 公開route(P)。IPあたり10回/分に制限
    const rl = rateLimit(`visit-booking:${clientIp(request)}`, 10, 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const body = await request.json();
    const { organizationId, customerId, name, email, phone, visitDate, visitTime, visitMethod, numGuests, memo } = body;

    if (!organizationId || !visitDate || !visitTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const setting = await prisma.storeVisitSetting.findUnique({
      where: { organizationId },
    });
    if (!setting || !setting.enabled) {
      return NextResponse.json({ error: "Booking not available" }, { status: 404 });
    }

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    let customer = null;
    let customerName = name || "";
    let customerEmail = email || "";
    let customerPhone = phone || "";

    // If customerId provided, use existing customer
    if (customerId) {
      // 公開ページからの顧客IDは推測されうるため、会社が一致する顧客だけを対象にし、
      // 顧客レコードの電話番号は書き換えない(implementation-spec-v1.md §3)。予約側の phone には残す。
      customer = await prisma.customer.findFirst({ where: { id: customerId, organizationId } });
      if (customer) {
        customerName = customer.name || customerName;
        customerEmail = customer.email || customerEmail;
        customerPhone = phone || customer.phone || customerPhone;
        await prisma.customer.update({ where: { id: customer.id }, data: { isNeedAction: true } });
      }
    }

    // Fallback: find by phone or email
    if (!customer && customerPhone) {
      customer = await prisma.customer.findFirst({
        where: { phone: customerPhone, organizationId },
      });
      if (customer) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { isNeedAction: true },
        });
      }
    }
    if (!customer && customerEmail) {
      customer = await prisma.customer.findFirst({
        where: { email: customerEmail, organizationId },
      });
      if (customer) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { isNeedAction: true },
        });
      }
    }

    // Create new customer if not found (phone-only is OK)
    if (!customer && customerPhone) {
      const defaultStatus = await prisma.status.findFirst({
        where: { organizationId, isDefault: true },
      });
      customer = await prisma.customer.create({
        data: {
          name: customerName || "\u4E88\u7D04\u9867\u5BA2",
          email: customerEmail || null,
          phone: customerPhone,
          organizationId,
          sourcePortal: "STORE_VISIT",
          isNeedAction: true,
          statusId: defaultStatus?.id || undefined,
        },
      });
    }

    if (!customer) {
      return NextResponse.json({ error: "\u96FB\u8A71\u756A\u53F7\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044" }, { status: 400 });
    }

    // implementation-spec-v1.md 2.5 (M-6): まず未確定(PENDING)で受け付ける。
    // 店舗スケジュール連動がある店舗だけ、空きを確認できたらこの場で確定する。
    const bookingDate = new Date(visitDate);
    const link = await getScheduleLinkState(customer.storeId, {
      hoursStart: setting.availableTimeStart,
      hoursEnd: setting.availableTimeEnd,
    });

    if (link.kind === "linked") {
      const avail = await checkStoreAvailability({
        organizationId,
        storeId: customer.storeId!,
        visitDate: bookingDate,
        visitTime,
        slotMinutes: link.slotMinutes,
        hoursStart: link.hoursStart,
        hoursEnd: link.hoursEnd,
      });
      if (avail.kind === "ng") {
        // 埋まっている・営業時間外。予約は作らず、同じ日の空き枠を候補として返す
        return NextResponse.json({ error: avail.reason, alternatives: avail.alternatives }, { status: 409 });
      }
    }

    const booking = await prisma.storeVisitBooking.create({
      data: {
        organizationId,
        customerId: customer.id,
        storeId: customer.storeId,
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        visitDate: bookingDate,
        visitTime,
        visitMethod: visitMethod || "",
        memo: memo || "",
        status: "PENDING",
      },
    });

    // 連動ありなら即時確定。Schedule(VISIT) の作成・追客停止もここで行う
    let confirmed = false;
    if (link.kind === "linked") {
      const r = await confirmBooking({ bookingId: booking.id, by: "SCHEDULE_LINK", slotMinutes: link.slotMinutes });
      confirmed = r.ok;
    }

    // Create notification message so it appears in customer detail chat
    const dateLabel = visitDate.replace(/-/g, "/");
    const methodLabel = visitMethod ? `\n\u6765\u5E97\u65B9\u6CD5: ${visitMethod}` : "";
    const memoLabel = memo ? `\n\u3054\u8981\u671B: ${memo}` : "";
    await prisma.message.create({
      data: {
        customerId: customer.id,
        direction: "INBOUND",
        channel: "EMAIL",
        subject: confirmed ? "\u3010\u6765\u5E97\u4E88\u7D04\u30FB\u78BA\u5B9A\u3011" : "\u3010\u6765\u5E97\u4E88\u7D04\u30FB\u672A\u78BA\u5B9A\u3011",
        body:
          `\u6765\u5E97\u4E88\u7D04\u304C\u5165\u308A\u307E\u3057\u305F\u3002\n\u65E5\u6642: ${dateLabel} ${visitTime}\n\u4EBA\u6570: ${body.numGuests || 1}\u4EBA${methodLabel}\n\u96FB\u8A71: ${customerPhone}${memoLabel}\n\n` +
          (confirmed
            ? "\u5E97\u8217\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u306E\u7A7A\u304D\u3092\u78BA\u8A8D\u3057\u3001\u78BA\u5B9A\u6E08\u307F\u3067\u3059\u3002"
            : `\u672A\u78BA\u5B9A\u3067\u3059\u3002\u304A\u5BA2\u69D8\u3078\u9023\u7D61\u3057\u3001\u8A73\u7D30\u753B\u9762\u306E\u300C\u9023\u7D61\u6E08\u307F\u30FB\u78BA\u5B9A\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\u3002${link.kind === "linked" ? "" : "\uFF08" + link.reason + "\uFF09"}`),
        status: "DELIVERED",
      },
    });

    // 未確定の予約は担当者の対応が要る。確定済みなら confirmBooking 側で下ろしてある
    await prisma.customer.update({
      where: { id: customer.id },
      data: { isNeedAction: !confirmed, lastActiveAt: new Date() },
    });

    if (setting.autoReplySubject && setting.autoReplyBody && customerEmail) {
      const fromName = org.storeName || org.name || "ヘヤクレス";
      // implementation-spec-v1.md §1.3: 変数置換は lib/template-vars.ts に集約。
      // 来店予約固有の変数（visit_date 等）は extra で渡す。
      const varCtx = {
        customer: { ...customer, name: customerName },
        org,
        extra: {
          visit_date: visitDate,
          visit_time: visitTime,
          visit_method: visitMethod || "",
          num_guests: String(body.numGuests || 1),
          visit_memo: memo || "",
          // implementation-spec-v1.md §2.5: 未確定であることを顧客に伝える。
          // 定型文に {{visit_status}} が無い会社もあるので、無ければ末尾に足す。
          visit_status: confirmed
            ? "ご予約は確定しております。当日はお気をつけてお越しくださいませ。"
            : "現時点ではお席の確保が完了しておりません。店舗より確認のご連絡をいたします。",
        },
      };
      const subjectText = resolveTemplateVars(setting.autoReplySubject, varCtx);
      let bodyText = resolveTemplateVars(setting.autoReplyBody, varCtx);
      if (!setting.autoReplyBody.includes("{{visit_status}}")) {
        bodyText = `${bodyText}\n\n${varCtx.extra.visit_status}`;
      }

      try {
        const resend = getResend();
        if (!resend) throw new Error("メール送信が未設定です(RESEND_API_KEY)");
        // implementation-spec-v1.md §6: 会社ごとの差出人（無効化されていれば例外→下のcatchでログのみ）
        const emailCh = await resolveEmailChannel(org.id, customer.storeId);
        await resend.emails.send({
          from: buildEmailFrom(emailCh, fromName),
          to: customerEmail,
          subject: subjectText,
          text: bodyText,
        });

        await prisma.message.create({
          data: {
            customerId: customer.id,
            direction: "OUTBOUND",
            channel: "EMAIL",
            subject: subjectText,
            body: bodyText,
            status: "SENT",
          },
        });
      } catch (emailErr) {
        console.error("Auto-reply email error:", emailErr);
      }
    }

    return NextResponse.json({ success: true, bookingId: booking.id, status: confirmed ? "CONFIRMED" : "PENDING" });
  } catch (error) {
    console.error("POST store-visit-bookings error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
