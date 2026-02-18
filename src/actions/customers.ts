"use server";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";

export async function updateCustomer(id: string, data: Record<string, any>) {
  await prisma.customer.update({ where: { id }, data });
  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
}

export async function updateCustomerStatus(customerId: string, statusId: string, userId?: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new Error("顧客が見つかりません");
  await prisma.$transaction([
    prisma.customer.update({ where: { id: customerId }, data: { statusId } }),
    prisma.statusHistory.create({ data: { customerId, fromId: customer.statusId, toId: statusId, changedBy: userId } }),
  ]);
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
}

export async function toggleNeedAction(customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return;
  await prisma.customer.update({ where: { id: customerId }, data: { isNeedAction: !customer.isNeedAction } });
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
}
