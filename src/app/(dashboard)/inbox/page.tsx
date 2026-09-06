import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { InboxView } from "@/components/inbox/inbox-view";

const PAGE_SIZE = 200;

type Search = { org?: string; store?: string; status?: string; tag?: string; q?: string; need?: string; page?: string };

export default async function InboxPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const q = (sp.q || "").trim();
  const needOnly = sp.need === "1";

  // isStaff(社内オペレーター)は担当組織を横断表示できる。orgクエリで特定の1社に絞れる。
  const staffOrgIds = user.staffOrgs.map((o) => o.id);
  const crossOrg = user.isStaff && staffOrgIds.length > 0;
  const organizationId = crossOrg && sp.org && staffOrgIds.includes(sp.org) ? sp.org : undefined;
  // M-13: 権限テスト用の組織(isTest)は横断表示から除外する。
  // 自組織を見ている場合は除外しない(テスト組織のユーザー自身は自分の組織を見られる)。
  const base: any = crossOrg
    ? organizationId
      ? { organizationId }
      : { organizationId: { in: staffOrgIds }, organization: { isTest: false } }
    : { organizationId: user.organizationId };

  // 店舗プルダウン・ステータス一覧の対象組織（1社に絞られている時だけ出す）
  const scopedOrgId = organizationId || (crossOrg ? undefined : user.organizationId);

  // implementation-spec-v1.md §4「F-1 店舗フィルタ / F-4 タグ / F-17 横断検索」。
  // 絞り込みはすべてサーバー側で行う（ページングしているので、画面に載っている分だけを
  // クライアントで絞ると件数も結果も嘘になる）。
  const and: any[] = [];
  if (needOnly) and.push({ isNeedAction: true });
  if (sp.status) and.push({ statusId: sp.status });
  if (sp.store) and.push({ storeId: sp.store });
  if (sp.tag) and.push({ tags: { some: { name: sp.tag } } });
  if (q) {
    const digits = q.replace(/\D/g, "");
    const or: any[] = [
      { name: { contains: q, mode: "insensitive" } },
      { nameKana: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { properties: { some: { name: { contains: q, mode: "insensitive" } } } },
    ];
    // ハイフン有無どちらで入力されても電話番号で引けるようにする
    if (digits.length >= 3 && digits !== q) or.push({ phone: { contains: digits } });
    and.push({ OR: or });
  }
  const where = and.length ? { AND: [base, ...and] } : base;

  // architecture-v2.md §9(穴#15): take:200 + updatedAt降順のみだと、対応が古いまま放置された
  // 「未対応」顧客が更新日時の新しい「対応済み」顧客に押し出されて画面外に消える(取りこぼし)。
  // isNeedAction(全経路で運用済みの未対応フラグ)を最優先ソートキーにして、放置期間に関わらず
  // 未対応が必ず上位に来るようにする。42社規模でも取りこぼしが起きないよう件数はcount()で別取得しページング。
  const [customers, totalCount, needActionCount, statusGroups, statuses, stores, tagRows] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        status: true,
        assignee: true,
        tags: { select: { name: true }, orderBy: { name: "asc" } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        organization: { select: { name: true } },
        store: { select: { name: true } },
      },
      orderBy: [{ isNeedAction: "desc" }, { updatedAt: "desc" }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.customer.count({ where }),
    // サイドバーの件数は「絞り込み前の対象範囲」で数える（ページ内の件数ではない）
    prisma.customer.count({ where: { AND: [base, { isNeedAction: true }] } }),
    prisma.customer.groupBy({ by: ["statusId"], where: base, _count: { _all: true } }),
    scopedOrgId
      ? prisma.status.findMany({ where: { organizationId: scopedOrgId }, orderBy: { order: "asc" } })
      : Promise.resolve([]),
    scopedOrgId
      ? prisma.store.findMany({ where: { organizationId: scopedOrgId }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
    prisma.customerTag.findMany({
      where: { customer: base },
      select: { name: true },
      distinct: ["name"],
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const g of statusGroups) statusCounts[g.statusId] = g._count._all;

  return (
    <InboxView
      customers={customers as any}
      statuses={statuses}
      statusCounts={statusCounts}
      needActionCount={needActionCount}
      currentUser={user}
      crossOrg={crossOrg}
      staffOrgs={user.staffOrgs}
      stores={stores}
      tags={tagRows.map((t) => t.name)}
      selectedOrgId={organizationId}
      selectedStoreId={sp.store}
      selectedStatusId={sp.status}
      selectedTag={sp.tag}
      query={q}
      needOnly={needOnly}
      page={page}
      pageSize={PAGE_SIZE}
      totalCount={totalCount}
    />
  );
}
