import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireCustomerAccess } from "@/lib/auth";
import { logFieldChanges } from "@/lib/audit";

// implementation-spec-v1.md §3: 所属チェック(以前は GET が無認証、POST は所属未確認)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  if (!customerId) return NextResponse.json({ error: "Missing customerId" }, { status: 400 });
  const r = await requireCustomerAccess(customerId);
  if ("error" in r) return r.error;
  const pref = await prisma.customerPreference.findUnique({ where: { customerId } });
  return NextResponse.json(pref);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, ...raw } = body;
    if (!customerId) return NextResponse.json({ error: "Missing customerId" }, { status: 400 });
    const r = await requireCustomerAccess(customerId);
    if ("error" in r) return r.error;

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

    const before = await prisma.customerPreference.findUnique({ where: { customerId } });
    const pref = await prisma.customerPreference.upsert({
      where: { customerId },
      update: { ...data, updatedAt: new Date() },
      create: { customerId, ...data },
    });
    await logFieldChanges({ customerId, userId: r.user.id, organizationId: r.customer.organizationId, action: "customer.preference.update" }, (before || {}) as any, data);
    return NextResponse.json(pref);
  } catch (error) {
    console.error("[POST /api/customers/preference]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
