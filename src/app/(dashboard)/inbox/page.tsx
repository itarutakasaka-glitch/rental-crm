import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { InboxView } from "@/components/inbox/inbox-view";

const PAGE_SIZE = 200;

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ org?: string; page?: string }> }) {
  const user = await getCurrentUser();
  const { org: orgFilter, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);

  // isStaff(社内オペレーター)は担当組織を横断表示できる。orgクエリで特定の1社に絞れる。
  const staffOrgIds = user.staffOrgs.map((o) => o.id);
  const crossOrg = user.isStaff && staffOrgIds.length > 0;
  const organizationId =
    crossOrg && orgFilter && staffOrgIds.includes(orgFilter) ? orgFilter : undefined;
  // M-13: 権限テスト用の組織(isTest)は横断表示から除外する。
  // 自組織を見ている場合は除外しない(テスト組織のユーザー自身は自分の組織を見られる)。
  const where = crossOrg
    ? organizationId
      ? { organizationId }
      : { organizationId: { in: staffOrgIds }, organization: { isTest: false } }
    : { organizationId: user.organizationId };

  // architecture-v2.md §9(穴#15): take:200 + updatedAt降順のみだと、対応が古いまま放置された
  // 「未対応」顧客が更新日時の新しい「対応済み」顧客に押し出されて画面外に消える(取りこぼし)。
  // isNeedAction(全経路で運用済みの未対応フラグ)を最優先ソートキーにして、放置期間に関わらず
  // 未対応が必ず上位に来るようにする。42社規模でも取りこぼしが起きないよう件数はcount()で別取得しページング。
  const [customers, totalCount] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        status: true,
        assignee: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        ...(crossOrg ? { organization: { select: { name: true } }, store: { select: { name: true } } } : {}),
      },
      orderBy: [{ isNeedAction: "desc" }, { updatedAt: "desc" }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.customer.count({ where }),
  ]);
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
      page={page}
      pageSize={PAGE_SIZE}
      totalCount={totalCount}
    />
  );
}
