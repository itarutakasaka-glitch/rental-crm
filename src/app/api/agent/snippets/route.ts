import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthUserForAction } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import snippetsData from "@/data/text_blaze_all_snippets.json";

// GET: Return all snippets merged with DB overrides
export async function GET() {
  const user = await getAuthUserForAction();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get DB overrides
  let overrides: Record<string, string> = {};
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT "key", "body" FROM "AgentTemplate" WHERE "organizationId" = $1 AND "key" LIKE 'snippet_%'`, user.organizationId
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
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { key, text } = await req.json();
    if (!key || !text) return NextResponse.json({ error: "key, text required" }, { status: 400 });

    await prisma.$executeRawUnsafe(`
      INSERT INTO "AgentTemplate" ("id","organizationId","key","title","body","updatedAt")
      VALUES (gen_random_uuid()::text,$1,$2,$3,$4,NOW())
      ON CONFLICT ("organizationId","key")
      DO UPDATE SET "body"=$4, "updatedAt"=NOW()
    `, user.organizationId, key, key, text);

    // implementation-spec-v1.md §3: 定型文の変更は顧客に届く文面を変えるので監査ログに残す
    await logAudit({ userId: user.id, organizationId: user.organizationId, action: "snippet.update", field: key, newValue: text });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
