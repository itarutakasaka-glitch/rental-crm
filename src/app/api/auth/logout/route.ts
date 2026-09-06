import { NextResponse } from "next/server";
import { destroyCurrentSession } from "@/lib/session";
import { getAuthUserForAction } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const user = await getAuthUserForAction();
  await destroyCurrentSession();
  if (user) await logAudit({ userId: user.id, organizationId: user.organizationId, action: "auth.logout" });
  return NextResponse.json({ ok: true });
}
