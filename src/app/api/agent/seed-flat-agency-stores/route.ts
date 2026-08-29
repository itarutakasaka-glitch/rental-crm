import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// 2026-08-29: inquiry-agent(フラットエージェンシー店舗振り分け)のデモ用実データ投入。
// 既存の店舗マスタ(flat-agency-router.ts のSTORES定数)をStore/StoreClosedDayRuleに変換。
// 冪等: 既にStore.slugが存在する組織には何もしない。
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-agent-secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const org = await prisma.organization.findFirst();
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const existing = await prisma.store.findFirst({ where: { organizationId: org.id } });
    if (existing) {
      return NextResponse.json({ success: true, message: "already seeded", skipped: true });
    }

    const STORE_DEFS = [
      { name: "左京店", slug: "sakyo", closedWeekdays: [3], closedNthSundays: [1, 3], holidayClosed: false },
      { name: "本店", slug: "honten", closedWeekdays: [3], closedNthSundays: [2, 4], holidayClosed: false },
      { name: "産業大学前店", slug: "sangyodai", closedWeekdays: [3, 0], closedNthSundays: [], holidayClosed: true },
    ];

    const created = [];
    for (const def of STORE_DEFS) {
      const store = await prisma.store.create({
        data: { organizationId: org.id, name: def.name, slug: def.slug, isDefault: def.name === "本店" },
      });
      for (const wd of def.closedWeekdays) {
        await prisma.storeClosedDayRule.create({
          data: { storeId: store.id, type: "WEEKLY", weekday: wd, includeHolidays: def.holidayClosed },
        });
      }
      for (const nth of def.closedNthSundays) {
        await prisma.storeClosedDayRule.create({
          data: { storeId: store.id, type: "NTH_WEEKDAY", weekday: 0, nth },
        });
      }
      created.push(store.name);
    }

    // GW臨時休業(inquiry-agent router.jsの臨時休業定数と同じ内容の例)
    const honten = await prisma.store.findFirst({ where: { organizationId: org.id, slug: "honten" } });
    const sakyo = await prisma.store.findFirst({ where: { organizationId: org.id, slug: "sakyo" } });
    for (const s of [honten, sakyo]) {
      if (s) {
        await prisma.storeClosedDayRule.create({
          data: { storeId: s.id, type: "DATE_RANGE", startDate: new Date("2026-05-03"), endDate: new Date("2026-05-06"), note: "GW" },
        });
      }
    }

    return NextResponse.json({ success: true, created });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
