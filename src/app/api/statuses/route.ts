import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { organizationId: true },
    });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const statuses = await prisma.status.findMany({
      where: { organizationId: dbUser.organizationId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true, order: true },
    });

    return NextResponse.json(statuses);
  } catch (error) {
    console.error("[GET /api/statuses] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}