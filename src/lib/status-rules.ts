import { prisma } from "@/lib/db/prisma";

type Trigger = "INQUIRY_RECEIVED" | "FIRST_REPLY_SENT" | "NO_RESPONSE_48H" | "CUSTOMER_REPLIED" | "VISIT_RESERVED" | "VISIT_COMPLETED" | "LINE_ADDED";

const RULES: Record<Trigger, string[]> = {
  INQUIRY_RECEIVED: ["新規対応"],
  FIRST_REPLY_SENT: ["初期対応済"],
  NO_RESPONSE_48H: ["返信無し"],
  CUSTOMER_REPLIED: ["追客中"],
  VISIT_RESERVED: ["来店予約"],
  VISIT_COMPLETED: ["来店済"],
  LINE_ADDED: [],
};

export async function processAutoStatusChange(customerId: string, trigger: Trigger) {
  const targetNames = RULES[trigger];
  if (!targetNames || targetNames.length === 0) return;
  
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { status: true },
  });
  if (!customer) return;

  const targetStatus = await prisma.status.findFirst({
    where: { organizationId: customer.organizationId, name: { in: targetNames } },
    orderBy: { order: "asc" },
  });
  if (!targetStatus || targetStatus.id === customer.statusId) return;

  await prisma.$transaction([
    prisma.customer.update({ where: { id: customerId }, data: { statusId: targetStatus.id } }),
    prisma.statusHistory.create({
      data: { customerId, fromId: customer.statusId, toId: targetStatus.id, reason: `自動: ${trigger}` },
    }),
  ]);
}
