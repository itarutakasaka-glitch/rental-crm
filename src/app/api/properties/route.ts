import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { organizationId: true },
    });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (customerId) {
      const pref = await prisma.customerPreference.findUnique({ where: { customerId } });

      const where: any = {
        organizationId: dbUser.organizationId!,
        isAvailable: true,
      };

      if (pref) {
        if (pref.rentMax) where.rent = { ...(where.rent || {}), lte: pref.rentMax };
        if (pref.rentMin) where.rent = { ...(where.rent || {}), gte: pref.rentMin };
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
      where: { organizationId: dbUser.organizationId! },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(properties);
  } catch (error) {
    console.error("[GET /api/properties]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}