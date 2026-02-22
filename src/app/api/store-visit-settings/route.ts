import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET: \u6765\u5e97\u4e88\u7d04\u8a2d\u5b9a\u3092\u53d6\u5f97
export async function GET() {
  try {
    const org = await prisma.organization.findFirst();
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    let setting = await prisma.storeVisitSetting.findUnique({
      where: { organizationId: org.id },
    });

    if (!setting) {
      // \u521d\u56de\u30a2\u30af\u30bb\u30b9\u6642\u306b\u30c7\u30d5\u30a9\u30eb\u30c8\u4f5c\u6210
      setting = await prisma.storeVisitSetting.create({
        data: {
          organizationId: org.id,
          enabled: false,
          closedDays: "\u706b\u66dc\u65e5\u3001\u6c34\u66dc\u65e5",
          availableTimeStart: "09:30",
          availableTimeEnd: "17:00",
          visitMethods: "\u5e97\u8217\u3078\u6765\u5e97,\u30d3\u30c7\u30aa\u901a\u8a71\u3067\u306e\u76f8\u8ac7,\u5185\u898b,\u305d\u306e\u4ed6",
          storeNotice: "",
          autoReplySubject: "{{customer_name}}\u69d8\uff5c\u6765\u5e97\u30fb\u5185\u898b\u306e\u3054\u4e88\u7d04\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059\uff01\uff5c{{store_name}}",
          autoReplyBody: "\u3054\u6765\u5e97\u306e\u3054\u4e88\u7d04\u627f\u308a\u307e\u3057\u305f\u3002\n\u78ba\u8a8d\u5f8c\u518d\u5ea6\u3054\u9023\u7d61\u3044\u305f\u3057\u307e\u3059\u3002\n\u5f15\u304d\u7d9a\u304d\u3069\u3046\u305e\u3088\u308d\u3057\u304f\u304a\u9858\u3044\u3044\u305f\u3057\u307e\u3059\u3002\n\n--------------------------------------------------\n{{store_name}}\n{{store_address}}\nTEL {{store_phone}}\nMail \u3053\u3061\u3089\u306e\u30e1\u30fc\u30eb\u306b\u305d\u306e\u307e\u307e\u3054\u8fd4\u4fe1\u304f\u3060\u3055\u3044\n--------------------------------------------------",
        },
      });
    }

    return NextResponse.json(setting);
  } catch (error) {
    console.error("GET store-visit-settings error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PUT: \u6765\u5e97\u4e88\u7d04\u8a2d\u5b9a\u3092\u66f4\u65b0
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const org = await prisma.organization.findFirst();
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const setting = await prisma.storeVisitSetting.upsert({
      where: { organizationId: org.id },
      update: {
        enabled: body.enabled,
        closedDays: body.closedDays ?? "",
        availableTimeStart: body.availableTimeStart ?? "09:30",
        availableTimeEnd: body.availableTimeEnd ?? "17:00",
        visitMethods: body.visitMethods ?? "",
        storeNotice: body.storeNotice ?? "",
        autoReplySubject: body.autoReplySubject ?? "",
        autoReplyBody: body.autoReplyBody ?? "",
        updatedAt: new Date(),
      },
      create: {
        organizationId: org.id,
        enabled: body.enabled ?? false,
        closedDays: body.closedDays ?? "",
        availableTimeStart: body.availableTimeStart ?? "09:30",
        availableTimeEnd: body.availableTimeEnd ?? "17:00",
        visitMethods: body.visitMethods ?? "",
        storeNotice: body.storeNotice ?? "",
        autoReplySubject: body.autoReplySubject ?? "",
        autoReplyBody: body.autoReplyBody ?? "",
      },
    });

    return NextResponse.json(setting);
  } catch (error) {
    console.error("PUT store-visit-settings error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
