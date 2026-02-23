import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  if (!customerId) return NextResponse.json({ error: "Missing customerId" }, { status: 400 });

  const pref = await prisma.customerPreference.findUnique({ where: { customerId } });
  return NextResponse.json(pref);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { customerId, ...raw } = body;
    if (!customerId) return NextResponse.json({ error: "Missing customerId" }, { status: 400 });

    const toInt = (v: any) => { const n = parseInt(v); return isNaN(n) ? null : n; };
    const toFloat = (v: any) => { const n = parseFloat(v); return isNaN(n) ? null : n; };

    const data = {
      area: raw.area || null,
      station: raw.station || null,
      walkMinutes: toInt(raw.walkMinutes),
      layout: raw.layout || null,
      rentMin: toInt(raw.rentMin),
      rentMax: toInt(raw.rentMax),
      areaMin: toFloat(raw.areaMin),
      moveInDate: raw.moveInDate || null,
      petOk: !!raw.petOk,
      autoLock: !!raw.autoLock,
      bathToiletSeparate: !!raw.bathToiletSeparate,
      flooring: !!raw.flooring,
      aircon: !!raw.aircon,
      reheating: !!raw.reheating,
      washletToilet: !!raw.washletToilet,
      freeInternet: !!raw.freeInternet,
      note: raw.note || null,
    };

    const pref = await prisma.customerPreference.upsert({
      where: { customerId },
      update: { ...data, updatedAt: new Date() },
      create: { customerId, ...data },
    });

    return NextResponse.json(pref);
  } catch (error) {
    console.error("[POST /api/customers/preference]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}