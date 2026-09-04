import { NextRequest, NextResponse } from "next/server";
import { verifySharedSecret } from "@/lib/shared-secret";
import { processInboundEmail } from "@/actions/inbound";
import { resolveSingleOrgOrNull, resolveOrgByRecipient } from "@/lib/resolve-single-org";
import { notifySlackError } from "@/lib/notify-slack";

export async function POST(req: NextRequest) {
  try {
    // architecture-v2.md §10 A-5: fail-closed(env未設定でも拒否)。外部webhookのためクエリ秘密鍵は暫定許可。
    const denied = verifySharedSecret(req, { allowQuery: true });
    if (denied) return denied;

    const data = await req.json();
    // architecture-v2.md §4: 宛先(hankyo+<slug>@...)から組織を解決。無ければ1社の間だけ動く暫定フォールバック
    const org = (await resolveOrgByRecipient(data.to)) || (await resolveSingleOrgOrNull());
    if (!org) return NextResponse.json({ error: "組織を一意に特定できません(複数組織対応は未実装)" }, { status: 400 });
    const result = await processInboundEmail(org.id, { from: data.from, subject: data.subject || "", body: data.text || data.html || "" });
    return NextResponse.json(result);
  } catch (e: any) {
    await notifySlackError({ title: "webhook/inbound 処理失敗", detail: e.message, source: "api/webhook/inbound" });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
