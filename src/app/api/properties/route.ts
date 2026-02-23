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

    // If customerId provided, do matching
    if (customerId) {
      const pref = await prisma.customerPreference.findUnique({
        where: { customerId },
      });

      const where: any = {
        organizationId: dbUser.organizationId!,
        isAvailable: true,
      };

      if (pref) {
        if (pref.budgetMax) where.rent = { ...(where.rent || {}), lte: pref.budgetMax };
        if (pref.budgetMin) where.rent = { ...(where.rent || {}), gte: pref.budgetMin };
        if (pref.minArea) where.area = { gte: pref.minArea };
        if (pref.maxAge) where.age = { lte: pref.maxAge };
        if (pref.preferredLayouts) {
          const layouts = pref.preferredLayouts.split(",").map((s: string) => s.trim());
          where.layout = { in: layouts };
        }
        if (pref.preferredStations) {
          const stations = pref.preferredStations.split(",").map((s: string) => s.trim());
          where.station = { in: stations };
        }
      }

      const properties = await prisma.property.findMany({
        where,
        orderBy: { rent: "asc" },
        take: 20,
      });

      return NextResponse.json({ properties, preference: pref });
    }

    // All properties
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