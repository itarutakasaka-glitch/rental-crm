import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser, requireCustomerAccess } from "@/lib/auth";

// ★2026-09-06 発見・修正: customerId をクエリで受け取り、所属を確認せずに
// CustomerPreference（希望条件＝予算・エリア・入居時期という個人情報）を返していた。
// 物件側は組織で絞られていたが、希望条件は他社の顧客のものでも読めた（S-1 と同型のIDOR）。
// 顧客IDを扱う route は必ず requireCustomerAccess を通す（route-auth-guard.test.ts が検査する）。
export async function GET(request: NextRequest) {
  try {
    const authed = await requireUser();
    if ("error" in authed) return authed.error;

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    if (customerId) {
      const r = await requireCustomerAccess(customerId);
      if ("error" in r) return r.error;
      const pref = await prisma.customerPreference.findUnique({ where: { customerId } });

      const where: any = {
        // 提案する物件は顧客の所属会社のもの（操作者の所属ではない。staff の横断対応で混ざらないように）
        organizationId: r.customer.organizationId,
        isAvailable: true,
      };

      if (pref) {
        if (pref.rentMax) where.rent = { ...(where.rent || {}), lte: pref.rentMax * 10000 };
        if (pref.rentMin) where.rent = { ...(where.rent || {}), gte: pref.rentMin * 10000 };
        if (pref.areaMin) where.area = { gte: pref.areaMin };
        if (pref.layout) {
          const layouts = pref.layout.split(",").map((s: string) => s.trim());
          where.layout = { in: layouts };
        }
        if (pref.station) {
          where.station = { contains: pref.station };
        }
        if (pref.walkMinutes) {
          where.walkMinutes = { lte: pref.walkMinutes };
        }
      }

      const properties = await prisma.property.findMany({ where, orderBy: { rent: "asc" }, take: 20 });
      return NextResponse.json({ properties, preference: pref });
    }

    const properties = await prisma.property.findMany({
      where: { organizationId: authed.user.organizationId },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(properties);
  } catch (error) {
    console.error("[GET /api/properties]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}