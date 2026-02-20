import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

function parseSuumo(body: string) {
  const lines = body.split(/\r?\n/);
  const get = (key: string) => {
    const line = lines.find(l => l.includes(key));
    if (!line) return "";
    const idx = line.indexOf(key);
    const after = line.slice(idx + key.length);
    return after.replace(/^[：:\s]+/, "").trim();
  };
  return {
    name: get("\u540D\u524D(\u6F22\u5B57)"),
    email: get("\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9"),
    phone: get("TEL"),
    propertyName: get("\u7269\u4EF6\u540D"),
    propertyUrl: (body.match(/https:\/\/suumo\.jp\/[^\s]+/) || [""])[0],
    inquiry: get("\u304A\u554F\u5408\u305B\u5185\u5BB9") + " " + get("\u304A\u554F\u5408\u305B\u5185\u5BB9\u30B3\u30E1\u30F3\u30C8"),
    rent: get("\u8CC3\u6599"),
    address: get("\u6240\u5728\u5730"),
    layout: get("\u9593\u53D6\u308A"),
  };
}

function parseApamanshop(body: string) {
  const lines = body.split(/\r?\n/);
  const get = (key: string) => {
    const line = lines.find(l => l.includes(key));
    if (!line) return "";
    const m = line.match(/[】\]]\s*(.*)/);
    return m ? m[1].trim() : line.split(/[：:]/)[1]?.trim() || "";
  };
  const getName = () => {
    const idx = lines.findIndex(l => l.includes("\u3010\u540D\u524D\u3011"));
    if (idx >= 0) { const after = lines[idx].replace(/.*\u3010\u540D\u524D\u3011\s*/, ""); return after.trim() || (lines[idx+1]?.trim() || ""); }
    return "";
  };
  const getEmail = () => {
    const idx = lines.findIndex(l => l.includes("\u3010\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3011"));
    if (idx >= 0) { const after = lines[idx].replace(/.*\u3010\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3011\s*/, ""); return after.trim() || (lines[idx+1]?.trim() || ""); }
    return "";
  };
  const getPhone = () => {
    const idx = lines.findIndex(l => l.includes("\u3010\u96FB\u8A71\u756A\u53F7\u3011"));
    if (idx >= 0) { const after = lines[idx].replace(/.*\u3010\u96FB\u8A71\u756A\u53F7\u3011\s*/, ""); return after.trim() || (lines[idx+1]?.trim() || ""); }
    return "";
  };
  const propertyLine = lines.find(l => l.includes("\u3014\u7269\u4EF6\u540D\u3015") || l.includes("\u3014\u7269 \u4EF6 \u540D\u3015"));
  const propertyName = propertyLine ? propertyLine.replace(/.*\u3015\s*/, "").trim() : (lines.find(l => l.includes("\u3008\u7269\u4EF6\u540D\u3009"))?.replace(/.*\u3009\s*/, "").trim() || "");
  const inquiryLines: string[] = [];
  let inInquiry = false;
  for (const l of lines) {
    if (l.includes("\u3010\u304A\u554F\u3044\u5408\u308F\u305B\u5185\u5BB9\u3011")) { inInquiry = true; continue; }
    if (inInquiry) { if (l.includes("\u25A0") || l.includes("\u203B") || l.trim() === "") break; inquiryLines.push(l.trim()); }
  }
  return {
    name: getName(),
    email: getEmail(),
    phone: getPhone(),
    propertyName: propertyName || lines.find(l => l.match(/^\u3014\u7269/))?. replace(/.*\u3015\s*/, "").trim() || "",
    propertyUrl: (body.match(/https:\/\/www\.apamanshop\.com\/[^\s]+/) || [""])[0],
    inquiry: inquiryLines.join(" ").trim(),
    rent: (lines.find(l => l.includes("\u3014 \u8CC3 \u6599 \u3015") || l.includes("\u3014\u8CC3\u6599\u3015")) || "").replace(/.*\u3015\s*/, "").trim(),
  };
}

function parseHomes(body: string) {
  const lines = body.split(/\r?\n/);
  const get = (key: string) => {
    const line = lines.find(l => l.startsWith(key) || l.includes(key));
    if (!line) return "";
    return line.split(/[：:]/)[1]?.trim() || "";
  };
  const inquiryStart = lines.findIndex(l => l.includes("\u304A\u554F\u5408\u305B\u5185\u5BB9"));
  let inquiry = get("\u304A\u554F\u5408\u305B\u5185\u5BB9");
  if (inquiryStart >= 0 && lines[inquiryStart + 1]) inquiry += " " + lines[inquiryStart + 1].trim();
  return {
    name: get("\u540D\u524D"),
    email: get("\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9"),
    phone: "",
    propertyName: get("\u7269\u4EF6\u540D"),
    propertyUrl: (body.match(/https:\/\/www\.homes\.co\.jp\/[^\s]+/) || [""])[0],
    inquiry: inquiry.trim(),
    rent: get("\u8CC3\u6599"),
    address: get("\u6240\u5728\u5730"),
  };
}

function detectPortal(from: string, subject: string, body: string): string | null {
  if (from.includes("suumo") || subject.includes("SUUMO") || body.includes("suumo.jp") || body.includes("\u304A\u554F\u5408\u305B\u4F01\u753B:SUUMO")) return "SUUMO";
  if (from.includes("apamanshop") || subject.includes("\u30A2\u30D1\u30DE\u30F3") || body.includes("\u30A2\u30D1\u30DE\u30F3\u30B7\u30E7\u30C3\u30D7\u30DB\u30FC\u30E0\u30DA\u30FC\u30B8")) return "APAMANSHOP";
  if (from.includes("homes") || subject.includes("HOME'S") || body.includes("homes.co.jp") || body.includes("LIFULLHOME")) return "HOME'S";
  if (from.includes("athome") || subject.includes("\u30A2\u30C3\u30C8\u30DB\u30FC\u30E0")) return "\u30A2\u30C3\u30C8\u30DB\u30FC\u30E0";
  if (from.includes("chintai") || subject.includes("CHINTAI")) return "CHINTAI";
  return null;
}

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

    const portal = detectPortal(fromEmail, subject, body);
    let parsed = null;
    if (portal === "SUUMO") parsed = parseSuumo(body);
    else if (portal === "APAMANSHOP") parsed = parseApamanshop(body);
    else if (portal === "HOME'S") parsed = parseHomes(body);

    if (parsed && parsed.email) {
      let customer = await prisma.customer.findFirst({
        where: { email: { equals: parsed.email, mode: "insensitive" }, organizationId: "org_default" },
      });
      if (!customer) {
        const defaultStatus = await prisma.status.findFirst({ where: { organizationId: "org_default", isDefault: true } })
          || await prisma.status.findFirst({ where: { organizationId: "org_default" }, orderBy: { order: "asc" } });
        customer = await prisma.customer.create({
          data: {
            organizationId: "org_default", name: parsed.name || parsed.email, email: parsed.email,
            phone: parsed.phone || null, sourcePortal: portal, inquiryContent: parsed.inquiry || null,
            statusId: defaultStatus!.id, isNeedAction: true,
          },
        });
      } else {
        await prisma.customer.update({ where: { id: customer.id }, data: { isNeedAction: true } });
      }
      if (parsed.propertyName) {
        await prisma.inquiryProperty.create({
          data: { customerId: customer.id, name: parsed.propertyName, url: parsed.propertyUrl || null },
        });
      }
      await prisma.message.create({
        data: { customerId: customer.id, direction: "INBOUND", channel: "EMAIL", subject: `[${portal}] ${subject}`, body: body || subject, status: "DELIVERED" },
      });
      return NextResponse.json({ ok: true, action: "portal_inquiry", portal, customerId: customer.id });
    }

    // Regular email
    let customer = await prisma.customer.findFirst({
      where: { email: { equals: fromEmail, mode: "insensitive" }, organizationId: "org_default" },
    });
    if (!customer) {
      const defaultStatus = await prisma.status.findFirst({ where: { organizationId: "org_default", isDefault: true } })
        || await prisma.status.findFirst({ where: { organizationId: "org_default" }, orderBy: { order: "asc" } });
      customer = await prisma.customer.create({
        data: { organizationId: "org_default", name: fromName || fromEmail, email: fromEmail, statusId: defaultStatus!.id, isNeedAction: true },
      });
    } else {
      await prisma.customer.update({ where: { id: customer.id }, data: { isNeedAction: true } });
    }
    await prisma.message.create({
      data: { customerId: customer.id, direction: "INBOUND", channel: "EMAIL", subject, body: body || `[${subject}]`, status: "DELIVERED" },
    });
    const activeRun = await prisma.workflowRun.findFirst({ where: { customerId: customer.id, status: "RUNNING" } });
    if (activeRun) {
      await prisma.workflowRun.update({ where: { id: activeRun.id }, data: { status: "STOPPED_BY_REPLY", stoppedAt: new Date(), stopReason: "Customer replied by email" } });
    }
    return NextResponse.json({ ok: true, action: "regular_email", customerId: customer.id });
  } catch (e: any) {
    console.error("Email webhook error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
