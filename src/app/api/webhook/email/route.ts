import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// SUUMO parser
function parseSuumo(text: string) {
  if (!/suumo|SUUMO|\u30B9\u30FC\u30E2|\u304A\u554F\u5408\u305B\u304C\u3042\u308A\u307E\u3057\u305F/i.test(text)) return null;
  // \u540D\u524D = 名前, \u6F22\u5B57 = 漢孁E \u30AB\u30CA = カチE  const name = (text.match(/\u540D\u524D[\(�E�E\u6F22\u5B57[\)�E�][�E�E]\s*(.+)/) || text.match(/\u540D\u524D\(\u6F22\u5B57\)[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  const nameKana = (text.match(/\u540D\u524D[\(�E�E\u30AB\u30CA[\)�E�][�E�E]\s*(.+)/) || text.match(/\u540D\u524D\(\u30AB\u30CA\)[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  // \u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9 = メールアドレス
  const email = (text.match(/\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9[�E�E]\s*(\S+)/) || [])[1]?.trim() || "";
  // TEL or \uFF34\uFF25\uFF2C = �E��E��E�, \u96FB\u8A71\u756A\u53F7 = 電話番号
  const phone = (text.match(/[\uFF34T][\uFF25E][\uFF2CL][�E�E]\s*(\S+)/) || text.match(/\u96FB\u8A71\u756A\u53F7[�E�E]\s*(\S+)/) || [])[1]?.trim() || "";
  // \u7269\u4EF6\u540D = 物件吁E  const propertyName = (text.match(/\u7269\u4EF6\u540D[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  // \u7269\u4EF6\u8A73\u7D30\u753B\u9762 = 物件詳細画面
  const propertyUrl = (text.match(/\u7269\u4EF6\u8A73\u7D30\u753B\u9762[�E�E]\s*(https?:\/\/\S+)/) || text.match(/(https?:\/\/suumo\.jp\S+)/) || [])[1]?.trim() || "";
  // \u304A\u554F\u5408\u305B\u5185\u5BB9 = お問合せ冁E��
  const inquiryContent = (text.match(/\u304A\u554F\u5408\u305B\u5185\u5BB9[�E�E]\s*(.+)/) || text.match(/\u304A\u554F\u3044\u5408\u308F\u305B\u5185\u5BB9[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  // \u6700\u5BC4\u308A\u99C5 = 最寁E��駁E \u6700\u5BC4\u99C5 = 最寁E��E  const station = (text.match(/\u6700\u5BC4\u308A\u99C5[�E�E]\s*(.+)/) || text.match(/\u6700\u5BC4\u99C5[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  // \u6240\u5728\u5730 = 所在地
  const address = (text.match(/\u6240\u5728\u5730[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  // \u8CC3\u6599 = 賁E��
  const rent = (text.match(/\u8CC3\u6599[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  // \u9593\u53D6\u308B = 間取めE \u9593\u53D6 = 間取
  const layout = (text.match(/\u9593\u53D6\u308A[�E�E]\s*(.+)/) || text.match(/\u9593\u53D6[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  // \u5C02\u6709\u9762\u7A4D = 専有面穁E  const area = (text.match(/\u5C02\u6709\u9762\u7A4D[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  if (!name && !email) return null;
  return { name, nameKana, email, phone, source: "SUUMO", inquiryContent, propertyName, propertyUrl, propertyStation: station, propertyAddress: address, propertyRent: rent, propertyLayout: layout, propertyArea: area };
}

// APAMANSHOP parser
function parseApamanshop(text: string) {
  // \u30A2\u30D1\u30DE\u30F3\u30B7\u30E7\u30C3\u30D7 = アパ�EンショチE�E
  if (!/\u30A2\u30D1\u30DE\u30F3\u30B7\u30E7\u30C3\u30D7|apamanshop/i.test(text)) return null;
  // \u3010\u540D\u524D\u3011 = 【名前、E \u3010\u304A\u540D\u524D\u3011 = 【お名前、E  const name = (text.match(/\u3010\u540D\u524D\u3011\s*(.+)/) || text.match(/\u3010\u304A\u540D\u524D\u3011\s*(.+)/) || [])[1]?.trim() || "";
  const nameKana = (text.match(/\u3010\u540D\u524D\u30AB\u30CA\u3011\s*(.+)/) || [])[1]?.trim() || "";
  // \u3010\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3011 = 【メールアドレス、E  const email = (text.match(/\u3010\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3011\s*(\S+)/) || [])[1]?.trim() || "";
  // \u3010\u96FB\u8A71\u756A\u53F7\u3011 = 【電話番号、E  const phone = (text.match(/\u3010\u96FB\u8A71\u756A\u53F7\u3011\s*(.+)/) || [])[1]?.trim() || "";
  // \u3010\u304A\u554F\u3044\u5408\u308F\u305B\u5185\u5BB9\u3011 = 【お問い合わせ�E容、E  const inquiryContent = (text.match(/\u3010\u304A\u554F\u3044\u5408\u308F\u305B\u5185\u5BB9\u3011\s*([\s\S]*?)(?:\u3010|$)/) || [])[1]?.trim() || "";
  // \u3014\u7269 \u4EF6 \u540D\u3015 = 〔物 件 名、E \u3010\u7269\u4EF6\u540D\u3011 = 【物件名、E  const propertyName = (text.match(/\u3014\u7269\s*\u4EF6\s*\u540D\u3015\s*(.+)/) || text.match(/\u3010\u7269\u4EF6\u540D\u3011\s*(.+)/) || [])[1]?.trim() || "";
  const propertyUrl = (text.match(/(https?:\/\/www\.apamanshop\.com\S+)/) || [])[1]?.trim() || "";
  if (!name && !email) return null;
  return { name, nameKana, email, phone, source: "\u30A2\u30D1\u30DE\u30F3\u30B7\u30E7\u30C3\u30D7", inquiryContent, propertyName, propertyUrl };
}

// HOME'S parser
function parseHomes(text: string) {
  if (!/LIFULL HOME'S|HOME'S|homes\.co\.jp/i.test(text)) return null;
  const name = (text.match(/\u540D\u524D[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  const email = (text.match(/\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9[�E�E]\s*(\S+)/) || [])[1]?.trim() || "";
  const phone = (text.match(/\u96FB\u8A71\u756A\u53F7[�E�E]\s*(\S+)/) || [])[1]?.trim() || "";
  const propertyName = (text.match(/\u7269\u4EF6\u540D[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  const propertyRent = (text.match(/\u8CC3\u6599[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  const propertyAddress = (text.match(/\u6240\u5728\u5730[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  const propertyStation = (text.match(/\u4EA4\u901A[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  const propertyArea = (text.match(/\u9762\u7A4D[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  const propertyLayout = (text.match(/\u9593\u53D6[�E�E]\s*(.+)/) || text.match(/\u9593\u53D6\u308A[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  const inquiryContent = (text.match(/\u304A\u554F\u5408\u305B\u5185\u5BB9[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  const note = (text.match(/\u5099\u8003[�E�E]\s*(.+)/) || [])[1]?.trim() || "";
  const propertyUrl = (text.match(/(https?:\/\/www\.homes\.co\.jp\S+)/) || [])[1]?.trim() || "";
  if (!name && !email) return null;
  const fullInquiry = [inquiryContent, note].filter(Boolean).join("\n");
  return { name, email, phone, source: "HOME'S", inquiryContent: fullInquiry, propertyName, propertyRent, propertyUrl, propertyAddress, propertyStation, propertyArea, propertyLayout };
}

function parsePortalEmail(subject: string, body: string) {
  const fullText = subject + "\n" + body;
  for (const parser of [parseSuumo, parseApamanshop, parseHomes]) {
    const result = parser(fullText);
    if (result) return result;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Support both Resend webhook format (nested in data) and direct format
    const emailData = payload.data || payload;
    const fromRaw = emailData.from;
    const subject = emailData.subject || "";
    const bodyText = emailData.text || "";
    const bodyHtml = emailData.html || "";
    const body = bodyText || bodyHtml || "";
    const fromAddress = typeof fromRaw === "string" ? fromRaw : fromRaw?.address || (Array.isArray(fromRaw) ? fromRaw[0]?.address : "") || "";

    console.log("[Email Webhook] Keys:", Object.keys(emailData), "text?", typeof emailData.text, "html?", typeof emailData.html, "body?", typeof emailData.body); console.log("[Email Webhook] Keys:", Object.keys(emailData), "text?", typeof emailData.text, "html?", typeof emailData.html, "body?", typeof emailData.body); console.log("[Email Webhook] Keys:", Object.keys(emailData), "text?", typeof emailData.text, "html?", typeof emailData.html, "body?", typeof emailData.body); console.log("[Email Webhook] Keys:", Object.keys(emailData), "text?", typeof emailData.text, "html?", typeof emailData.html, "body?", typeof emailData.body); console.log("[Email Webhook] From:", fromAddress, "Subject:", subject);

    const org = await prisma.organization.findFirst();
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const defaultStatus = await prisma.status.findFirst({
      where: { organizationId: org.id, isDefault: true },
    }) || await prisma.status.findFirst({
      where: { organizationId: org.id },
      orderBy: { order: "asc" },
    });
    if (!defaultStatus) return NextResponse.json({ error: "No default status" }, { status: 400 });

    const parsed = parsePortalEmail(subject, body);

    if (parsed) {
      console.log("[Email Webhook] Portal:", parsed.source, "-", parsed.name);
      let customer = parsed.email ? await prisma.customer.findFirst({ where: { email: parsed.email, organizationId: org.id } }) : null;

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            name: parsed.name || "\u540D\u524D\u4E0D\u660E",
            nameKana: ("nameKana" in parsed ? (parsed as any).nameKana : null) || null,
            email: parsed.email || null,
            phone: parsed.phone || null,
            statusId: defaultStatus.id,
            sourcePortal: parsed.source,
            inquiryContent: parsed.inquiryContent || null,
            isNeedAction: true,
            organizationId: org.id,
          },
        });
        if (parsed.propertyName) {
          await prisma.inquiryProperty.create({
            data: {
              customerId: customer.id,
              name: parsed.propertyName,
              address: ("propertyAddress" in parsed ? (parsed as any).propertyAddress : null) || null,
              station: ("propertyStation" in parsed ? (parsed as any).propertyStation : null) || null,
              roomNumber: ("propertyRoom" in parsed ? (parsed as any).propertyRoom : null) || null,
              area: ("propertyArea" in parsed ? (parsed as any).propertyArea : null) || null,
              rent: ("propertyRent" in parsed ? (parsed as any).propertyRent : null) || null,
              layout: ("propertyLayout" in parsed ? (parsed as any).propertyLayout : null) || null,
              url: ("propertyUrl" in parsed ? (parsed as any).propertyUrl : null) || null,
            },
          });
        }

        // Auto-start default workflow if exists
        const defaultWorkflow = await prisma.workflow.findFirst({
          where: { organizationId: org.id, isDefault: true, isActive: true },
          include: { steps: { orderBy: { order: "asc" } } },
        });
        if (defaultWorkflow && defaultWorkflow.steps.length > 0) {
          const firstStep = defaultWorkflow.steps[0];
          let nextRunAt: Date | null = null;
          if (firstStep.isImmediate) {
            nextRunAt = new Date();
          } else {
            const now = new Date();
            const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
            const [h, m] = (firstStep.timeOfDay || "10:00").split(":").map(Number);
            const target = new Date(jstNow);
            target.setHours(h, m, 0, 0);
            target.setDate(target.getDate() + firstStep.daysAfter);
            nextRunAt = new Date(target.getTime() - 9 * 60 * 60 * 1000);
          }
          await prisma.workflowRun.create({
            data: {
              customerId: customer.id,
              workflowId: defaultWorkflow.id,
              status: "RUNNING",
              currentStepIndex: 0,
              nextRunAt,
            },
          });
          console.log("[Email Webhook] Auto-started default workflow for", customer.name);
        }
      } else {
        await prisma.customer.update({ where: { id: customer.id }, data: { isNeedAction: true, updatedAt: new Date() } });
      }

      await prisma.message.create({
        data: {
          customerId: customer.id,
          direction: "INBOUND",
          channel: "EMAIL",
          subject: subject || parsed.source + "\u304B\u3089\u306E\u304A\u554F\u3044\u5408\u308F\u305B",
          body,
          status: "DELIVERED",
        },
      });
      return NextResponse.json({ success: true, type: "portal", source: parsed.source, customerId: customer.id });
    }

    // Regular email reply from existing customer
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
  } catch (error: any) {
    console.error("[Email Webhook] Error:", error?.message || error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
