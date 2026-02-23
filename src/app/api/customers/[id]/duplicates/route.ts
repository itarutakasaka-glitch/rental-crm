import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";

function normalizePhone(phone) {
  if (!phone) return "";
  return phone.replace(/[\-\s\(\)\u3000\uFF0D]/g, "");
}

function lastNDigits(phone, n) {
  const normalized = normalizePhone(phone);
  if (normalized.length < n) return normalized;
  return normalized.slice(-n);
}

function nameTokens(name) {
  if (!name) return [];
  return name.trim().split(/[\s\u3000]+/).filter(Boolean);
}

function hasNameOverlap(a, b) {
  const tokensA = nameTokens(a);
  const tokensB = nameTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  return tokensA.some(ta => tokensB.some(tb => ta === tb));
}

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const target = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, name: true, phone: true, organizationId: true },
    });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const targetPhone4 = lastNDigits(target.phone, 4);
    if (!target.name || targetPhone4.length < 4) {
      return NextResponse.json({ duplicates: [] });
    }

    const candidates = await prisma.customer.findMany({
      where: {
        organizationId: target.organizationId,
        id: { not: id },
        phone: { not: null },
      },
      select: {
        id: true, name: true, nameKana: true, email: true, phone: true,
        sourcePortal: true, createdAt: true,
        status: { select: { name: true } },
        _count: { select: { messages: true } },
      },
    });

    const duplicates = candidates.filter(c => {
      const ph4 = lastNDigits(c.phone, 4);
      return ph4.length >= 4 && ph4 === targetPhone4 && hasNameOverlap(target.name, c.name);
    });

    return NextResponse.json({ duplicates });
  } catch (e) {
    console.error("[GET /api/customers/[id]/duplicates]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
