import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pref = await prisma.customerPreference.findUnique({ where: { customerId: id } });
    return NextResponse.json(pref || {});
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { area, station, walkMinutes, rentMin, rentMax, layout, areaMin, moveInDate, petOk, autoLock, bathToiletSeparate, flooring, aircon, reheating, washletToilet, freeInternet, note } = body;
    const data = { area, station, walkMinutes, rentMin, rentMax, layout, areaMin, moveInDate, petOk, autoLock, bathToiletSeparate, flooring, aircon, reheating, washletToilet, freeInternet, note };
    const pref = await prisma.customerPreference.upsert({
      where: { customerId: id },
      update: data,
      create: { customerId: id, ...data },
    });
    return NextResponse.json(pref);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}