import { verifyLineSignature, getLineProfile, sendLineMessage, type LineWebhookEvent, type LineCreds } from "@/lib/channels/line";
import { prisma } from "@/lib/db/prisma";
import { nextStateOnInbound } from "@/lib/agent-state";
import { resolveSingleOrgOrNull } from "@/lib/resolve-single-org";

// implementation-spec-v1.md §6: LINE Webhook の本体。
// 共通の LINE 公式アカウント(/api/webhook/line)と、会社ごとの LINE 公式アカウント
// (/api/webhook/line/[channelId])の両方から呼ばれる。違いは「どの認証情報で検証・返信するか」と
// 「どの会社の顧客を探すか」だけなので、処理はここに1本化する。

const MSG_THANKS_REFOLLOW = "お問い合わせありがとうございます。お気軽にLINEでご連絡ください。";
const MSG_ASK_CODE = "お問い合わせありがとうございます。\n\nお手数ですが、メールに記載の4桁の認証コードをこのチャットに送信してください。";
const MSG_CODE_NG = "認証コードが確認できませんでした。お手数ですが、もう一度ご確認ください。";

export type LineWebhookCtx = {
  creds?: LineCreds;
  /** 会社ごとのチャネルなら、その会社。共通チャネルのときは null(1社運用の間だけ推測する) */
  organizationId?: string | null;
};

export async function handleLineWebhook(
  rawBody: string,
  signature: string,
  ctx: LineWebhookCtx = {}
): Promise<{ status: number; body: any }> {
  if (!(await verifyLineSignature(rawBody, signature, ctx.creds))) {
    console.log("LINE webhook: invalid signature");
    return { status: 401, body: { error: "Invalid signature" } };
  }

  const orgId = ctx.organizationId || null;
  // 会社ごとのチャネルなら、その会社の顧客だけを対象にする(他社の顧客に紐づけないため)
  const orgScope = orgId ? { organizationId: orgId } : {};
  const creds = ctx.creds;

  const { events = [] }: { events: LineWebhookEvent[] } = JSON.parse(rawBody);
  for (const event of events) {
    const lineUserId = event.source.userId;
    console.log("LINE event:", event.type, "userId:", lineUserId, "org:", orgId || "(common)");

    if (event.type === "follow") {
      const profile = await getLineProfile(lineUserId, creds);

      const existing = await prisma.customer.findFirst({ where: { lineUserId, ...orgScope } });
      if (existing) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: { isNeedAction: true, lineBlockedAt: null, lastActiveAt: new Date() },
        });
        await sendLineMessage(lineUserId, MSG_THANKS_REFOLLOW, creds);
        continue;
      }

      // 会社ごとのチャネルなら会社が確定する。共通チャネルのときだけ「1社しか無ければその会社」で推測する。
      const pendingOrgId = orgId ?? (await resolveSingleOrgOrNull())?.id ?? null;
      await prisma.linePending.upsert({
        where: { lineUserId },
        update: { displayName: profile?.displayName, pictureUrl: profile?.pictureUrl, organizationId: pendingOrgId },
        create: { lineUserId, code: "PENDING", displayName: profile?.displayName, pictureUrl: profile?.pictureUrl, organizationId: pendingOrgId },
      });

      await sendLineMessage(lineUserId, MSG_ASK_CODE, creds);

    } else if (event.type === "unfollow") {
      await prisma.customer.updateMany({ where: { lineUserId, ...orgScope }, data: { lineBlockedAt: new Date() } });
      await prisma.linePending.deleteMany({ where: { lineUserId } });

    } else if (event.type === "message" && event.message.type === "text") {
      const text = event.message.text.trim();

      const linked = await prisma.customer.findFirst({ where: { lineUserId, ...orgScope } });
      if (linked) {
        await prisma.message.create({ data: { customerId: linked.id, direction: "INBOUND", channel: "LINE", body: text, status: "SENT" } });
        // implementation-spec-v1.md §2.2: 受信時の遷移は lib/agent-state.ts の1箇所で決める
        const nextState = nextStateOnInbound(linked.agentState);
        await prisma.customer.update({
          where: { id: linked.id },
          data: { lastActiveAt: new Date(), isNeedAction: true, hasCustomerReplied: true, agentState: nextState },
        });
        await prisma.workflowRun.updateMany({
          where: { customerId: linked.id, status: "RUNNING" },
          data: { status: "STOPPED_BY_REPLY" },
        });
        if (nextState !== linked.agentState) console.log("[LINE Webhook] agentState", linked.agentState, "->", nextState, ":", linked.name);
        continue;
      }

      // 認証コード照合
      if (/^\d{4}$/.test(text)) {
        const pending = await prisma.linePending.findFirst({ where: { lineUserId } });
        if (pending) {
          const customer = await prisma.customer.findFirst({ where: { lineCode: text, lineUserId: null, ...orgScope } });
          if (customer) {
            await prisma.customer.update({
              where: { id: customer.id },
              data: {
                lineUserId,
                lineDisplayName: pending.displayName,
                lineLinkedAt: new Date(),
                lastActiveAt: new Date(),
                lineCode: null,
                isNeedAction: true,
              },
            });
            await prisma.linePending.delete({ where: { id: pending.id } });
            await prisma.workflowRun.updateMany({
              where: { customerId: customer.id, status: "RUNNING" },
              data: { status: "STOPPED_BY_LINE_ADD" },
            });
            await sendLineMessage(lineUserId, `${customer.name}様、連携が完了しました！今後はLINEでもお気軽にご連絡ください。`, creds);
            continue;
          }
        }
        await sendLineMessage(lineUserId, MSG_CODE_NG, creds);
      }
    }
  }
  return { status: 200, body: { ok: true } };
}
