import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthUserForAction } from "@/lib/auth";
import { verifySharedSecret } from "@/lib/shared-secret";
import { logAudit } from "@/lib/audit";

// エージェント(cron等)は共有秘密鍵+明示的なorgIdで呼ぶ。Web UIはログインユーザーのorganizationId。
// implementation-spec-v1.md §3: 秘密鍵の検証は verifySharedSecret に統一（fail-closed・timingSafeEqual）。
async function resolveContext(req: NextRequest): Promise<{ organizationId: string; userId: string | null } | null> {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (orgId && req.headers.get("x-agent-secret")) {
    const denied = verifySharedSecret(req);
    if (denied) return null;
    return { organizationId: orgId, userId: null };
  }
  const user = await getAuthUserForAction();
  if (!user) return null;
  return { organizationId: user.organizationId, userId: user.id };
}

// GET: Fetch all agent templates for organization
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const templates = await (prisma as any).agentTemplate.findMany({
      where: { organizationId: ctx.organizationId },
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
    const ctx = await resolveContext(req);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    `, ctx.organizationId, key, title, body);

    // implementation-spec-v1.md §3: エージェントが送る文面のもとなので監査ログに残す
    await logAudit({ userId: ctx.userId, organizationId: ctx.organizationId, action: "agentTemplate.update", field: key, newValue: body });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
