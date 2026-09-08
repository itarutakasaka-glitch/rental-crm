// implementation-spec-v1.md §6: 「会社ごとの設定をどう使うか」の判断だけを、DB から切り離して置く。
// ここが一番間違えると危ないところ（他社名義で送ってしまう／止めたつもりが送られる）なので、
// テストできる純粋な関数にしてある。channel-resolver.ts が DB から読んだ行をここに渡す。

export type ChannelRow = {
  isActive: boolean;
  fromName: string | null;
  fromAddress: string | null;
  lineChannelId: string | null;
  lineBasicId: string | null;
  smsFromNumber: string | null;
  secretEnc: string | null;
  webhookSecretEnc: string | null;
};

export type Decision<T> =
  /** この設定で送ってよい */
  | { kind: "use"; value: T }
  /** 会社の設定が無いのでシステム既定を使う（移行期間のみ） */
  | { kind: "default" }
  /** 送ってはいけない（無効化されている／設定が欠けている） */
  | { kind: "blocked"; reason: string };

export function decideEmail(row: ChannelRow | null): Decision<{ fromName: string | null; fromAddress: string }> {
  if (!row) return { kind: "default" };
  if (!row.isActive) return { kind: "blocked", reason: "会社の設定で無効になっています" };
  if (!row.fromAddress) return { kind: "blocked", reason: "送信元アドレスが未入力です" };
  return { kind: "use", value: { fromName: row.fromName, fromAddress: row.fromAddress } };
}

export function decideLine(
  row: ChannelRow | null,
  decrypt: (v: string | null) => string | null
): Decision<{ accessToken: string; channelSecret: string | null; lineChannelId: string | null; lineBasicId: string | null }> {
  if (!row) return { kind: "default" };
  if (!row.isActive) return { kind: "blocked", reason: "会社の設定で無効になっています" };
  const accessToken = decrypt(row.secretEnc);
  if (!accessToken) return { kind: "blocked", reason: "アクセストークンが未設定か復号できません（再入力が必要）" };
  return {
    kind: "use",
    value: {
      accessToken,
      channelSecret: decrypt(row.webhookSecretEnc),
      lineChannelId: row.lineChannelId,
      lineBasicId: row.lineBasicId,
    },
  };
}

export function decideSms(
  row: ChannelRow | null,
  decrypt: (v: string | null) => string | null
): Decision<{ fromNumber: string | null; accountSid: string | null; authToken: string | null }> {
  if (!row) return { kind: "default" };
  if (!row.isActive) return { kind: "blocked", reason: "会社の設定で無効になっています" };
  const authToken = decrypt(row.secretEnc);
  if (!row.smsFromNumber) return { kind: "blocked", reason: "送信元番号が未入力です" };
  if (!authToken) return { kind: "blocked", reason: "Auth Token が未設定か復号できません（再入力が必要）" };
  // fromName 列を Account SID の保管に流用している（画面のラベルは「Account SID」）
  return { kind: "use", value: { fromNumber: row.smsFromNumber, accountSid: row.fromName, authToken } };
}

/** 友だち追加 URL。ベーシック ID があればそれを優先し、無ければ会社に登録済みの URL。 */
export function lineInviteUrlFrom(basicId: string | null | undefined, orgLineUrl?: string | null): string {
  if (basicId) return `https://line.me/R/ti/p/${basicId.startsWith("@") ? basicId : "@" + basicId}`;
  return orgLineUrl || "";
}
