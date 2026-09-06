import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireCustomerAccess } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// implementation-spec-v1.md §4.3 タグ（F-4）。
// カナリー同等機能の MUST。一覧の絞り込みと、店舗振り分け・A層判定の自動付与で使う。
const MAX_TAGS_PER_CUSTOMER = 20;
const MAX_TAG_LENGTH = 30;

function normalizeTag(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name || name.length > MAX_TAG_LENGTH) return null;
  return name;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await requireCustomerAccess(id);
  if ("error" in r) return r.error;
  const tags = await prisma.customerTag.findMany({ where: { customerId: id }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return NextResponse.json({ tags });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await requireCustomerAccess(id);
  if ("error" in r) return r.error;

  const name = normalizeTag((await req.json())?.name);
  if (!name) return NextResponse.json({ error: `タグ名は1〜${MAX_TAG_LENGTH}文字で入力してください` }, { status: 400 });

  const count = await prisma.customerTag.count({ where: { customerId: id } });
  if (count >= MAX_TAGS_PER_CUSTOMER) {
    return NextResponse.json({ error: `タグは1顧客あたり最大${MAX_TAGS_PER_CUSTOMER}個です` }, { status: 400 });
  }

  const tag = await prisma.customerTag.upsert({
    where: { customerId_name: { customerId: id, name } },
    update: {},
    create: { customerId: id, name },
  });
  await logAudit({ customerId: id, userId: r.user.id, organizationId: r.customer.organizationId, action: "customer.tag.add", newValue: name });
  return NextResponse.json({ tag }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await requireCustomerAccess(id);
  if ("error" in r) return r.error;

  const name = normalizeTag((await req.json())?.name);
  if (!name) return NextResponse.json({ error: "タグ名は必須です" }, { status: 400 });

  const removed = await prisma.customerTag.deleteMany({ where: { customerId: id, name } });
  if (removed.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({ customerId: id, userId: r.user.id, organizationId: r.customer.organizationId, action: "customer.tag.remove", oldValue: name });
  return NextResponse.json({ ok: true });
}
