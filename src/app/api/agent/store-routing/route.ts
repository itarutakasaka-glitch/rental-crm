import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthUserForAction } from "@/lib/auth";
import { generateDrafts, type DraftTemplates } from "@/lib/store-routing/flat-agency-drafts";
import type { RouterInput } from "@/lib/store-routing/flat-agency-router";

// inquiry-agent(対応店舗判断エージェント)のCRM組み込み版・第一弾。
// 現状はフラットエージェンシー固有ロジックのみ(store-hierarchy-design.md参照)。
// 出力は「推奨」であり、送信・タグ付けは人間が確認して行う(Phase1=下書き承認方式)。
const DRAFT_TEMPLATE_KEYS = ["tpl_mail_en", "tpl_mail_zh", "tpl_foreign_general"] as const;

export async function POST(req: NextRequest) {
  const user = await getAuthUserForAction();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const 反響: RouterInput = body.反響 || {};
    const customer = body.customer || { name: "" };
    const dateStr: string = body.dateStr || new Date().toISOString().slice(0, 10);

    // architecture-v2.md §8 Step4: drafts.tsのハードコード文面より、組織のAgentTemplateを優先する。
    const rows = await (prisma as any).agentTemplate.findMany({
      where: { organizationId: user.organizationId, key: { in: DRAFT_TEMPLATE_KEYS as unknown as string[] } },
      select: { key: true, body: true },
    });
    const templates: DraftTemplates = {};
    for (const row of rows) templates[row.key as keyof DraftTemplates] = row.body;

    const result = generateDrafts({ 反響, customer, dateStr, templates });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
