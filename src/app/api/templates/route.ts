import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// architecture-v2.md §10 S-2: 実在しない "org_default" 直書き(同型バグ6件目)。
// 定型文設定画面はGETが常に空、POSTは孤立レコードを作っていた。
// ログインユーザーの所属組織を使い、更新・削除は「その組織の定型文か」を必ず確認する。
export async function GET() {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const templates = await prisma.template.findMany({
    where: { organizationId: r.user.organizationId, isActive: true },
    include: { category: true },
    orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
  });
  const categories = await prisma.templateCategory.findMany({
    where: { organizationId: r.user.organizationId },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ templates, categories });
}

export async function POST(req: NextRequest) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const data = await req.json();
  if (data.categoryId) {
    const cat = await prisma.templateCategory.findFirst({ where: { id: data.categoryId, organizationId: r.user.organizationId }, select: { id: true } });
    if (!cat) return NextResponse.json({ error: "categoryId does not belong to this organization" }, { status: 400 });
  }
  const template = await prisma.template.create({
    data: {
      organizationId: r.user.organizationId,
      categoryId: data.categoryId,
      name: data.name,
      channel: data.channel || "EMAIL",
      subject: data.subject || null,
      body: data.body,
      order: data.order || 0,
    },
  });
  await logAudit({ userId: r.user.id, action: "template.create", field: template.id, newValue: data.name });
  return NextResponse.json(template);
}

export async function PUT(req: NextRequest) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const data = await req.json();
  const owned = await prisma.template.findFirst({ where: { id: data.id, organizationId: r.user.organizationId }, select: { id: true, body: true } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const template = await prisma.template.update({
    where: { id: data.id },
    data: { name: data.name, categoryId: data.categoryId, channel: data.channel, subject: data.subject, body: data.body },
  });
  await logAudit({ userId: r.user.id, action: "template.update", field: data.id, oldValue: owned.body, newValue: data.body });
  return NextResponse.json(template);
}

export async function DELETE(req: NextRequest) {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const { id } = await req.json();
  const res = await prisma.template.updateMany({ where: { id, organizationId: r.user.organizationId }, data: { isActive: false } });
  if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({ userId: r.user.id, action: "template.delete", field: id });
  return NextResponse.json({ ok: true });
}
