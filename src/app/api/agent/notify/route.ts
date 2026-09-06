import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifySharedSecret } from '@/lib/shared-secret';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    // implementation-spec-v1.md §3: 秘密鍵の検証は verifySharedSecret に統一（fail-closed）
    const denied = verifySharedSecret(req);
    if (denied) return denied;
    const { customerId, type, message } = await req.json();
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { assignee: true, organization: true },
    });
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const results: string[] = [];

    // LINE notify to assignee (if lineUserId exists on staff - future)
    // For now, log the notification
    results.push('logged: ' + type + ' - ' + message);

    // Update customer if needed
    if (type === 'phone_confirm') {
      await prisma.customer.update({ where: { id: customerId }, data: { memo: (customer.memo || '') + '\n[AI] ' + message } });
      results.push('memo_updated');
    }
    if (type === 'handover') {
      await prisma.customer.update({ where: { id: customerId }, data: { isNeedAction: true } });
      results.push('need_action_set');
    }

    await logAudit({ customerId, organizationId: customer.organizationId, action: 'customer.notify', field: type, newValue: message });
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('[Agent Notify] Error:', error?.message || error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}