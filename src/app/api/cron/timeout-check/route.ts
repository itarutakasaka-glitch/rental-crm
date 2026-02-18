import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { processAutoStatusChange } from "@/lib/status-rules";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const threshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const stale = await prisma.customer.findMany({
    where: { isNeedAction: false, lastActiveAt: { lt: threshold }, status: { name: { in: ["初期対応済", "追客中"] } } },
    select: { id: true },
  });
  for (const c of stale) await processAutoStatusChange(c.id, "NO_RESPONSE_48H");
  return NextResponse.json({ checked: stale.length });
}
