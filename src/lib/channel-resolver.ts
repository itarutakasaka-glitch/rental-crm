import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/crypto";
import { notifySlackError } from "@/lib/notify-slack";
import { decideEmail, decideLine, decideSms, lineInviteUrlFrom, type ChannelRow } from "@/lib/channel-decision";

// implementation-spec-v1.md §6 / §6.1: 会社ごとの外部連携の解決。
//
// 解決順: 店舗の設定 → 会社の設定 → システム既定（環境変数）
// ただし **会社の設定が「無効(isActive=false)」のときは既定に落とさず送信を拒否**する。
// 「止めているつもりなのに、ヘヤクレス既定の名義で他社の顧客へ送ってしまう」のが一番まずいため。
//
// 「未設定」のときだけ既定を使う（1社目の移行期間用。D-2 で既定を廃止する）。
// 判断そのものは channel-decision.ts（DB に触らない純粋な関数）にあり、ここは DB 読みと通知だけ。

export type EmailChannel = {
  fromName: string | null;
  fromAddress: string;
  source: "store" | "organization" | "default";
};

export type LineChannel = {
  accessToken: string;
  channelSecret: string | null;
  lineChannelId: string | null;
  lineBasicId: string | null;
  source: "store" | "organization" | "default";
};

export type SmsChannel = {
  fromNumber: string | null;
  accountSid: string | null;
  authToken: string | null;
  source: "store" | "organization" | "default";
};

/** 送信を止めるべきとき（会社が明示的に無効化している／設定はあるが値が欠けている） */
export class ChannelBlockedError extends Error {
  constructor(public readonly detail: string) {
    super(detail);
    this.name = "ChannelBlockedError";
  }
}

type Found = { row: ChannelRow; source: "store" | "organization" };

async function findChannel(
  organizationId: string,
  storeId: string | null | undefined,
  type: "EMAIL" | "LINE" | "SMS"
): Promise<Found | null> {
  // 店舗の設定を優先し、無ければ会社の設定
  if (storeId) {
    const s = await prisma.organizationChannel.findFirst({ where: { organizationId, storeId, type } });
    if (s) return { row: s, source: "store" };
  }
  const o = await prisma.organizationChannel.findFirst({ where: { organizationId, storeId: null, type } });
  if (o) return { row: o, source: "organization" };
  return null;
}

async function blocked(organizationId: string, type: string, reason: string): Promise<never> {
  await notifySlackError({
    title: `送信を中止しました（${type} の連携が無効／不完全）`,
    detail: `organizationId=${organizationId}\n理由: ${reason}\n設定画面: /settings/channels`,
    source: "lib/channel-resolver",
  });
  throw new ChannelBlockedError(reason);
}

export async function resolveEmailChannel(organizationId: string, storeId?: string | null): Promise<EmailChannel> {
  const found = await findChannel(organizationId, storeId, "EMAIL");
  const d = decideEmail(found?.row ?? null);
  if (d.kind === "blocked") await blocked(organizationId, "EMAIL", d.reason);
  if (d.kind === "use") return { ...d.value, source: found!.source };
  return {
    fromName: null,
    fromAddress: process.env.RESEND_FROM_EMAIL || "noreply@send.heyacules.com",
    source: "default",
  };
}

export async function resolveLineChannel(organizationId: string, storeId?: string | null): Promise<LineChannel> {
  const found = await findChannel(organizationId, storeId, "LINE");
  const d = decideLine(found?.row ?? null, decryptSecret);
  if (d.kind === "blocked") await blocked(organizationId, "LINE", d.reason);
  if (d.kind === "use") return { ...d.value, source: found!.source };

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) await blocked(organizationId, "LINE", "会社の設定もシステム既定もありません");
  return {
    accessToken: token!,
    channelSecret: process.env.LINE_CHANNEL_SECRET || null,
    lineChannelId: null,
    lineBasicId: null,
    source: "default",
  };
}

export async function resolveSmsChannel(organizationId: string, storeId?: string | null): Promise<SmsChannel> {
  const found = await findChannel(organizationId, storeId, "SMS");
  const d = decideSms(found?.row ?? null, decryptSecret);
  if (d.kind === "blocked") await blocked(organizationId, "SMS", d.reason);
  if (d.kind === "use") return { ...d.value, source: found!.source };
  return {
    fromNumber: process.env.TWILIO_FROM_NUMBER || null,
    accountSid: process.env.TWILIO_ACCOUNT_SID || null,
    authToken: process.env.TWILIO_AUTH_TOKEN || null,
    source: "default",
  };
}

/**
 * 文面の {{line_url}} に使う友だち追加URL。
 * 会社の LINE 設定に lineBasicId があればそれ、無ければ Organization.lineUrl。
 */
export async function resolveLineInviteUrl(organizationId: string, orgLineUrl?: string | null): Promise<string> {
  const found = await findChannel(organizationId, null, "LINE");
  return lineInviteUrlFrom(found?.row.lineBasicId, orgLineUrl);
}

/**
 * Resend の from ヘッダ用文字列を作る。
 * 会社の設定に差出人名があればそれを使い、無ければ呼び出し側の既定（店舗名など）にする。
 */
export function buildEmailFrom(ch: EmailChannel, fallbackName?: string | null): string {
  const name = (ch.fromName || fallbackName || "").trim();
  return name ? `${name} <${ch.fromAddress}>` : ch.fromAddress;
}
