import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthUserForAction } from "@/lib/auth";
import { logFieldChanges } from "@/lib/audit";

export async function GET() {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await prisma.organization.findUnique({ where: { id: user.organizationId } });
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      autoReplyEnabled: org.autoReplyEnabled,
      autoReplySubject: org.autoReplySubject,
      autoReplyTemplate: org.autoReplyTemplate,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const patch = {
      ...(body.autoReplyEnabled !== undefined && { autoReplyEnabled: body.autoReplyEnabled }),
      ...(body.autoReplySubject !== undefined && { autoReplySubject: body.autoReplySubject }),
      ...(body.autoReplyTemplate !== undefined && { autoReplyTemplate: body.autoReplyTemplate }),
    };
    // implementation-spec-v1.md §3: 自動返信の ON/OFF は顧客に届く文面を変える設定なので必ず監査ログに残す
    const before = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { autoReplyEnabled: true, autoReplySubject: true, autoReplyTemplate: true },
    });
    const updated = await prisma.organization.update({ where: { id: user.organizationId }, data: patch });
    await logFieldChanges(
      { userId: user.id, organizationId: user.organizationId, action: "organization.autoReply.update" },
      (before || {}) as any,
      patch
    );
    return NextResponse.json({
      autoReplyEnabled: updated.autoReplyEnabled,
      autoReplySubject: updated.autoReplySubject,
      autoReplyTemplate: updated.autoReplyTemplate,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
