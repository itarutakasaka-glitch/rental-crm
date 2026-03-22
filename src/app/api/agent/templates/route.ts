import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET: Fetch all agent templates for organization
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-agent-secret");
  // Allow both agent secret and authenticated users
  const isAgent = secret === process.env.CRON_SECRET;
  
  // For agent: use orgId param. For web: use first org.
  const orgId = req.nextUrl.searchParams.get("orgId");
  
  let organizationId = orgId;
  if (!organizationId) {
    const org = await prisma.organization.findFirst();
    organizationId = org?.id || "";
  }
  
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
    const { key, title, body, organizationId: reqOrgId } = await req.json();
    
    let organizationId = reqOrgId;
    if (!organizationId) {
      const org = await prisma.organization.findFirst();
      organizationId = org?.id || "";
    }
    
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
