import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { organizationId: true },
    });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const customers = await prisma.customer.findMany({
      where: { organizationId: dbUser.organizationId },
      include: {
        status: { select: { id: true, name: true, color: true, order: true } },
        assignee: { select: { id: true, name: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { body: true, subject: true, direction: true, createdAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const result = customers.map((c) => ({
      ...c,
      lastMessage: c.messages[0] || null,
      messages: undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/customers] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}