// NOTE: 意図的に"use server"を付けない。server actionにするとビルド後に
// 無認証POSTエンドポイントとして露出し、外部から偽の反響を注入できてしまう。
// webhook route(サーバー側)から普通のモジュールとしてimportして使う。
import { prisma } from "@/lib/db/prisma";
import { parsePortalInquiry } from "@/lib/parsers/portal-inquiry";
import { revalidatePath } from "next/cache";

export async function processInboundEmail(organizationId: string, data: { from: string; subject: string; body: string }) {
  // F-5: 受信口が2つあるが、読み取りは lib/parsers/portal-inquiry.ts の1本に統一する
  const p = parsePortalInquiry(data.subject, data.body);
  const parsed = {
    customerName: p?.name || "",
    customerEmail: p?.email || data.from,
    customerPhone: p?.phone || "",
    portal: p?.source || "その他",
    inquiryContent: p?.inquiryContent || data.body.slice(0, 500),
    propertyName: p?.propertyName || "",
    propertyAddress: p?.propertyAddress || null,
    station: p?.propertyStation || null,
    // 表示用は原文のまま（「3万円」）。数値が要る場合は rentYen を使う
    rent: p?.propertyRent || null,
    rentYen: p?.rentYen ?? null,
    area: p?.propertyArea || null,
    layout: p?.propertyLayout || null,
  };
  const existing = await prisma.customer.findFirst({
    where: { organizationId, OR: [{ email: parsed.customerEmail }, ...(parsed.customerPhone ? [{ phone: parsed.customerPhone }] : [])] },
  });
  if (existing) {
    await prisma.message.create({ data: { customerId: existing.id, direction: "INBOUND", channel: "EMAIL", subject: data.subject, body: data.body, status: "SENT" } });
    await prisma.customer.update({ where: { id: existing.id }, data: { lastActiveAt: new Date(), isNeedAction: true, hasCustomerReplied: true } });
    revalidatePath("/customers");
    return { action: "updated", customerId: existing.id };
  }
  const defaultStatus = await prisma.status.findFirst({ where: { organizationId, isDefault: true } });
  if (!defaultStatus) throw new Error("デフォルトステータスが見つかりません");
  const customer = await prisma.customer.create({
    data: {
      organizationId, name: parsed.customerName || "不明", email: parsed.customerEmail, phone: parsed.customerPhone,
      sourcePortal: parsed.portal, inquiryContent: parsed.inquiryContent, statusId: defaultStatus.id, isNeedAction: true,
    },
  });
  if (parsed.propertyName) {
    await prisma.inquiryProperty.create({ data: { customerId: customer.id, name: parsed.propertyName, address: parsed.propertyAddress, station: parsed.station, rent: parsed.rent ? String(parsed.rent) : null, area: parsed.area ? String(parsed.area) : null, layout: parsed.layout } });
  }
  await prisma.message.create({ data: { customerId: customer.id, direction: "INBOUND", channel: "EMAIL", subject: data.subject, body: data.body, status: "SENT" } });
  revalidatePath("/customers");
  return { action: "created", customerId: customer.id };
}
