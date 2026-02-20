import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

function parseSuumo(text) {
  if (!/suumo|SUUMO|ＳＵＵＭＯ|お客様からの反響です/i.test(text)) return null;
  const name = (text.match(/名前（漢字）[：:]\s*(.+)/) || text.match(/名前\(漢字\)[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const nameKana = (text.match(/名前（カナ）[：:]\s*(.+)/) || text.match(/名前\(カナ\)[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const email = (text.match(/メールアドレス[：:]\s*(\S+)/) || [])[1]?.trim() || "";
  const phone = (text.match(/[ＴTｔ][ＥEｅ][ＬLｌ][：:]\s*(\S+)/) || text.match(/電話番号[：:]\s*(\S+)/) || [])[1]?.trim() || "";
  const propertyName = (text.match(/物件名[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const propertyUrl = (text.match(/物件詳細画面[：:]\s*(https?:\/\/\S+)/) || text.match(/(https?:\/\/suumo\.jp\S+)/) || [])[1]?.trim() || "";
  const inquiryContent = (text.match(/お問合せ内容[：:]\s*(.+)/) || text.match(/お問い合わせ内容[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const station = (text.match(/最寄り駅[：:]\s*(.+)/) || text.match(/最寄駅[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const address = (text.match(/所在地[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const rent = (text.match(/賃料[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const layout = (text.match(/間取り[：:]\s*(.+)/) || text.match(/間取[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const area = (text.match(/専有面積[：:]\s*(.+)/) || [])[1]?.trim() || "";
  if (!name && !email) return null;
  return { name, nameKana, email, phone, source: "SUUMO", inquiryContent, propertyName, propertyUrl, propertyStation: station, propertyAddress: address, propertyRent: rent, propertyLayout: layout, propertyArea: area };
}

function parseApamanshop(text) {
  if (!/アパマンショップ|apamanshop/i.test(text)) return null;
  const name = (text.match(/【名前】\s*(.+)/) || text.match(/〔お名前〕\s*(.+)/) || [])[1]?.trim() || "";
  const nameKana = (text.match(/【名前カナ】\s*(.+)/) || [])[1]?.trim() || "";
  const email = (text.match(/【メールアドレス】\s*(\S+)/) || text.match(/〔メールアドレス〕\s*(\S+)/) || [])[1]?.trim() || "";
  const phone = (text.match(/【電話番号】\s*(.+)/) || text.match(/〔電話番号〕\s*(.+)/) || [])[1]?.trim() || "";
  const inquiryContent = (text.match(/【お問い合わせ内容】\s*([\s\S]*?)(?:【)/) || [])[1]?.trim() || "";
  const propertyName = (text.match(/（物件 名）\s*(.+)/) || text.match(/〔物 件 名〕\s*(.+)/) || text.match(/【物件名】\s*(.+)/) || [])[1]?.trim() || "";
  const propertyAddress = (text.match(/（物件住所）\s*(.+)/) || [])[1]?.trim() || "";
  const propertyStation = (text.match(/（最寄り駅）\s*(.+)/) || text.match(/（最寄駅）\s*(.+)/) || [])[1]?.trim() || "";
  const propertyRoom = (text.match(/（号 室）\s*(.+)/) || [])[1]?.trim() || "";
  const propertyArea = (text.match(/（専有面積）\s*(.+)/) || [])[1]?.trim() || "";
  const propertyRent = (text.match(/（賃 料）\s*(.+)/) || [])[1]?.trim() || "";
  const propertyUrl = (text.match(/(https?:\/\/www\.apamanshop\.com\S+)/) || [])[1]?.trim() || "";
  if (!name && !email) return null;
  return { name, nameKana, email, phone, source: "アパマンショップ", inquiryContent, propertyName, propertyAddress, propertyStation, propertyRoom, propertyArea, propertyRent, propertyUrl };
}

function parseHomes(text) {
  if (!/LIFULL HOME'S|HOME'S|homes\.co\.jp/i.test(text)) return null;
  const name = (text.match(/[\s　]+名前[：:]\s*(.+)/) || text.match(/名前[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const email = (text.match(/メールアドレス[：:]\s*(\S+)/) || [])[1]?.trim() || "";
  const phone = (text.match(/[\s　]+電話番号[：:]\s*(\S+)/) || text.match(/電話番号[：:]\s*(\S+)/) || [])[1]?.trim() || "";
  const propertyName = (text.match(/[\s　]+物件名[：:]\s*(.+)/) || text.match(/物件名[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const propertyRent = (text.match(/[\s　]+賃料[：:]\s*(.+)/) || text.match(/賃料[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const propertyAddress = (text.match(/[\s　]+所在地[：:]\s*(.+)/) || text.match(/所在地[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const propertyStation = (text.match(/[\s　]+交通[：:]\s*(.+)/) || text.match(/交通[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const propertyArea = (text.match(/[\s　]+面積[：:]\s*(.+)/) || text.match(/面積[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const propertyLayout = (text.match(/[\s　]+間取[：:]\s*(.+)/) || text.match(/間取[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const inquiryContent = (text.match(/お問合せ内容[：:]\s*(.+)/) || text.match(/お問い合わせ内容[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const note = (text.match(/[\s　]+備考[：:]\s*(.+)/) || text.match(/備考[：:]\s*(.+)/) || [])[1]?.trim() || "";
  const propertyUrl = (text.match(/(https?:\/\/www\.homes\.co\.jp\/chintai\/\S+)/) || [])[1]?.trim() || "";
  if (!name && !email) return null;
  const fullInquiry = [inquiryContent, note].filter(Boolean).join("\n");
  return { name, email, phone, source: "HOME'S", inquiryContent: fullInquiry, propertyName, propertyRent, propertyUrl, propertyAddress, propertyStation, propertyArea, propertyLayout };
}

function parsePortalEmail(subject, body) {
  const fullText = subject + "\n" + body;
  for (const parser of [parseSuumo, parseApamanshop, parseHomes]) {
    const result = parser(fullText);
    if (result) return result;
  }
  return null;
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const { from, subject, text: bodyText, html: bodyHtml } = payload;
    const body = bodyText || bodyHtml || "";
    const fromAddress = typeof from === "string" ? from : from?.address || from?.[0]?.address || "";

    console.log("[Email Webhook] From:", fromAddress, "Subject:", subject);

    const org = await prisma.organization.findFirst();
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const defaultStatus = await prisma.status.findFirst({
      where: { organizationId: org.id, isDefault: true },
    }) || await prisma.status.findFirst({
      where: { organizationId: org.id },
      orderBy: { order: "asc" },
    });
    if (!defaultStatus) return NextResponse.json({ error: "No default status" }, { status: 400 });

    const parsed = parsePortalEmail(subject || "", body);

    if (parsed) {
      console.log("[Email Webhook] Portal:", parsed.source, "-", parsed.name);
      let customer = parsed.email ? await prisma.customer.findFirst({ where: { email: parsed.email, organizationId: org.id } }) : null;

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            name: parsed.name || "名前不明", nameKana: ("nameKana" in parsed ? parsed.nameKana : null) || null,
            email: parsed.email || null, phone: parsed.phone || null,
            statusId: defaultStatus.id, sourcePortal: parsed.source,
            inquiryContent: parsed.inquiryContent || null,
            isNeedAction: true, organizationId: org.id,
          },
        });
        if (parsed.propertyName) {
          await prisma.inquiryProperty.create({
            data: {
              customerId: customer.id, name: parsed.propertyName,
              address: ("propertyAddress" in parsed ? parsed.propertyAddress : null) || null, station: ("propertyStation" in parsed ? parsed.propertyStation : null) || null,
              roomNumber: ("propertyRoom" in parsed ? parsed.propertyRoom : null) || null, area: ("propertyArea" in parsed ? parsed.propertyArea : null) || null,
              rent: ("propertyRent" in parsed ? parsed.propertyRent : null) || null, portalUrl: ("propertyUrl" in parsed ? parsed.propertyUrl : null) || null,
            },
          });
        }
      } else {
        await prisma.customer.update({ where: { id: customer.id }, data: { isNeedAction: true, updatedAt: new Date() } });
      }

      await prisma.message.create({
        data: { customerId: customer.id, direction: "INBOUND", channel: "EMAIL", subject: subject || parsed.source + "からのお問い合わせ", body, status: "DELIVERED" },
      });
      return NextResponse.json({ success: true, type: "portal", source: parsed.source, customerId: customer.id });
    }

    const existingCustomer = await prisma.customer.findFirst({ where: { email: fromAddress, organizationId: org.id } });
    if (existingCustomer) {
      await prisma.message.create({
        data: { customerId: existingCustomer.id, direction: "INBOUND", channel: "EMAIL", subject: subject || null, body, status: "DELIVERED" },
      });
      await prisma.customer.update({ where: { id: existingCustomer.id }, data: { isNeedAction: true, updatedAt: new Date() } });
      await prisma.workflowRun.updateMany({ where: { customerId: existingCustomer.id, status: "RUNNING" }, data: { status: "STOPPED_BY_REPLY" } });
      return NextResponse.json({ success: true, type: "reply", customerId: existingCustomer.id });
    }

    return NextResponse.json({ success: true, type: "unknown" });
  } catch (error) {
    console.error("[Email Webhook] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}