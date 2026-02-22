import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
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
      customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (customer) {
        customerName = customer.name || customerName;
        customerEmail = customer.email || customerEmail;
        customerPhone = phone || customer.phone || customerPhone;
        await prisma.customer.update({
          where: { id: customer.id },
          data: { isNeedAction: true, phone: customerPhone || customer.phone },
        });
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

    const booking = await prisma.storeVisitBooking.create({
      data: {
        organizationId,
        customerId: customer.id,
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        visitDate: new Date(visitDate),
        visitTime,
        visitMethod: visitMethod || "",
        memo: memo || "",
        status: "PENDING",
      },
    });

    const [hours, minutes] = visitTime.split(":").map(Number);
    const startAt = new Date(visitDate);
    startAt.setHours(hours, minutes, 0, 0);
    const endAt = new Date(startAt);
    endAt.setHours(endAt.getHours() + 1);

    await prisma.schedule.create({
      data: {
        organizationId,
        customerId: customer.id,
        title: `${customerName} - \u6765\u5e97\u4e88\u7d04`,
        description: `${visitMethod ? visitMethod + "\n" : ""}${memo || ""}`,
        type: "VISIT",
        startAt,
        endAt,
      },
    });

    if (setting.autoReplySubject && setting.autoReplyBody && customerEmail) {
      const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com";
      const fromName = org.storeName || org.name || "CRM";
      const visitUrl = `https://tama-fudosan-crm-2026.vercel.app/visit/${organizationId}?c=${customer.id}`;

      const vars: Record<string, string> = {
        "{{customer_name}}": customerName,
        "{{store_name}}": org.storeName || org.name || "",
        "{{store_address}}": org.storeAddress || org.address || "",
        "{{store_phone}}": org.storePhone || org.phone || "",
        "{{visit_date}}": visitDate,
        "{{visit_time}}": visitTime,
        "{{visit_method}}": visitMethod || "",
        "{{visit_url}}": visitUrl,
        "{{line_url}}": org.lineUrl || "",
      };

      let subjectText = setting.autoReplySubject;
      let bodyText = setting.autoReplyBody;
      for (const [k, v] of Object.entries(vars)) {
        subjectText = subjectText.replaceAll(k, v);
        bodyText = bodyText.replaceAll(k, v);
      }

      try {
        await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
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

    return NextResponse.json({ success: true, bookingId: booking.id });
  } catch (error) {
    console.error("POST store-visit-bookings error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
