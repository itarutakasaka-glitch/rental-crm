import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getResend } from "@/lib/resend";
import { verifySharedSecret } from '@/lib/shared-secret';
import { logAudit } from '@/lib/audit';
import { resolveEmailChannel, buildEmailFrom, ChannelBlockedError } from '@/lib/channel-resolver';

export async function POST(req: NextRequest) {
  try {
    // implementation-spec-v1.md §3: 秘密鍵の検証は verifySharedSecret に統一（fail-closed）
    const denied = verifySharedSecret(req);
    if (denied) return denied;
    const { customerId, subject, body, channel } = await req.json();
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { organization: true },
    });
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!customer.email) return NextResponse.json({ error: 'No email' }, { status: 400 });

    // implementation-spec-v1.md §6: 差出人は会社(店舗)ごとの設定を優先する
    const orgName = customer.organization?.storeName || customer.organization?.name || 'ヘヤクレス';
    const emailCh = await resolveEmailChannel(customer.organizationId, customer.storeId);
    const resend = getResend();
    if (!resend) return NextResponse.json({ error: 'メール送信が未設定です(RESEND_API_KEY)' }, { status: 500 });
    const { data, error } = await resend.emails.send({
      from: buildEmailFrom(emailCh, orgName),
      to: [customer.email],
      subject: subject,
      html: body,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await prisma.message.create({
      data: { customerId, direction: 'OUTBOUND', channel: channel || 'EMAIL', subject, body, status: 'SENT', externalId: data?.id || null },
    });
    await prisma.customer.update({ where: { id: customerId }, data: { isNeedAction: false } });
    await logAudit({ customerId, organizationId: customer.organizationId, action: 'message.send', field: channel || 'EMAIL', newValue: subject });

    return NextResponse.json({ success: true, messageId: data?.id });
  } catch (error: any) {
    // 会社の連携設定が無効/不完全なときは、既定の差出人で送らずここで止める
    if (error instanceof ChannelBlockedError) {
      return NextResponse.json({ error: `送信を中止しました: ${error.detail}` }, { status: 409 });
    }
    console.error('[Agent Send] Error:', error?.message || error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}