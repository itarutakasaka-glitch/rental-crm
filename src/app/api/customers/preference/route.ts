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
    const { customerId, budgetMin, budgetMax, preferredLayouts, preferredStations, preferredAreas, minArea, maxAge, moveInDate, otherNotes } = body;

    if (!customerId) return NextResponse.json({ error: "Missing customerId" }, { status: 400 });

    const pref = await prisma.customerPreference.upsert({
      where: { customerId },
      update: { budgetMin, budgetMax, preferredLayouts, preferredStations, preferredAreas, minArea, maxAge, moveInDate, otherNotes, updatedAt: new Date() },
      create: { customerId, budgetMin, budgetMax, preferredLayouts, preferredStations, preferredAreas, minArea, maxAge, moveInDate, otherNotes },
    });

    return NextResponse.json(pref);
  } catch (error) {
    console.error("[POST /api/customers/preference]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}