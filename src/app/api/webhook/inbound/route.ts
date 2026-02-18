import { NextRequest, NextResponse } from "next/server";
import { processInboundEmail } from "@/actions/inbound";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const org = await prisma.organization.findFirst();
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });
    const result = await processInboundEmail(org.id, { from: data.from, subject: data.subject || "", body: data.text || data.html || "" });
    return NextResponse.json(result);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
