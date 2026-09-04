import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireCustomerAccess } from "@/lib/auth";
import { logFieldChanges } from "@/lib/audit";

// architecture-v2.md §10 S-1: 所属チェック追加(以前は無認証・他社顧客の希望条件を読み書きできた)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await requireCustomerAccess(id);
    if ("error" in r) return r.error;
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
    const r = await requireCustomerAccess(id);
    if ("error" in r) return r.error;
    const body = await req.json();
    const { area, station, walkMinutes, rentMin, rentMax, layout, areaMin, moveInDate, petOk, autoLock, bathToiletSeparate, flooring, aircon, reheating, washletToilet, freeInternet, note } = body;
    const data = { area, station, walkMinutes, rentMin, rentMax, layout, areaMin, moveInDate, petOk, autoLock, bathToiletSeparate, flooring, aircon, reheating, washletToilet, freeInternet, note };
    const before = await prisma.customerPreference.findUnique({ where: { customerId: id } });
    const pref = await prisma.customerPreference.upsert({
      where: { customerId: id },
      update: data,
      create: { customerId: id, ...data },
    });
    await logFieldChanges({ customerId: id, userId: r.user.id, action: "customer.preference.update" }, (before || {}) as any, data);
    return NextResponse.json(pref);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
