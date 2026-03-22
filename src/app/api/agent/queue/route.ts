import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-agent-secret');
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const type = req.nextUrl.searchParams.get('type') || 'AGENT_PENDING';
  
  const pending = await prisma.customer.findMany({
    where: { memo: { contains: `[${type}]` } },
    select: { id: true, name: true, email: true, memo: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'asc' },
    take: 10,
  });
  
  // For CLASSIFY_PENDING, also fetch the latest inbound message
  if (type === 'CLASSIFY_PENDING') {
    const results = [];
    for (const c of pending) {
      const lastMsg = await prisma.message.findFirst({
        where: { customerId: c.id, direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' },
        select: { body: true, createdAt: true },
      });
      results.push({ ...c, lastReply: lastMsg?.body || '' });
    }
    return NextResponse.json({ pending: results });
  }
  
  return NextResponse.json({ pending });
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-agent-secret');
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { customerId, action, from, to } = await req.json();
  
  if (action === 'done' || action === 'transition') {
    const c = await prisma.customer.findUnique({ where: { id: customerId } });
    if (c) {
      let newMemo = c.memo || '';
      // Remove source tag
      const fromTag = from || 'AGENT_PENDING';
      newMemo = newMemo.replace(`[${fromTag}]`, '').trim();
      // Add destination tag if transitioning
      if (to) {
        newMemo = newMemo + ` [${to}]`;
      } else if (action === 'done') {
        newMemo = newMemo + ' [AGENT_DONE]';
      }
      await prisma.customer.update({
        where: { id: customerId },
        data: { memo: newMemo.trim() },
      });
    }
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
