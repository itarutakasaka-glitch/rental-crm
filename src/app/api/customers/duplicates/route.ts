import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";

function normalizePhone(phone: string | null): string {
  if (!phone) return "";
  return phone.replace(/[\-\s\(\)\u3000\uFF0D]/g, "");
}

function lastNDigits(phone: string, n: number): string {
  const normalized = normalizePhone(phone);
  if (normalized.length < n) return normalized;
  return normalized.slice(-n);
}

function nameTokens(name: string | null): string[] {
  if (!name) return [];
  return name.trim().split(/[\s\u3000]+/).filter(Boolean);
}

function hasNameOverlap(a: string | null, b: string | null): boolean {
  const tokensA = nameTokens(a);
  const tokensB = nameTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  return tokensA.some(ta => tokensB.some(tb => ta === tb));
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { organizationId: true },
    });
    if (!dbUser?.organizationId) return NextResponse.json({ error: "No org" }, { status: 400 });

    const customers = await prisma.customer.findMany({
      where: { organizationId: dbUser.organizationId },
      select: {
        id: true,
        name: true,
        nameKana: true,
        email: true,
        phone: true,
        sourcePortal: true,
        createdAt: true,
        status: { select: { name: true } },
        assignee: { select: { name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const duplicateGroups: { customers: typeof customers }[] = [];
    const matched = new Set<string>();

    for (let i = 0; i < customers.length; i++) {
      if (matched.has(customers[i].id)) continue;
      const group = [customers[i]];

      for (let j = i + 1; j < customers.length; j++) {
        if (matched.has(customers[j].id)) continue;

        const a = customers[i];
        const b = customers[j];

        const phoneA = lastNDigits(a.phone, 4);
        const phoneB = lastNDigits(b.phone, 4);
        const phoneMatch = phoneA.length >= 4 && phoneB.length >= 4 && phoneA === phoneB;

        const nameMatch = hasNameOverlap(a.name, b.name);

        if (nameMatch && phoneMatch) {
          group.push(customers[j]);
          matched.add(customers[j].id);
        }
      }

      if (group.length > 1) {
        matched.add(customers[i].id);
        duplicateGroups.push({ customers: group });
      }
    }

    return NextResponse.json({ groups: duplicateGroups, totalGroups: duplicateGroups.length });
  } catch (e: any) {
    console.error("[GET /api/customers/duplicates]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
