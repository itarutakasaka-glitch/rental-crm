import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-agent-secret');
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const pending = await prisma.customer.findMany({
    where: { isNeedAction: true, memo: { contains: '[AGENT_PENDING]' } },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });
  return NextResponse.json({ pending });
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-agent-secret');
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { customerId, action } = await req.json();
  if (action === 'done') {
    const c = await prisma.customer.findUnique({ where: { id: customerId } });
    if (c) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { memo: (c.memo || '').replace('[AGENT_PENDING]', '[AGENT_DONE]') },
      });
    }
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}