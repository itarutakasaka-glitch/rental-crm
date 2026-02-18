"use server";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";

export async function createTemplate(data: {
  organizationId: string; categoryId: string; name: string; channel: "EMAIL"|"LINE"|"SMS"; subject?: string; body: string;
}) {
  await prisma.template.create({ data });
  revalidatePath("/settings/templates");
}

export async function updateTemplate(id: string, data: { name?: string; channel?: any; subject?: string; body?: string }) {
  await prisma.template.update({ where: { id }, data });
  revalidatePath("/settings/templates");
}

export async function deleteTemplate(id: string) {
  await prisma.template.delete({ where: { id } });
  revalidatePath("/settings/templates");
}

export async function createCategory(data: { organizationId: string; name: string }) {
  const maxOrder = await prisma.templateCategory.aggregate({ where: { organizationId: data.organizationId }, _max: { order: true } });
  await prisma.templateCategory.create({ data: { ...data, order: (maxOrder._max.order || 0) + 1 } });
  revalidatePath("/settings/templates");
}

export async function duplicateTemplate(id: string) {
  const t = await prisma.template.findUnique({ where: { id } });
  if (!t) return;
  await prisma.template.create({ data: { organizationId: t.organizationId, categoryId: t.categoryId, name: t.name + "（コピー）", channel: t.channel, subject: t.subject, body: t.body } });
  revalidatePath("/settings/templates");
}
