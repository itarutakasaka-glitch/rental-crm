import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifySharedSecret } from "@/lib/shared-secret";
import { logAudit } from "@/lib/audit";

// 2026-08-30: staff付与の暫定API(管理UIができるまでの最小手段。architecture-v2.md Phase A)。
// 指定emailのユーザーをisStaff=trueにし、全組織へのStaffOrgAccessを張る。
// 冪等。共有秘密鍵で保護。
// **全社の顧客個人情報にアクセスできるようになる最重要操作なので必ず監査ログに残す。**
export async function POST(req: NextRequest) {
  const denied = verifySharedSecret(req);
  if (denied) return denied;

  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: `user not found: ${email}` }, { status: 404 });

    await prisma.user.update({ where: { id: user.id }, data: { isStaff: true } });

    // M-13: テスト用組織へのアクセスは付与しない（本番の横断表示に混ざらないようにする）
    const orgs = await prisma.organization.findMany({ where: { isTest: false }, select: { id: true, name: true } });
    let granted = 0;
    for (const org of orgs) {
      await prisma.staffOrgAccess.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
        update: {},
        create: { userId: user.id, organizationId: org.id },
      });
      granted++;
    }

    await logAudit({ userId: user.id, organizationId: user.organizationId, action: "staff.grant", field: email, newValue: `isStaff=true grantedOrgs=${granted}` });
    return NextResponse.json({ success: true, email, isStaff: true, grantedOrgs: granted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
