import { NextRequest, NextResponse } from "next/server";
import { handleLineWebhook } from "@/lib/line-webhook";

// 共通(ヘヤクレス既定)の LINE 公式アカウント用。会社ごとのアカウントは
// /api/webhook/line/[channelId] を使う（implementation-spec-v1.md §6）。
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-line-signature") || "";
    const r = await handleLineWebhook(rawBody, signature);
    return NextResponse.json(r.body, { status: r.status });
  } catch (e) {
    console.error("LINE webhook error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
