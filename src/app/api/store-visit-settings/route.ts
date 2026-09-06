import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthUserForAction } from "@/lib/auth";
import { logFieldChanges } from "@/lib/audit";

// GET: 来店予約設定を取得
export async function GET() {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let setting = await prisma.storeVisitSetting.findUnique({
      where: { organizationId: user.organizationId },
    });

    if (!setting) {
      // 初回アクセス時にデフォルト作成
      setting = await prisma.storeVisitSetting.create({
        data: {
          organizationId: user.organizationId,
          enabled: false,
          closedDays: "火曜日、水曜日",
          availableTimeStart: "09:30",
          availableTimeEnd: "17:00",
          visitMethods: "店舗へ来店,ビデオ通話での相談,内見,その他",
          storeNotice: "",
          autoReplySubject: "{{customer_name}}様｜来店・内見のご予約ありがとうございます！｜{{store_name}}",
          autoReplyBody: "ご来店のご予約承りました。\n確認後再度ご連絡いたします。\n引き続きどうぞよろしくお願いいたします。\n\n--------------------------------------------------\n{{store_name}}\n{{store_address}}\nTEL {{store_phone}}\nMail こちらのメールにそのままご返信ください\n--------------------------------------------------",
        },
      });
    }

    return NextResponse.json(setting);
  } catch (error) {
    console.error("GET store-visit-settings error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PUT: 来店予約設定を更新
export async function PUT(request: Request) {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();

    // implementation-spec-v1.md §3: 来店予約の受付可否・時間帯・自動返信文は顧客に見える設定なので監査ログに残す
    const before = await prisma.storeVisitSetting.findUnique({ where: { organizationId: user.organizationId } });

    const setting = await prisma.storeVisitSetting.upsert({
      where: { organizationId: user.organizationId },
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
        organizationId: user.organizationId,
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

    await logFieldChanges(
      { userId: user.id, organizationId: user.organizationId, action: "storeVisitSetting.update" },
      (before || {}) as any,
      {
        enabled: setting.enabled, closedDays: setting.closedDays,
        availableTimeStart: setting.availableTimeStart, availableTimeEnd: setting.availableTimeEnd,
        visitMethods: setting.visitMethods, storeNotice: setting.storeNotice,
        autoReplySubject: setting.autoReplySubject, autoReplyBody: setting.autoReplyBody,
      }
    );
    return NextResponse.json(setting);
  } catch (error) {
    console.error("PUT store-visit-settings error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
