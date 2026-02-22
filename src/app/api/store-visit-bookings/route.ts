import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId, name, email, phone, visitDate, visitTime, visitMethod, memo } = body;

    if (!organizationId || !name || !email || !visitDate || !visitTime) {
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

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: { email, organizationId },
    });

    const defaultStatus = await prisma.status.findFirst({
      where: { organizationId, isDefault: true },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name,
          email,
          phone: phone || "",
          organizationId,
          sourcePortal: "STORE_VISIT",
          isNeedAction: true,
          statusId: defaultStatus?.id || undefined,
        },
      });
    } else {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { isNeedAction: true },
      });
    }

    // Create booking
    const booking = await prisma.storeVisitBooking.create({
      data: {
        organizationId,
        customerId: customer.id,
        name,
        email,
        phone: phone || "",
        visitDate: new Date(visitDate),
        visitTime,
        visitMethod: visitMethod || "",
        memo: memo || "",
        status: "PENDING",
      },
    });

    // Create schedule
    const [hours, minutes] = visitTime.split(":").map(Number);
    const startAt = new Date(visitDate);
    startAt.setHours(hours, minutes, 0, 0);
    const endAt = new Date(startAt);
    endAt.setHours(endAt.getHours() + 1);

    await prisma.schedule.create({
      data: {
        organizationId,
        customerId: customer.id,
        title: `${name} - \u6765\u5e97\u4e88\u7d04`,
        description: `${visitMethod ? visitMethod + "\n" : ""}${memo || ""}`,
        type: "VISIT",
        startAt,
        endAt,
      },
    });

    // Send auto-reply email
    if (setting.autoReplySubject && setting.autoReplyBody && email) {
      const vars: Record<string, string> = {
        "{{customer_name}}": name,
        "{{store_name}}": org.storeName || org.name || "",
        "{{store_address}}": org.storeAddress || org.address || "",
        "{{store_phone}}": org.storePhone || org.phone || "",
        "{{visit_date}}": visitDate,
        "{{visit_time}}": visitTime,
        "{{visit_method}}": visitMethod || "",
      };

      let subject = setting.autoReplySubject;
      let bodyText = setting.autoReplyBody;
      for (const [k, v] of Object.entries(vars)) {
        subject = subject.replaceAll(k, v);
        bodyText = bodyText.replaceAll(k, v);
      }

      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com",
          to: email,
          subject,
          text: bodyText,
        });

        await prisma.message.create({
          data: {
            customerId: customer.id,
            direction: "OUTBOUND",
            channel: "EMAIL",
            subject,
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
