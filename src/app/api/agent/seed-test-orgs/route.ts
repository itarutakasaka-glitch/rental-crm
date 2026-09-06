import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifySharedSecret } from "@/lib/shared-secret";

// implementation-spec-v1.md §8.1b: 権限総当たりテスト用の組織を本番に用意する（Q-6 決定: staging は作らない）。
// isTest=true なので横断inbox・集計・cron・staff付与から除外される。
// **実在の個人情報は入れない**（氏名は「テスト太郎」、メールは example.com）。
// 冪等: 既に存在すれば作り直さない。DELETE で作ったデータを消せる。
const ORGS = [
  { slug: "test-a", name: "__test-org-a" },
  { slug: "test-b", name: "__test-org-b" },
];

export async function POST(req: NextRequest) {
  const denied = verifySharedSecret(req);
  if (denied) return denied;

  const result: any[] = [];
  for (const def of ORGS) {
    let org = await prisma.organization.findFirst({ where: { slug: def.slug } });
    if (!org) {
      org = await prisma.organization.create({
        data: { name: def.name, slug: def.slug, isTest: true, autoReplyEnabled: false, autoReplyMode: "DRAFT_ONLY" },
      });
    } else if (!org.isTest) {
      // 既存の実組織と slug がぶつかっている場合は触らない（事故防止）
      result.push({ slug: def.slug, skipped: "slug conflicts with a non-test organization" });
      continue;
    }

    let status = await prisma.status.findFirst({ where: { organizationId: org.id } });
    if (!status) {
      status = await prisma.status.create({
        data: { organizationId: org.id, name: "新規", color: "#3B82F6", order: 0, isDefault: true, systemCategory: "NEW" },
      });
    }

    let customer = await prisma.customer.findFirst({ where: { organizationId: org.id } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          organizationId: org.id, statusId: status.id,
          name: "テスト太郎", email: `${def.slug}@example.com`, isNeedAction: true, sourcePortal: "TEST",
        },
      });
    }
    result.push({ slug: def.slug, organizationId: org.id, statusId: status.id, customerId: customer.id });
  }
  return NextResponse.json({ success: true, orgs: result });
}

// テスト組織のデータを消す（組織自体は残す。§8.1b の後片付け）
export async function DELETE(req: NextRequest) {
  const denied = verifySharedSecret(req);
  if (denied) return denied;

  const orgs = await prisma.organization.findMany({ where: { isTest: true }, select: { id: true, slug: true } });
  let deleted = 0;
  for (const org of orgs) {
    const res = await prisma.customer.deleteMany({ where: { organizationId: org.id } });
    deleted += res.count;
  }
  return NextResponse.json({ success: true, organizations: orgs.map((o) => o.slug), deletedCustomers: deleted });
}
