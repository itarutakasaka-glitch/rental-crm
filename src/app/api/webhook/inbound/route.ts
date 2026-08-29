import { NextRequest, NextResponse } from "next/server";
import { processInboundEmail } from "@/actions/inbound";
import { resolveSingleOrgOrNull } from "@/lib/resolve-single-org";

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    // TODO: Store.slugベースの宛先ルーティング未実装のため、組織が1社の間だけ動く暫定実装
    const org = await resolveSingleOrgOrNull();
    if (!org) return NextResponse.json({ error: "組織を一意に特定できません(複数組織対応は未実装)" }, { status: 400 });
    const result = await processInboundEmail(org.id, { from: data.from, subject: data.subject || "", body: data.text || data.html || "" });
    return NextResponse.json(result);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
