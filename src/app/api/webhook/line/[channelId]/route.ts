import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/crypto";
import { handleLineWebhook } from "@/lib/line-webhook";

// implementation-spec-v1.md §6: 会社ごとの LINE 公式アカウントの Webhook。
// URL の channelId は OrganizationChannel.id。認証情報も所属会社もこの行から決まるので、
// 「どの会社の顧客か」を推測せずに済む（共通アカウントの弱点をここで解消する）。
export async function POST(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const { channelId } = await params;
    const rawBody = await req.text();
    const signature = req.headers.get("x-line-signature") || "";

    const ch = await prisma.organizationChannel.findFirst({ where: { id: channelId, type: "LINE" } });
    // 存在しない ID には設定の有無を明かさず 404 を返す
    if (!ch) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!ch.isActive) return NextResponse.json({ error: "Channel disabled" }, { status: 403 });

    const accessToken = decryptSecret(ch.secretEnc);
    const channelSecret = decryptSecret(ch.webhookSecretEnc);
    if (!accessToken || !channelSecret) {
      console.error("[LINE webhook] credentials missing/undecryptable for channel", channelId);
      return NextResponse.json({ error: "Channel not configured" }, { status: 503 });
    }

    const r = await handleLineWebhook(rawBody, signature, {
      creds: { accessToken, channelSecret },
      organizationId: ch.organizationId,
    });
    return NextResponse.json(r.body, { status: r.status });
  } catch (e) {
    console.error("LINE webhook error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
