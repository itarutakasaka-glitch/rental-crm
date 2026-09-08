const LINE_API_BASE = "https://api.line.me/v2/bot";

// implementation-spec-v1.md §6: 会社ごとの LINE 公式アカウントに対応するため、
// 認証情報を引数で受け取れるようにした。省略時はシステム既定(環境変数)を使う。
export type LineCreds = { accessToken: string; channelSecret?: string | null };

function getConfig(creds?: LineCreds) {
  if (creds?.accessToken) return { channelAccessToken: creds.accessToken, channelSecret: creds.channelSecret || "" };
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!token || !secret) throw new Error("LINE credentials not set");
  return { channelAccessToken: token, channelSecret: secret };
}

async function lineRequest(path: string, body: any, creds?: LineCreds) {
  const config = getConfig(creds);
  const res = await fetch(`${LINE_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.channelAccessToken}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`LINE API: ${res.status} ${JSON.stringify(e)}`); }
  return res.json().catch(() => ({}));
}

export async function sendLineMessage(lineUserId: string, text: string, creds?: LineCreds) {
  return lineRequest("/message/push", { to: lineUserId, messages: [{ type: "text", text }] }, creds);
}

export async function sendLineButtonMessage(lineUserId: string, params: { title: string; text: string; actions: { type: "uri"|"message"; label: string; uri?: string; text?: string }[]; }, creds?: LineCreds) {
  return lineRequest("/message/push", { to: lineUserId, messages: [{ type: "template", altText: params.title, template: { type: "buttons", title: params.title.substring(0,40), text: params.text.substring(0,60), actions: params.actions.slice(0,4) } }] }, creds);
}

export async function verifyLineSignature(body: string, signature: string, creds?: LineCreds): Promise<boolean> {
  const config = getConfig(creds);
  // 署名検証にチャネルシークレットが無い場合は「検証できない」＝不合格にする(fail-closed)
  if (!config.channelSecret) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(config.channelSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(sig))) === signature;
}

export type LineWebhookEvent =
  | { type: "message"; replyToken: string; source: { userId: string }; message: { type: "text"; text: string } }
  | { type: "follow"; replyToken: string; source: { userId: string } }
  | { type: "unfollow"; source: { userId: string } }
  | { type: "postback"; replyToken: string; source: { userId: string }; postback: { data: string } };

export async function getLineProfile(lineUserId: string, creds?: LineCreds) {
  const config = getConfig(creds);
  const res = await fetch(`https://api.line.me/v2/profile/${lineUserId}`, { headers: { Authorization: `Bearer ${config.channelAccessToken}` } });
  if (!res.ok) return null;
  return res.json() as Promise<{ userId: string; displayName: string; pictureUrl?: string }>;
}
