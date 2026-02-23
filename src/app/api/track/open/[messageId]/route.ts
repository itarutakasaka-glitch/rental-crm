import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(request: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  try {
    await prisma.message.update({
      where: { id: messageId },
      data: { openedAt: new Date(), openCount: { increment: 1 } },
    });
  } catch (e) { console.error("[track/open]", e); }
  return new NextResponse(PIXEL, {
    status: 200,
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
