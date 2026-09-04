import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser, requireAdminUser } from "@/lib/auth";
import { logFieldChanges } from "@/lib/audit";

// architecture-v2.md §10 S-2: 実在しない "org_default" を直書きしていた(同型バグ4件目)。
// GETは常にnull、PUTはどこにも書かず、組織設定画面が無音で壊れていた。
// ログインユーザーの所属組織を使う。更新は管理者のみ。
const EDITABLE = [
  "name", "phone", "email", "address", "website",
  "storeName", "storeAddress", "storePhone", "storeHours", "storeAccess", "storeWebsite", "storeClosedDays", "storeParking",
  "logoUrl", "lineUrl", "licenseNumber",
] as const;

export async function GET() {
  const r = await requireUser();
  if ("error" in r) return r.error;
  const org = await prisma.organization.findUnique({ where: { id: r.user.organizationId } });
  return NextResponse.json(org);
}

export async function PUT(req: NextRequest) {
  const r = await requireAdminUser();
  if ("error" in r) return r.error;
  const data = await req.json();
  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (data[k] !== undefined) patch[k] = data[k];

  const before = await prisma.organization.findUnique({ where: { id: r.user.organizationId } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const org = await prisma.organization.update({ where: { id: r.user.organizationId }, data: patch });
  await logFieldChanges({ userId: r.user.id, action: "organization.update" }, before as any, patch);
  return NextResponse.json(org);
}
