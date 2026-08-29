// システムのエラー・障害通知は全てここを通して #900_dev_monitoring(C0BHASH7LB1)へ
// Bot名義で投稿する(ハウスルール: 個人メール宛は禁止、Itaru本人アカウントでの投稿も禁止)。
// 既知バグ対策: Vercel env経由のSLACK_BOT_TOKENは先頭にBOM(U+FEFF)が混入することがあり
// Authorizationヘッダで500になるため、印字可能ASCII以外を除去してから使う。
const DEV_MONITORING_CHANNEL = "C0BHASH7LB1";

function cleanToken(token: string): string {
  return token.replace(/[^\x21-\x7e]/g, "");
}

export async function notifySlackError(params: { title: string; detail: string; source: string }) {
  const rawToken = process.env.SLACK_BOT_TOKEN;
  if (!rawToken) {
    console.error("[notifySlackError] SLACK_BOT_TOKEN not set, cannot notify:", params.title);
    return;
  }
  const token = cleanToken(rawToken);
  const text = `:warning: *${params.title}*\n対象/内容: ${params.detail}\nsource: ${params.source}`;
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ channel: DEV_MONITORING_CHANNEL, text }),
    });
    const data = await res.json();
    if (!data.ok) console.error("[notifySlackError] Slack API error:", data.error);
  } catch (e: any) {
    // 通知の失敗自体でリクエスト処理を落とさない(握りつぶすが、最低限ログには残す)
    console.error("[notifySlackError] fetch failed:", e.message);
  }
}
