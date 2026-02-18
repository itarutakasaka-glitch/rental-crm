"use server";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";

export async function createStatus(data: { organizationId: string; name: string; color: string; description?: string }) {
  const maxOrder = await prisma.status.aggregate({ where: { organizationId: data.organizationId }, _max: { order: true } });
  await prisma.status.create({ data: { ...data, order: (maxOrder._max.order || 0) + 1 } });
  revalidatePath("/settings/status");
}

export async function updateStatus(id: string, data: { name?: string; color?: string; description?: string }) {
  await prisma.status.update({ where: { id }, data });
  revalidatePath("/settings/status");
}

export async function deleteStatus(id: string, migrateToId: string) {
  await prisma.$transaction([
    prisma.customer.updateMany({ where: { statusId: id }, data: { statusId: migrateToId } }),
    prisma.status.delete({ where: { id } }),
  ]);
  revalidatePath("/settings/status");
  revalidatePath("/customers");
}

export async function reorderStatuses(ids: string[]) {
  await prisma.$transaction(ids.map((id, i) => prisma.status.update({ where: { id }, data: { order: i + 1 } })));
  revalidatePath("/settings/status");
}
