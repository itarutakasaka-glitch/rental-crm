const LINE_API_BASE = "https://api.line.me/v2/bot";

function getConfig() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!token || !secret) throw new Error("LINE credentials not set");
  return { channelAccessToken: token, channelSecret: secret };
}

async function lineRequest(path: string, body: any) {
  const config = getConfig();
  const res = await fetch(`${LINE_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.channelAccessToken}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`LINE API: ${res.status} ${JSON.stringify(e)}`); }
  return res.json().catch(() => ({}));
}

export async function sendLineMessage(lineUserId: string, text: string) {
  return lineRequest("/message/push", { to: lineUserId, messages: [{ type: "text", text }] });
}

export async function sendLineButtonMessage(lineUserId: string, params: { title: string; text: string; actions: { type: "uri"|"message"; label: string; uri?: string; text?: string }[]; }) {
  return lineRequest("/message/push", { to: lineUserId, messages: [{ type: "template", altText: params.title, template: { type: "buttons", title: params.title.substring(0,40), text: params.text.substring(0,60), actions: params.actions.slice(0,4) } }] });
}

export async function verifyLineSignature(body: string, signature: string): Promise<boolean> {
  const config = getConfig();
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

export async function getLineProfile(lineUserId: string) {
  const config = getConfig();
  const res = await fetch(`https://api.line.me/v2/profile/${lineUserId}`, { headers: { Authorization: `Bearer ${config.channelAccessToken}` } });
  if (!res.ok) return null;
  return res.json() as Promise<{ userId: string; displayName: string; pictureUrl?: string }>;
}
