import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  try {
    const event = await req.json();
    if (event.type !== "email.received") return NextResponse.json({ ok: true });

    const d = event.data;
    const fromRaw = d.from || "";
    const fromEmail = fromRaw.replace(/.*</, "").replace(/>.*/, "").trim().toLowerCase();
    const fromName = fromRaw.replace(/<.*>/, "").trim();
    const subject = d.subject || "(No subject)";
    const emailId = d.email_id;

    if (!fromEmail) return NextResponse.json({ error: "No from email" }, { status: 400 });

    // Fetch email body from Resend API
    let body = "";
    if (emailId && process.env.RESEND_API_KEY) {
      try {
        const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        });
        if (res.ok) {
          const emailData = await res.json();
          body = emailData.text || emailData.html?.replace(/<[^>]+>/g, "") || "";
        }
      } catch (e) { console.error("Failed to fetch email body:", e); }
    }

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: { email: { equals: fromEmail, mode: "insensitive" }, organizationId: "org_default" },
    });

    if (!customer) {
      const defaultStatus = await prisma.status.findFirst({ where: { organizationId: "org_default", isDefault: true } })
        || await prisma.status.findFirst({ where: { organizationId: "org_default" }, orderBy: { order: "asc" } });
      customer = await prisma.customer.create({
        data: { organizationId: "org_default", name: fromName || fromEmail, email: fromEmail, statusId: defaultStatus!.id, isNeedAction: true },
      });
    }

    await prisma.message.create({
      data: { customerId: customer.id, direction: "INBOUND", channel: "EMAIL", subject, body: body || `[${subject}]`, status: "RECEIVED" },
    });
    await prisma.customer.update({ where: { id: customer.id }, data: { isNeedAction: true } });

    // Stop active workflow if customer replied
    const activeRun = await prisma.workflowRun.findFirst({ where: { customerId: customer.id, status: "RUNNING" } });
    if (activeRun) {
      await prisma.workflowRun.update({ where: { id: activeRun.id }, data: { status: "STOPPED_BY_REPLY", stoppedAt: new Date(), stopReason: "Customer replied by email" } });
    }

    return NextResponse.json({ ok: true, customerId: customer.id });
  } catch (e: any) {
    console.error("Email webhook error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
