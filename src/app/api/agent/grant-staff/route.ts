import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// 2026-08-30: staff付与の暫定API(管理UIができるまでの最小手段。architecture-v2.md Phase A)。
// 指定emailのユーザーをisStaff=trueにし、全組織へのStaffOrgAccessを張る。
// 冪等。CRON_SECRET保護。
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-agent-secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: `user not found: ${email}` }, { status: 404 });

    await prisma.user.update({ where: { id: user.id }, data: { isStaff: true } });

    const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
    let granted = 0;
    for (const org of orgs) {
      await prisma.staffOrgAccess.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
        update: {},
        create: { userId: user.id, organizationId: org.id },
      });
      granted++;
    }

    return NextResponse.json({ success: true, email, isStaff: true, grantedOrgs: granted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
