import { NextRequest, NextResponse } from "next/server";
import { verifySharedSecret } from "@/lib/shared-secret";
import { verifySvixSignature, readSvixHeaders } from "@/lib/svix-verify";
import { saveInboundAttachments } from "@/lib/inbound-attachments";
import { parsePortalInquiry } from "@/lib/parsers/portal-inquiry";
import { prisma } from "@/lib/db/prisma";
import { resolveSingleOrgOrNull, resolveOrgByRecipient } from "@/lib/resolve-single-org";
import { notifySlackError } from "@/lib/notify-slack";
import { nextStateOnInbound } from "@/lib/agent-state";

// SUUMO parser
export async function POST(request: NextRequest) {
  try {
    // architecture-v2.md §10 A-5 / implementation-spec-v1.md §3:
    // RESEND_WEBHOOK_SECRET が登録されていれば送信元固有の svix 署名で検証する（本命）。
    // 未登録の間だけ従来の共有秘密鍵にフォールバックする（移行期間。登録した時点で自動的に切り替わる）。
    const rawBody = await request.text();
    const svixSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (svixSecret) {
      const result = verifySvixSignature({ secret: svixSecret, headers: readSvixHeaders(request), rawBody });
      if (!result.ok) {
        console.error("[Email Webhook] svix verification failed:", result.reason);
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else {
      const denied = verifySharedSecret(request, { allowQuery: true });
      if (denied) return denied;
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Support both Resend webhook format (nested in data) and direct format
    const emailData = payload.data || payload;
    const fromRaw = emailData.from;
    const subject = emailData.subject || "";
    let body = "";
    // F-6: 添付の取り込みにも使うので、詳細はこの外でも参照できるようにしておく
    let emailDetail: any = emailData;
    if (emailData.email_id && process.env.RESEND_API_KEY) {
      try {
        const emailRes = await fetch(`https://api.resend.com/emails/receiving/${emailData.email_id}`, {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        });
        emailDetail = await emailRes.json();
        body = emailDetail.text || emailDetail.html || "";
      } catch (e) {
        console.error("[Email Webhook] Failed to fetch email body:", e);
      }
    }
    const fromAddress = typeof fromRaw === "string" ? fromRaw : fromRaw?.address || (Array.isArray(fromRaw) ? fromRaw[0]?.address : "") || "";
    const toRaw = emailData.to;
    const toAddress = typeof toRaw === "string" ? toRaw : toRaw?.address || (Array.isArray(toRaw) ? toRaw[0]?.address || toRaw[0] : "") || "";

    console.log("[Email Webhook] From:", fromAddress, "To:", toAddress, "Subject:", subject);

    // architecture-v2.md §4: 宛先(hankyo+<slug>@...)から組織を解決。slugが無い/一致しない場合は
    // 組織が1社の間だけ動く暫定フォールバック(resolveSingleOrgOrNull)。
    const org = (await resolveOrgByRecipient(toAddress)) || (await resolveSingleOrgOrNull());
    if (!org) return NextResponse.json({ error: "組織を一意に特定できません(複数組織対応は未実装)" }, { status: 400 });

    const defaultStatus = await prisma.status.findFirst({
      where: { organizationId: org.id, isDefault: true },
    }) || await prisma.status.findFirst({
      where: { organizationId: org.id },
      orderBy: { order: "asc" },
    });
    if (!defaultStatus) return NextResponse.json({ error: "No default status" }, { status: 400 });

    const parsed = parsePortalInquiry(subject, body);

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
            agentState: "FIRST_MAIL_PENDING", // implementation-spec-v1.md §2.2(memo マーカー廃止)
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

      const inboundMsg = await prisma.message.create({
        data: {
          customerId: customer.id,
          direction: "INBOUND",
          channel: "EMAIL",
          subject: subject || parsed.source + "\u304B\u3089\u306E\u304A\u554F\u3044\u5408\u308F\u305B",
          body,
          status: "DELIVERED",
        },
      });
      await saveInboundAttachments({ emailDetail, organizationId: org.id, customerId: customer.id, messageId: inboundMsg.id });
      return NextResponse.json({ success: true, type: "portal", source: parsed.source, customerId: customer.id });
    }

    // Regular email reply from existing customer
    const existingCustomer = await prisma.customer.findFirst({ where: { email: fromAddress, organizationId: org.id } });
    if (existingCustomer) {
      const replyMsg = await prisma.message.create({
        data: { customerId: existingCustomer.id, direction: "INBOUND", channel: "EMAIL", subject: subject || null, body, status: "DELIVERED" },
      });
      await saveInboundAttachments({ emailDetail, organizationId: existingCustomer.organizationId, customerId: existingCustomer.id, messageId: replyMsg.id });
      // implementation-spec-v1.md §2.2: 受信時の遷移は lib/agent-state.ts の1箇所で決める
      const nextState = nextStateOnInbound(existingCustomer.agentState);
      await prisma.customer.update({ where: { id: existingCustomer.id }, data: { isNeedAction: true, updatedAt: new Date(), hasCustomerReplied: true, agentState: nextState } });
      await prisma.workflowRun.updateMany({ where: { customerId: existingCustomer.id, status: "RUNNING" }, data: { status: "STOPPED_BY_REPLY" } });
      if (nextState !== existingCustomer.agentState) console.log("[Email Webhook] agentState", existingCustomer.agentState, "->", nextState, ":", existingCustomer.name);

      return NextResponse.json({ success: true, type: "reply", customerId: existingCustomer.id });
    }

    return NextResponse.json({ success: true, type: "unknown" });
  } catch (error: any) {
    console.error("[Email Webhook] Error:", error?.message || error);
    await notifySlackError({ title: "反響メールwebhook処理失敗", detail: error?.message || String(error), source: "api/webhook/email" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
