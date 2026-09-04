import { NextRequest, NextResponse } from "next/server";
import { verifySharedSecret } from "@/lib/shared-secret";
import { prisma } from "@/lib/db/prisma";
import { processAutoStatusChange } from "@/lib/status-rules";

export async function GET(req: NextRequest) {
  // architecture-v2.md §10 A-5: fail-closed。Vercel Cron は Authorization ヘッダで呼ぶのでクエリは受けない。
  const denied = verifySharedSecret(req);
  if (denied) return denied;
  const threshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const stale = await prisma.customer.findMany({
    where: { isNeedAction: false, lastActiveAt: { lt: threshold }, status: { name: { in: ["初期対応済", "追客中"] } } },
    select: { id: true },
  });
  for (const c of stale) await processAutoStatusChange(c.id, "NO_RESPONSE_48H");
  return NextResponse.json({ checked: stale.length });
}
