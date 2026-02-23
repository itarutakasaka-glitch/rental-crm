import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const org = await prisma.organization.findFirst();
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
    const org = await prisma.organization.findFirst();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await request.json();
    const updated = await prisma.organization.update({
      where: { id: org.id },
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
