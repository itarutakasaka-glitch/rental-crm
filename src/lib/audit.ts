import { prisma } from "@/lib/db/prisma";

export async function logAudit(data: {
  customerId?: string; userId?: string; action: string;
  field?: string; oldValue?: string; newValue?: string;
}) {
  return prisma.auditLog.create({ data });
}
