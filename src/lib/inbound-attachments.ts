import { prisma } from "@/lib/db/prisma";
import { putAttachment, isBlobConfigured } from "@/lib/blob";
import { validateUpload } from "@/lib/attachment-rules";

// implementation-spec-v1.md §4 F-6: 受信メールの添付を取り込む。
//
// Resend の受信メール詳細に添付が含まれる形は base64 の場合と URL の場合があるため、
// **どちらでも拾えるように**書いてある。判定できないものは黙って捨てず、ログに残して飛ばす。
// 取り込みの失敗で受信処理そのものを落とさない（本文だけでも顧客に届いているほうがよい）。

type RawAttachment = {
  filename?: string;
  name?: string;
  content_type?: string;
  contentType?: string;
  content?: string; // base64
  url?: string;
  size?: number;
};

async function toBuffer(raw: RawAttachment): Promise<Buffer | null> {
  if (typeof raw.content === "string" && raw.content.length > 0) {
    try {
      return Buffer.from(raw.content, "base64");
    } catch {
      return null;
    }
  }
  if (typeof raw.url === "string" && raw.url.startsWith("https://")) {
    try {
      const res = await fetch(raw.url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 受信メールの添付を保存し、メッセージに紐づける。
 * @returns 保存できた件数
 */
export async function saveInboundAttachments(params: {
  emailDetail: any;
  organizationId: string;
  customerId: string;
  messageId: string;
}): Promise<number> {
  const list: RawAttachment[] = Array.isArray(params.emailDetail?.attachments) ? params.emailDetail.attachments : [];
  if (list.length === 0) return 0;

  if (!isBlobConfigured()) {
    console.error("[inbound-attachments] Blob 未設定のため添付を保存できません:", list.length, "件");
    return 0;
  }

  let saved = 0;
  for (const raw of list) {
    try {
      const filename = raw.filename || raw.name || "attachment";
      const contentType = raw.content_type || raw.contentType || "application/octet-stream";
      const buf = await toBuffer(raw);
      if (!buf || buf.length === 0) {
        console.error("[inbound-attachments] 実体を取得できず飛ばしました:", filename);
        continue;
      }
      const check = validateUpload({ filename, contentType, size: buf.length });
      if (check.kind === "ng") {
        // 受信側は拒否しても相手に返せないので、記録だけ残して保存しない
        console.error("[inbound-attachments] 受け入れ対象外:", filename, check.reason);
        continue;
      }
      const stored = await putAttachment({
        organizationId: params.organizationId,
        filename: check.filename,
        contentType: contentType.split(";")[0].trim(),
        body: buf,
      });
      await prisma.attachment.create({
        data: {
          organizationId: params.organizationId,
          customerId: params.customerId,
          messageId: params.messageId,
          direction: "INBOUND",
          filename: check.filename,
          contentType: contentType.split(";")[0].trim(),
          size: buf.length,
          blobUrl: stored.url,
          blobPathname: stored.pathname,
        },
      });
      saved++;
    } catch (e: any) {
      console.error("[inbound-attachments] 保存に失敗:", e?.message || e);
    }
  }
  return saved;
}
