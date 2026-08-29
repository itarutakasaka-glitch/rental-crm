import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthUserForAction, canAccessOrg } from "@/lib/auth";

// StoreRoutingPanelで出た推奨をワンクリックで反映する(storeId設定＋タグ付与)。
// 元のinquiry-agent拡張は「ガイド方式」(推奨を出すだけ・書き込みは人間が手動)だったが、
// CRM組み込み版では「人間がボタンを押す」操作自体をこのAPIが担う(自動書き込みではない)。
export async function POST(req: NextRequest) {
  const user = await getAuthUserForAction();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { customerId, storeName } = await req.json();
    if (!customerId || !storeName) return NextResponse.json({ error: "customerId, storeName required" }, { status: 400 });

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if (!canAccessOrg(user, customer.organizationId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const store = await prisma.store.findFirst({ where: { organizationId: customer.organizationId, name: storeName } });
    if (!store) return NextResponse.json({ error: `店舗「${storeName}」が見つかりません(Storeマスタ未登録)` }, { status: 404 });

    await prisma.customer.update({ where: { id: customerId }, data: { storeId: store.id } });
    await prisma.customerTag.upsert({
      where: { customerId_name: { customerId, name: storeName } },
      update: {},
      create: { customerId, name: storeName },
    });

    return NextResponse.json({ success: true, storeId: store.id, storeName });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
