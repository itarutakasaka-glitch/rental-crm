import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireCustomerAccess } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { validateUpload, validateBatch, formatSize } from "@/lib/attachment-rules";
import { putAttachment, deleteAttachment, isBlobConfigured } from "@/lib/blob";

// implementation-spec-v1.md §4 F-7: 送信前の添付アップロード。
// この時点では messageId は付かない（送信時に紐づける）。
// **レスポンスに blobUrl を含めない**。実体は /api/attachments/[id]/download からのみ取れる。

export const maxDuration = 60;

function serialize(a: { id: string; filename: string; contentType: string; size: number; createdAt: Date }) {
  return {
    id: a.id,
    filename: a.filename,
    contentType: a.contentType,
    size: a.size,
    sizeLabel: formatSize(a.size),
    createdAt: a.createdAt,
    downloadUrl: `/api/attachments/${a.id}/download`,
  };
}

/** 顧客に紐づく添付の一覧（送信前の未添付分を拾い直す用） */
export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get("customerId");
  if (!customerId) return NextResponse.json({ error: "customerId は必須です" }, { status: 400 });
  const r = await requireCustomerAccess(customerId);
  if ("error" in r) return r.error;

  const attachments = await prisma.attachment.findMany({
    where: { customerId, messageId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, filename: true, contentType: true, size: true, createdAt: true },
  });
  return NextResponse.json({ attachments: attachments.map(serialize), blobConfigured: isBlobConfigured() });
}

export async function POST(req: NextRequest) {
  if (!isBlobConfigured()) {
    return NextResponse.json(
      { error: "添付ファイルの保存先が未設定です（Vercel Blob の作成と BLOB_READ_WRITE_TOKEN の登録が必要）" },
      { status: 503 }
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "フォームを読み取れません" }, { status: 400 });

  const customerId = String(form.get("customerId") || "");
  if (!customerId) return NextResponse.json({ error: "customerId は必須です" }, { status: 400 });
  const r = await requireCustomerAccess(customerId);
  if ("error" in r) return r.error;

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });

  // 既に付いている未送信の添付とあわせて、件数・合計サイズを見る
  const existing = await prisma.attachment.findMany({
    where: { customerId, messageId: null },
    select: { size: true },
  });
  const batch = validateBatch([...existing.map((e) => e.size), ...files.map((f) => f.size)]);
  if (batch.kind === "ng") return NextResponse.json({ error: batch.reason }, { status: 400 });

  const saved = [];
  for (const file of files) {
    const check = validateUpload({ filename: file.name, contentType: file.type, size: file.size });
    if (check.kind === "ng") {
      return NextResponse.json({ error: `${file.name}: ${check.reason}` }, { status: 400 });
    }
    const body = Buffer.from(await file.arrayBuffer());
    const stored = await putAttachment({
      organizationId: r.customer.organizationId,
      filename: check.filename,
      contentType: file.type,
      body,
    });
    const row = await prisma.attachment.create({
      data: {
        organizationId: r.customer.organizationId,
        customerId,
        direction: "OUTBOUND",
        filename: check.filename,
        contentType: file.type.split(";")[0].trim(),
        size: file.size,
        blobUrl: stored.url,
        blobPathname: stored.pathname,
        uploadedByUserId: r.user.id,
      },
      select: { id: true, filename: true, contentType: true, size: true, createdAt: true },
    });
    saved.push(serialize(row));
  }

  await logAudit({
    customerId,
    userId: r.user.id,
    organizationId: r.customer.organizationId,
    action: "attachment.upload",
    newValue: saved.map((s) => `${s.filename}(${s.sizeLabel})`).join(", "),
  });

  return NextResponse.json({ attachments: saved }, { status: 201 });
}

/** 送信前に取り消す。送信済み（messageId あり）の添付は消せない（履歴を壊さない） */
export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id は必須です" }, { status: 400 });

  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att || !att.customerId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await requireCustomerAccess(att.customerId);
  if ("error" in r) return r.error;
  if (att.messageId) {
    return NextResponse.json({ error: "送信済みの添付は削除できません" }, { status: 400 });
  }

  await deleteAttachment(att.blobUrl);
  await prisma.attachment.delete({ where: { id } });
  await logAudit({
    customerId: att.customerId,
    userId: r.user.id,
    organizationId: att.organizationId,
    action: "attachment.delete",
    oldValue: att.filename,
  });
  return NextResponse.json({ ok: true });
}
