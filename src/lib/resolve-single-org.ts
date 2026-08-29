import { prisma } from "@/lib/db/prisma";

// 反響メールwebhook等、宛先から組織を判別する仕組みがまだ無い箇所で使う暫定ヘルパー。
// 組織が1社しか無い間は自動的にそれを使う。2社以上になったら「最初の1社」を無条件に
// 使ってしまう(＝他社の反響を誤った組織のものとして処理する)事故を防ぐため、
// 明示的にnullを返して呼び出し側で失敗させる。
// 恒久対応はStore.slugベースの宛先ルーティング(store-hierarchy-design.md参照)。
export async function resolveSingleOrgOrNull() {
  const orgs = await prisma.organization.findMany({ take: 2 });
  if (orgs.length === 1) return orgs[0];
  return null;
}
