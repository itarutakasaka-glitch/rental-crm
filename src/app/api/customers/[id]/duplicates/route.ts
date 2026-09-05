import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireCustomerAccess } from "@/lib/auth";

function normalizePhone(phone: string | null | undefined) {
  if (!phone) return "";
  return phone.replace(/[\-\s\(\)　－]/g, "");
}

function lastNDigits(phone: string | null | undefined, n: number) {
  const normalized = normalizePhone(phone);
  if (normalized.length < n) return normalized;
  return normalized.slice(-n);
}

function nameTokens(name: string | null | undefined) {
  if (!name) return [];
  return name.trim().split(/[\s　]+/).filter(Boolean);
}

function hasNameOverlap(a: string | null | undefined, b: string | null | undefined) {
  const tokensA = nameTokens(a);
  const tokensB = nameTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  return tokensA.some((ta) => tokensB.some((tb) => ta === tb));
}

// implementation-spec-v1.md §3: 所属チェックを requireCustomerAccess に統一
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await requireCustomerAccess(id);
    if ("error" in r) return r.error;
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
      where: { organizationId: target.organizationId, id: { not: id }, phone: { not: null } },
      select: {
        id: true, name: true, nameKana: true, email: true, phone: true,
        sourcePortal: true, createdAt: true,
        status: { select: { name: true } },
        _count: { select: { messages: true } },
      },
    });

    const duplicates = candidates.filter((c) => {
      const ph4 = lastNDigits(c.phone, 4);
      return ph4.length >= 4 && ph4 === targetPhone4 && hasNameOverlap(target.name, c.name);
    });

    return NextResponse.json({ duplicates });
  } catch (e: any) {
    console.error("[GET /api/customers/[id]/duplicates]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
