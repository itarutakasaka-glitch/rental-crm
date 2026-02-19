import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { InboxView } from "@/components/inbox/inbox-view";

export default async function InboxPage() {
  const user = await getCurrentUser();
  const customers = await prisma.customer.findMany({
    where: { organizationId: user.organizationId },
    include: {
      status: true,
      assignee: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const statuses = await prisma.status.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { order: "asc" },
  });
  return <InboxView customers={customers as any} statuses={statuses} currentUser={user} />;
}
