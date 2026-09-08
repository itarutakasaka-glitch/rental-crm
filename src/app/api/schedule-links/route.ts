import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser, requireAdminUser } from "@/lib/auth";
import { encryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

// implementation-spec-v1.md §6.2 (M-10): 店舗ごとの外部カレンダー連動設定。
// INTERNAL は CRM 内の枠だけで「連動あり」を成立させる（外部サービスに繋がない）。
const PROVIDERS = ["INTERNAL", "GOOGLE_CALENDAR", "CYBOZU", "TIMETREE", "CANARY"] as const;

export async function GET() {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const stores = await prisma.store.findMany({
    where: { organizationId: r.user.organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, scheduleLink: true },
  });
  const setting = await prisma.storeVisitSetting.findUnique({ where: { organizationId: r.user.organizationId } });
  return NextResponse.json({
    stores: stores.map((s) => ({
      id: s.id,
      name: s.name,
      link: s.scheduleLink
        ? {
            provider: s.scheduleLink.provider,
            isActive: s.scheduleLink.isActive,
            calendarId: s.scheduleLink.calendarId,
            slotMinutes: s.scheduleLink.slotMinutes,
            hoursStart: s.scheduleLink.hoursStart,
            hoursEnd: s.scheduleLink.hoursEnd,
            hasSecret: !!s.scheduleLink.secretEnc,
            lastErrorAt: s.scheduleLink.lastErrorAt,
            lastError: s.scheduleLink.lastError,
          }
        : null,
    })),
    defaultHours: { start: setting?.availableTimeStart || "09:30", end: setting?.availableTimeEnd || "17:00" },
  });
}

export async function PUT(req: NextRequest) {
  const r = await requireAdminUser();
  if ("error" in r) return r.error;
  const body = await req.json().catch(() => ({}));
  const { storeId, provider, isActive, calendarId, slotMinutes, hoursStart, hoursEnd, secret } = body || {};

  if (!storeId) return NextResponse.json({ error: "storeId は必須です" }, { status: 400 });
  if (provider && !PROVIDERS.includes(provider)) return NextResponse.json({ error: "provider が不正です" }, { status: 400 });

  const store = await prisma.store.findFirst({ where: { id: storeId, organizationId: r.user.organizationId }, select: { id: true } });
  if (!store) return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });

  if (secret && !isEncryptionConfigured()) {
    return NextResponse.json({ error: "CHANNEL_SECRET_KEY が未設定のため認証情報を保存できません" }, { status: 400 });
  }

  const data: any = {
    provider: provider || "INTERNAL",
    isActive: !!isActive,
    calendarId: calendarId || null,
    slotMinutes: Number(slotMinutes) > 0 ? Number(slotMinutes) : 60,
    hoursStart: hoursStart || null,
    hoursEnd: hoursEnd || null,
    // 設定を直したら「失敗中」を解除する（直したのに連動なし扱いのままにしない）
    lastErrorAt: null,
    lastError: null,
  };
  if (secret) data.secretEnc = encryptSecret(secret);

  const row = await prisma.storeScheduleLink.upsert({
    where: { storeId },
    update: data,
    create: { ...data, storeId },
  });

  await logAudit({
    userId: r.user.id,
    organizationId: r.user.organizationId,
    action: "scheduleLink.update",
    field: storeId,
    newValue: `provider=${row.provider} active=${row.isActive} slot=${row.slotMinutes}`,
  });
  return NextResponse.json({ ok: true });
}
