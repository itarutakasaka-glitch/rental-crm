import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import snippetsData from "@/data/text_blaze_all_snippets.json";

// GET: Return all snippets merged with DB overrides
export async function GET() {
  const org = await prisma.organization.findFirst();
  const orgId = org?.id || "org_default";
  
  // Get DB overrides
  let overrides: Record<string, string> = {};
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT "key", "body" FROM "AgentTemplate" WHERE "organizationId" = $1 AND "key" LIKE 'snippet_%'`, orgId
    ) as any[];
    rows.forEach((r: any) => { overrides[r.key] = r.body; });
  } catch {}

  // Merge: base JSON + DB overrides
  const categories: Record<string, any[]> = {};
  for (const [cat, items] of Object.entries(snippetsData as Record<string, any[]>)) {
    categories[cat] = items.map((item: any, i: number) => {
      const key = `snippet_${cat}_${i}`;
      return {
        key,
        name: item.name,
        text: overrides[key] || item.text,
        category: cat,
        isCustomized: !!overrides[key],
      };
    });
  }
  return NextResponse.json({ categories });
}

// PUT: Save snippet override
export async function PUT(req: NextRequest) {
  try {
    const { key, text } = await req.json();
    if (!key || !text) return NextResponse.json({ error: "key, text required" }, { status: 400 });
    const org = await prisma.organization.findFirst();
    const orgId = org?.id || "org_default";
    
    await prisma.$executeRawUnsafe(`
      INSERT INTO "AgentTemplate" ("id","organizationId","key","title","body","updatedAt")
      VALUES (gen_random_uuid()::text,$1,$2,$3,$4,NOW())
      ON CONFLICT ("organizationId","key")
      DO UPDATE SET "body"=$4, "updatedAt"=NOW()
    `, orgId, key, key, text);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
