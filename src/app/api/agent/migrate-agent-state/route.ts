import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifySharedSecret } from "@/lib/shared-secret";
import { inferStateFromLegacyMemo, stripLegacyMarkers } from "@/lib/agent-state";
import { logAudit } from "@/lib/audit";

// implementation-spec-v1.md §2.2 / M-1: memo の旧マーカーを Customer.agentState に変換し、memo から除去する。
// 冪等(マーカーが無くなれば何もしない)。dryRun=1 で件数だけ返す。
// 実行後は削除候補(§3 seed と同じ扱い)。
export async function POST(req: NextRequest) {
  const denied = verifySharedSecret(req);
  if (denied) return denied;
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  const candidates = await prisma.customer.findMany({
    where: { OR: [{ memo: { contains: "[AGENT" } }, { memo: { contains: "[CLASSIFY_PENDING]" } }, { memo: { contains: "[CONFIRM_PENDING]" } }, { memo: { contains: "[AI分類" } }, { memo: { contains: "[アポ確定" } }] },
    select: { id: true, organizationId: true, memo: true, agentState: true },
    take: 2000,
  });

  const summary: Record<string, number> = {};
  const changed: { id: string; from: string; to: string }[] = [];
  for (const c of candidates) {
    const inferred = inferStateFromLegacyMemo(c.memo);
    const to = inferred || c.agentState;
    const newMemo = stripLegacyMarkers(c.memo);
    summary[to] = (summary[to] || 0) + 1;
    if (!dryRun) {
      await prisma.customer.update({ where: { id: c.id }, data: { agentState: to, memo: newMemo || null } });
      await logAudit({ customerId: c.id, organizationId: c.organizationId, action: "customer.agentState.migrate", field: "agentState", oldValue: c.memo, newValue: to });
    }
    changed.push({ id: c.id, from: c.agentState, to });
  }
  return NextResponse.json({ dryRun, candidates: candidates.length, summary, changed: changed.slice(0, 50) });
}
