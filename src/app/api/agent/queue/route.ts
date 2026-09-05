import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifySharedSecret } from "@/lib/shared-secret";
import type { AgentState } from "@prisma/client";

// 外部エージェント(5 Phase agent)向けの処理キュー。
// implementation-spec-v1.md §2.2: 旧 memo マーカーではなく Customer.agentState を使う。
// 互換のため旧名(AGENT_PENDING 等)も受け付けて agentState に読み替える。
const LEGACY: Record<string, AgentState> = {
  AGENT_PENDING: "FIRST_MAIL_PENDING",
  AGENT_DRAFT_READY: "FIRST_MAIL_DRAFTED",
  AGENT_DONE: "WAITING_REPLY",
  CLASSIFY_PENDING: "CLASSIFY_PENDING",
  CONFIRM_PENDING: "CONFIRM_PENDING",
};
const VALID = new Set<string>(["NONE", "FIRST_MAIL_PENDING", "FIRST_MAIL_DRAFTED", "WAITING_REPLY", "CLASSIFY_PENDING", "CLASSIFIED_A", "CLASSIFIED_B", "CLASSIFIED_C", "CONFIRM_PENDING", "BOOKING_DRAFTED", "BOOKED", "MANUAL"]);

function toState(v: string | null | undefined): AgentState | null {
  if (!v) return null;
  if (LEGACY[v]) return LEGACY[v];
  return VALID.has(v) ? (v as AgentState) : null;
}

export async function GET(req: NextRequest) {
  const denied = verifySharedSecret(req);
  if (denied) return denied;
  const state = toState(req.nextUrl.searchParams.get("type") || "AGENT_PENDING");
  if (!state) return NextResponse.json({ error: "Unknown type" }, { status: 400 });

  const pending = await prisma.customer.findMany({
    where: { agentState: state },
    select: { id: true, name: true, email: true, memo: true, agentState: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
    take: 10,
  });

  if (state === "CLASSIFY_PENDING") {
    const results = [];
    for (const c of pending) {
      const lastMsg = await prisma.message.findFirst({
        where: { customerId: c.id, direction: "INBOUND" },
        orderBy: { createdAt: "desc" },
        select: { body: true, createdAt: true },
      });
      results.push({ ...c, lastReply: lastMsg?.body || "" });
    }
    return NextResponse.json({ pending: results });
  }
  return NextResponse.json({ pending });
}

export async function POST(req: NextRequest) {
  const denied = verifySharedSecret(req);
  if (denied) return denied;
  const { customerId, action, to } = await req.json();
  if (!customerId) return NextResponse.json({ error: "customerId required" }, { status: 400 });

  if (action === "done" || action === "transition") {
    const target = toState(to) || (action === "done" ? "WAITING_REPLY" : null);
    if (!target) return NextResponse.json({ error: "Unknown target state" }, { status: 400 });
    await prisma.customer.update({ where: { id: customerId }, data: { agentState: target } });
    return NextResponse.json({ success: true, agentState: target });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
