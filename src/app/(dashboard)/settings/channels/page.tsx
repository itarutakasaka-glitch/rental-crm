"use client";

import { useEffect, useState } from "react";
import { CyberpunkSpinner } from "@/components/ui/cyberpunk-spinner";

// implementation-spec-v1.md §6.1 会社ごとの外部連携設定。
// カードは縦1列（横並びグリッド禁止・CLAUDE.md）。秘密情報は保存後マスクしか返らない。

type Channel = {
  id: string;
  type: "EMAIL" | "LINE" | "SMS";
  storeId: string | null;
  isActive: boolean;
  fromName: string | null;
  fromAddress: string | null;
  lineChannelId: string | null;
  lineBasicId: string | null;
  smsFromNumber: string | null;
  hasSecret: boolean;
  secretMasked: string | null;
  hasWebhookSecret: boolean;
  webhookSecretMasked: string | null;
};

type Data = {
  channels: Channel[];
  stores: { id: string; name: string }[];
  defaults: { email: string; lineConfigured: boolean; smsConfigured: boolean };
  encryptionConfigured: boolean;
};

const TYPE_LABEL: Record<Channel["type"], string> = { EMAIL: "メール（Resend）", LINE: "LINE 公式アカウント", SMS: "SMS（Twilio）" };

const S = {
  page: { padding: "24px 32px", maxWidth: 720, overflow: "auto" as const, height: "100%" } as React.CSSProperties,
  title: { fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#1f2937" } as React.CSSProperties,
  lead: { fontSize: 13, color: "#6b7280", lineHeight: 1.8, marginBottom: 20 } as React.CSSProperties,
  card: {
    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
    padding: "20px 24px", marginBottom: 16, minHeight: 200,
  } as React.CSSProperties,
  cardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 } as React.CSSProperties,
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#1f2937" } as React.CSSProperties,
  label: { fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" } as React.CSSProperties,
  input: {
    width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6,
    fontSize: 13, marginBottom: 12, boxSizing: "border-box" as const,
  } as React.CSSProperties,
  hint: { fontSize: 11, color: "#9ca3af", marginTop: -8, marginBottom: 12 } as React.CSSProperties,
  btn: {
    background: "#d4a017", color: "#fff", border: "none", borderRadius: 6,
    padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  } as React.CSSProperties,
  warn: {
    background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e",
    borderRadius: 8, padding: "12px 16px", fontSize: 13, lineHeight: 1.7, marginBottom: 20,
  } as React.CSSProperties,
  toggle: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" } as React.CSSProperties,
};

export default function ChannelsSettingPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Record<string, any>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await fetch("/api/channels");
      setData(await res.json());
    } finally { setLoading(false); }
  }

  function current(type: Channel["type"]): Channel | undefined {
    return data?.channels.find(c => c.type === type && (c.storeId || "") === storeId);
  }

  function field(type: Channel["type"], key: string, fallback: any = "") {
    const k = `${type}:${storeId}:${key}`;
    if (k in draft) return draft[k];
    const c = current(type) as any;
    return c ? (c[key] ?? fallback) : fallback;
  }

  function set(type: Channel["type"], key: string, value: any) {
    setDraft(d => ({ ...d, [`${type}:${storeId}:${key}`]: value }));
  }

  async function save(type: Channel["type"]) {
    setMessage("");
    const body: any = {
      type,
      storeId: storeId || null,
      isActive: field(type, "isActive", true),
      fromName: field(type, "fromName") || null,
      fromAddress: field(type, "fromAddress") || null,
      lineChannelId: field(type, "lineChannelId") || null,
      lineBasicId: field(type, "lineBasicId") || null,
      smsFromNumber: field(type, "smsFromNumber") || null,
      secret: field(type, "secret") || undefined,
      webhookSecret: field(type, "webhookSecret") || undefined,
    };
    const res = await fetch("/api/channels", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(json.error || "保存に失敗しました"); return; }
    setMessage(`${TYPE_LABEL[type]} を保存しました`);
    setDraft(d => {
      const n = { ...d };
      delete n[`${type}:${storeId}:secret`];
      delete n[`${type}:${storeId}:webhookSecret`];
      return n;
    });
    await load();
    setTimeout(() => setMessage(""), 4000);
  }

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><CyberpunkSpinner size={40} /></div>;
  if (!data) return <div style={{ padding: 40, color: "#dc2626" }}>設定の読み込みに失敗しました</div>;

  const Toggle = ({ type }: { type: Channel["type"] }) => (
    <label style={S.toggle}>
      <input type="checkbox" checked={!!field(type, "isActive", true)} onChange={e => set(type, "isActive", e.target.checked)} />
      有効
    </label>
  );

  return (
    <div style={S.page}>
      <h1 style={S.title}>外部連携（会社ごとの送信設定）</h1>
      <p style={S.lead}>
        メール・LINE・SMS の送信元をこの会社専用のものに切り替えます。未設定の場合はヘヤクレス共通の設定で送信されます。
        「有効」のチェックを外すと、その手段での送信は<strong>共通設定に切り替わらず停止</strong>します（他社名義で誤送信しないため）。
      </p>

      {!data.encryptionConfigured && (
        <div style={S.warn}>
          暗号化キー（CHANNEL_SECRET_KEY）が未設定のため、アクセストークン等の秘密情報は保存できません。
          差出人名やアドレスなど、秘密でない項目は保存できます。
        </div>
      )}

      {data.stores.length > 0 && (
        <div style={S.card}>
          <div style={S.cardHead}><div style={S.cardTitle}>設定の対象</div></div>
          <label style={S.label}>会社全体 / 店舗別</label>
          <select style={S.input} value={storeId} onChange={e => { setStoreId(e.target.value); setDraft({}); }}>
            <option value="">会社全体（既定）</option>
            {data.stores.map(s => <option key={s.id} value={s.id}>{s.name}（店舗別）</option>)}
          </select>
          <div style={S.hint}>店舗別の設定がある場合はそちらが優先され、無ければ会社全体の設定が使われます。</div>
        </div>
      )}

      <div style={S.card}>
        <div style={S.cardHead}><div style={S.cardTitle}>{TYPE_LABEL.EMAIL}</div><Toggle type="EMAIL" /></div>
        <label style={S.label}>差出人名</label>
        <input style={S.input} value={field("EMAIL", "fromName")} onChange={e => set("EMAIL", "fromName", e.target.value)} placeholder="○○不動産 △△店" />
        <label style={S.label}>差出人アドレス</label>
        <input style={S.input} value={field("EMAIL", "fromAddress")} onChange={e => set("EMAIL", "fromAddress", e.target.value)} placeholder={data.defaults.email} />
        <div style={S.hint}>
          このドメインは Resend 側で送信認証（SPF / DKIM）の登録が必要です。未登録のアドレスを入れると届かなくなります。
          未入力のときは共通の {data.defaults.email} から送信します。
        </div>
        <button style={S.btn} onClick={() => save("EMAIL")}>保存</button>
      </div>

      <div style={S.card}>
        <div style={S.cardHead}><div style={S.cardTitle}>{TYPE_LABEL.LINE}</div><Toggle type="LINE" /></div>
        <label style={S.label}>チャネルアクセストークン</label>
        <input
          style={S.input} type="password" autoComplete="new-password"
          value={field("LINE", "secret")} onChange={e => set("LINE", "secret", e.target.value)}
          placeholder={current("LINE")?.hasSecret ? `設定済み（${current("LINE")?.secretMasked}）変更する場合のみ入力` : "未設定"}
        />
        <label style={S.label}>チャネルシークレット（Webhook 署名検証用）</label>
        <input
          style={S.input} type="password" autoComplete="new-password"
          value={field("LINE", "webhookSecret")} onChange={e => set("LINE", "webhookSecret", e.target.value)}
          placeholder={current("LINE")?.hasWebhookSecret ? "設定済み。変更する場合のみ入力" : "未設定"}
        />
        <label style={S.label}>チャネル ID</label>
        <input style={S.input} value={field("LINE", "lineChannelId")} onChange={e => set("LINE", "lineChannelId", e.target.value)} placeholder="1234567890" />
        <label style={S.label}>ベーシック ID（友だち追加 URL に使用）</label>
        <input style={S.input} value={field("LINE", "lineBasicId")} onChange={e => set("LINE", "lineBasicId", e.target.value)} placeholder="@xxxxxxx" />
        <div style={S.hint}>
          入力後、LINE Developers の Webhook URL に <code>{typeof window !== "undefined" ? window.location.origin : ""}/api/webhook/line/{current("LINE")?.id || "（保存後に表示）"}</code> を設定してください。
        </div>
        <button style={S.btn} onClick={() => save("LINE")}>保存</button>
      </div>

      <div style={S.card}>
        <div style={S.cardHead}><div style={S.cardTitle}>{TYPE_LABEL.SMS}</div><Toggle type="SMS" /></div>
        <label style={S.label}>Account SID</label>
        <input style={S.input} value={field("SMS", "fromName")} onChange={e => set("SMS", "fromName", e.target.value)} placeholder="ACxxxxxxxx" />
        <label style={S.label}>Auth Token</label>
        <input
          style={S.input} type="password" autoComplete="new-password"
          value={field("SMS", "secret")} onChange={e => set("SMS", "secret", e.target.value)}
          placeholder={current("SMS")?.hasSecret ? "設定済み。変更する場合のみ入力" : "未設定"}
        />
        <label style={S.label}>送信元番号</label>
        <input style={S.input} value={field("SMS", "smsFromNumber")} onChange={e => set("SMS", "smsFromNumber", e.target.value)} placeholder="+8150xxxxxxxx" />
        <button style={S.btn} onClick={() => save("SMS")}>保存</button>
      </div>

      {message && <div style={{ fontSize: 13, color: message.includes("失敗") || message.includes("できません") ? "#dc2626" : "#059669" }}>{message}</div>}
    </div>
  );
}
