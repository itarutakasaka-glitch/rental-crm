"use server";
import { prisma } from "@/lib/db/prisma";
import { parseInquiryEmail } from "@/lib/parsers/inquiry-email-parser";
import { revalidatePath } from "next/cache";

export async function processInboundEmail(organizationId: string, data: { from: string; subject: string; body: string }) {
  const parsed = parseInquiryEmail(data.subject, data.body, data.from);
  const existing = await prisma.customer.findFirst({
    where: { organizationId, OR: [{ email: parsed.customerEmail }, ...(parsed.customerPhone ? [{ phone: parsed.customerPhone }] : [])] },
  });
  if (existing) {
    await prisma.message.create({ data: { customerId: existing.id, direction: "INBOUND", channel: "EMAIL", subject: data.subject, body: data.body, status: "SENT" } });
    await prisma.customer.update({ where: { id: existing.id }, data: { lastActiveAt: new Date(), isNeedAction: true } });
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
    await prisma.inquiryProperty.create({ data: { customerId: customer.id, name: parsed.propertyName, address: parsed.propertyAddress, station: parsed.station, rent: parsed.rent, area: parsed.area, layout: parsed.layout } });
  }
  await prisma.message.create({ data: { customerId: customer.id, direction: "INBOUND", channel: "EMAIL", subject: data.subject, body: data.body, status: "SENT" } });
  revalidatePath("/customers");
  return { action: "created", customerId: customer.id };
}
