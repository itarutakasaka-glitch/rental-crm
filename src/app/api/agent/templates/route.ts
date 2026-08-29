import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthUserForAction } from "@/lib/auth";

// エージェント(cron等)はCRON_SECRET+明示的なorgIdで呼ぶ。Web UIはログインユーザーのorganizationId。
async function resolveOrgId(req: NextRequest): Promise<string | null> {
  const secret = req.headers.get("x-agent-secret");
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (secret === process.env.CRON_SECRET && orgId) return orgId;

  const user = await getAuthUserForAction();
  return user?.organizationId || null;
}

// GET: Fetch all agent templates for organization
export async function GET(req: NextRequest) {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const templates = await (prisma as any).agentTemplate.findMany({
      where: { organizationId },
      orderBy: { key: "asc" },
    });
    return NextResponse.json({ templates });
  } catch {
    // Table might not exist yet
    return NextResponse.json({ templates: [] });
  }
}

// PUT: Upsert a single template
export async function PUT(req: NextRequest) {
  try {
    const organizationId = await resolveOrgId(req);
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { key, title, body } = await req.json();

    if (!key || !title || !body) {
      return NextResponse.json({ error: "key, title, body required" }, { status: 400 });
    }

    // Upsert using raw SQL since Prisma model might not be generated yet
    await prisma.$executeRawUnsafe(`
      INSERT INTO "AgentTemplate" ("id", "organizationId", "key", "title", "body", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())
      ON CONFLICT ("organizationId", "key")
      DO UPDATE SET "title" = $3, "body" = $4, "updatedAt" = NOW()
    `, organizationId, key, title, body);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
