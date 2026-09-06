import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifySharedSecret } from '@/lib/shared-secret';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  try {
    const { customerId } = await params;
    // implementation-spec-v1.md §3: 秘密鍵の検証は verifySharedSecret に統一（fail-closed）
    const denied = verifySharedSecret(req);
    if (denied) return denied;
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        status: true,
        assignee: { select: { id: true, name: true, email: true } },
        properties: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, direction: true, channel: true, subject: true, body: true, status: true, openedAt: true, createdAt: true } },
        preference: true,
        organization: { select: { id: true, name: true, storeName: true, storeAddress: true, storePhone: true, storeHours: true, storeAccess: true, lineUrl: true, email: true, phone: true } },
      },
    });
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const templates = await prisma.template.findMany({ where: { organizationId: customer.organizationId }, select: { id: true, name: true, subject: true, body: true, category: true } });
    const staff = await prisma.user.findMany({ where: { organizationId: customer.organizationId }, select: { id: true, name: true, email: true, role: true } });
    const statuses = await prisma.status.findMany({ where: { organizationId: customer.organizationId }, orderBy: { order: 'asc' }, select: { id: true, name: true } });
    // 個人情報（顧客の連絡先・会話）を外部エージェントへ渡すので閲覧として記録する
    await logAudit({ customerId, organizationId: customer.organizationId, action: 'customer.view', field: 'agent-context' });
    return NextResponse.json({
      customer: { id: customer.id, name: customer.name, nameKana: customer.nameKana, email: customer.email, phone: customer.phone, sourcePortal: customer.sourcePortal, inquiryContent: customer.inquiryContent, memo: customer.memo, isNeedAction: customer.isNeedAction, lineUserId: customer.lineUserId, lineDisplayName: customer.lineDisplayName, createdAt: customer.createdAt, status: customer.status, assignee: customer.assignee },
      properties: customer.properties, messages: customer.messages, preference: customer.preference, organization: customer.organization, templates, staff, statuses,
    });
  } catch (error: any) {
    console.error('[Agent Context] Error:', error?.message || error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}