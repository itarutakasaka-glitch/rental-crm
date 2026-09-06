import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser, requireAdminUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// implementation-spec-v1.md §4.3: 会社のタグ候補（tagPresets）と、実際に使われているタグ。
// 候補は補完用で、候補に無い自由入力も許す（現場が先に使い始めたタグを後から候補に足せる）。
const MAX_PRESETS = 50;

export async function GET() {
  const r = await requireUser();
  if ("error" in r) return r.error;

  const [org, inUse] = await Promise.all([
    prisma.organization.findUnique({ where: { id: r.user.organizationId }, select: { tagPresets: true } }),
    prisma.customerTag.findMany({
      where: { customer: { organizationId: r.user.organizationId } },
      select: { name: true },
      distinct: ["name"],
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);
  return NextResponse.json({ presets: org?.tagPresets || [], inUse: inUse.map((t) => t.name) });
}

export async function PUT(req: NextRequest) {
  const r = await requireAdminUser();
  if ("error" in r) return r.error;
  const { presets } = await req.json();
  if (!Array.isArray(presets)) return NextResponse.json({ error: "presets は配列です" }, { status: 400 });

  const cleaned = Array.from(
    new Set(
      presets
        .filter((p: unknown): p is string => typeof p === "string")
        .map((p) => p.trim().replace(/\s+/g, " "))
        .filter((p) => p.length > 0 && p.length <= 30)
    )
  ).slice(0, MAX_PRESETS);

  await prisma.organization.update({ where: { id: r.user.organizationId }, data: { tagPresets: cleaned } });
  await logAudit({ userId: r.user.id, organizationId: r.user.organizationId, action: "organization.tagPresets.update", newValue: cleaned.join(",") });
  return NextResponse.json({ presets: cleaned });
}
