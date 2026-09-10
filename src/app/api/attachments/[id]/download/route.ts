import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser, canAccessOrg } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { fetchAttachmentBody } from "@/lib/blob";

// implementation-spec-v1.md §4 F-6: 添付の配信。
//
// Blob の URL は画面にも API のレスポンスにも出さず、必ずここを通す。
// 顧客の本人確認書類などが「推測されにくいだけの公開URL」で社外に出るのを避けるため。
// ここでログイン＋所属会社を確認し、誰がいつ取得したかを監査ログに残す。

export const maxDuration = 60;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const { id } = await params;

  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // 他社の添付は、存在も知らせずに 404 にする
  if (!canAccessOrg(r.user, att.organizationId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await fetchAttachmentBody(att.blobUrl);
  if (!body) return NextResponse.json({ error: "ファイルを取得できませんでした" }, { status: 502 });

  // 個人情報を含みうるので、誰が取得したかを残す（architecture-v2.md §10 S-4）
  await logAudit({
    customerId: att.customerId,
    userId: r.user.id,
    organizationId: att.organizationId,
    action: "attachment.download",
    field: att.filename,
  });

  // ブラウザ内で実行させない（HTML/SVG を開かせない）ため、常にダウンロード扱いにする
  const filename = encodeURIComponent(att.filename);
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": att.contentType || "application/octet-stream",
      "Content-Length": String(body.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
