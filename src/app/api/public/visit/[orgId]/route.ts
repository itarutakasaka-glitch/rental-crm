import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const url = new URL(request.url);
    const customerId = url.searchParams.get("c");

    const setting = await prisma.storeVisitSetting.findUnique({
      where: { organizationId: orgId },
    });
    if (!setting || !setting.enabled) {
      return NextResponse.json({ error: "Booking not available" }, { status: 404 });
    }
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, storeName: true, storeAddress: true, storePhone: true, storeHours: true },
    });

    let customer = undefined;
    if (customerId) {
      const c = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, name: true },
      });
      if (c) customer = c;
    }

    return NextResponse.json({
      setting: {
        closedDays: setting.closedDays,
        availableTimeStart: setting.availableTimeStart,
        availableTimeEnd: setting.availableTimeEnd,
        visitMethods: setting.visitMethods,
        storeNotice: setting.storeNotice,
      },
      organization: org,
      customer,
    });
  } catch (error) {
    console.error("GET public visit error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
