import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthUserForAction } from "@/lib/auth";

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
    const updated = await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        ...(body.autoReplyEnabled !== undefined && { autoReplyEnabled: body.autoReplyEnabled }),
        ...(body.autoReplySubject !== undefined && { autoReplySubject: body.autoReplySubject }),
        ...(body.autoReplyTemplate !== undefined && { autoReplyTemplate: body.autoReplyTemplate }),
      },
    });
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
