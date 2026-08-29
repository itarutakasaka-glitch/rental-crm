import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { InboxView } from "@/components/inbox/inbox-view";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const user = await getCurrentUser();
  const { org: orgFilter } = await searchParams;

  // isStaff(社内オペレーター)は担当組織を横断表示できる。orgクエリで特定の1社に絞れる。
  const staffOrgIds = user.staffOrgs.map((o) => o.id);
  const crossOrg = user.isStaff && staffOrgIds.length > 0;
  const organizationId =
    crossOrg && orgFilter && staffOrgIds.includes(orgFilter) ? orgFilter : undefined;
  const where = crossOrg
    ? organizationId
      ? { organizationId }
      : { organizationId: { in: staffOrgIds } }
    : { organizationId: user.organizationId };

  const customers = await prisma.customer.findMany({
    where,
    include: {
      status: true,
      assignee: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      ...(crossOrg ? { organization: { select: { name: true } }, store: { select: { name: true } } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const statuses = crossOrg
    ? [] // 横断表示時はステータス体系が会社ごとに違うため、ステータス別フィルタは非表示にする
    : await prisma.status.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { order: "asc" },
      });

  return (
    <InboxView
      customers={customers as any}
      statuses={statuses}
      currentUser={user}
      crossOrg={crossOrg}
      staffOrgs={user.staffOrgs}
      selectedOrgId={organizationId}
    />
  );
}
