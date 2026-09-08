import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser, requireAdminUser } from "@/lib/auth";
import { encryptSecret, maskSecret, isEncryptionConfigured } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

// implementation-spec-v1.md §6.1: 会社ごとの外部連携の設定。
// **秘密情報は絶対に平文で返さない**（マスクした文字列だけを返す）。
const TYPES = ["EMAIL", "LINE", "SMS"] as const;
type ChannelType = (typeof TYPES)[number];

function serialize(row: any) {
  return {
    id: row.id,
    type: row.type,
    storeId: row.storeId,
    isActive: row.isActive,
    fromName: row.fromName,
    fromAddress: row.fromAddress,
    lineChannelId: row.lineChannelId,
    lineBasicId: row.lineBasicId,
    smsFromNumber: row.smsFromNumber,
    // 値そのものは返さない。設定済みかどうかとマスクだけ
    hasSecret: !!row.secretEnc,
    secretMasked: maskSecret(row.secretEnc),
    hasWebhookSecret: !!row.webhookSecretEnc,
    webhookSecretMasked: maskSecret(row.webhookSecretEnc),
    updatedAt: row.updatedAt,
  };
}

export async function GET() {
  const r = await requireUser();
  if ("error" in r) return r.error;

  const [channels, stores, org] = await Promise.all([
    prisma.organizationChannel.findMany({
      where: { organizationId: r.user.organizationId },
      orderBy: [{ storeId: "asc" }, { type: "asc" }],
    }),
    prisma.store.findMany({ where: { organizationId: r.user.organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.organization.findUnique({ where: { id: r.user.organizationId }, select: { slug: true } }),
  ]);

  return NextResponse.json({
    channels: channels.map(serialize),
    stores,
    // 未設定のときに使われるシステム既定（値は見せず、設定されているかどうかだけ）
    defaults: {
      email: process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com",
      lineConfigured: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      smsConfigured: !!process.env.TWILIO_ACCOUNT_SID,
    },
    replyToHint: org?.slug ? `hankyo+${org.slug}@（受信ドメイン）` : null,
    encryptionConfigured: isEncryptionConfigured(),
  });
}

export async function PUT(req: NextRequest) {
  const r = await requireAdminUser();
  if ("error" in r) return r.error;

  const body = await req.json().catch(() => ({}));
  const type: ChannelType = body?.type;
  if (!TYPES.includes(type)) return NextResponse.json({ error: "type が不正です" }, { status: 400 });

  const storeId: string | null = body?.storeId || null;
  if (storeId) {
    const store = await prisma.store.findFirst({ where: { id: storeId, organizationId: r.user.organizationId }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "店舗が見つかりません" }, { status: 400 });
  }

  // 秘密情報が渡されたときだけ暗号化して上書きする（空なら既存を保持）
  const secret: string | undefined = typeof body?.secret === "string" && body.secret.trim() ? body.secret.trim() : undefined;
  const webhookSecret: string | undefined =
    typeof body?.webhookSecret === "string" && body.webhookSecret.trim() ? body.webhookSecret.trim() : undefined;
  if ((secret || webhookSecret) && !isEncryptionConfigured()) {
    return NextResponse.json(
      { error: "CHANNEL_SECRET_KEY が未設定のため秘密情報を保存できません（Vercel の環境変数に追加してください）" },
      { status: 400 }
    );
  }

  const data: any = {
    isActive: body?.isActive !== undefined ? !!body.isActive : true,
    fromName: body?.fromName ?? null,
    fromAddress: body?.fromAddress ?? null,
    lineChannelId: body?.lineChannelId ?? null,
    lineBasicId: body?.lineBasicId ?? null,
    smsFromNumber: body?.smsFromNumber ?? null,
  };
  if (secret) data.secretEnc = encryptSecret(secret);
  if (webhookSecret) data.webhookSecretEnc = encryptSecret(webhookSecret);

  const existing = await prisma.organizationChannel.findFirst({
    where: { organizationId: r.user.organizationId, storeId, type },
  });

  const row = existing
    ? await prisma.organizationChannel.update({ where: { id: existing.id }, data })
    : await prisma.organizationChannel.create({
        data: { ...data, organizationId: r.user.organizationId, storeId, type },
      });

  // 秘密情報の値は監査ログにも残さない（設定したという事実だけ）
  await logAudit({
    userId: r.user.id,
    organizationId: r.user.organizationId,
    action: existing ? "channel.update" : "channel.create",
    field: `${type}${storeId ? `/${storeId}` : ""}`,
    newValue: `active=${data.isActive} from=${data.fromAddress || data.smsFromNumber || data.lineBasicId || ""} secret=${secret ? "更新" : "変更なし"}`,
  });

  return NextResponse.json({ channel: serialize(row) });
}

export async function DELETE(req: NextRequest) {
  const r = await requireAdminUser();
  if ("error" in r) return r.error;
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id は必須です" }, { status: 400 });

  const removed = await prisma.organizationChannel.deleteMany({ where: { id, organizationId: r.user.organizationId } });
  if (removed.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({ userId: r.user.id, organizationId: r.user.organizationId, action: "channel.delete", field: id });
  return NextResponse.json({ ok: true });
}
