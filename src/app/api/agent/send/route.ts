import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Resend } from 'resend';
import { verifySharedSecret } from '@/lib/shared-secret';
import { logAudit } from '@/lib/audit';
const resend = new Resend(process.env.RESEND_API_KEY);

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

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@send.heyacules.com';
    const orgName = customer.organization?.storeName || customer.organization?.name || '????????';
    const { data, error } = await resend.emails.send({
      from: orgName + ' <' + fromEmail + '>',
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
    console.error('[Agent Send] Error:', error?.message || error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}