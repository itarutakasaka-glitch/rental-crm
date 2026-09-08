"use client";

import { useEffect, useState } from "react";
import { CyberpunkSpinner } from "@/components/ui/cyberpunk-spinner";

// implementation-spec-v1.md §6.2 (M-10) 店舗スケジュール連動。
// カードは店舗ごとに縦1列（CLAUDE.md）。

type Link = {
  provider: string;
  isActive: boolean;
  calendarId: string | null;
  slotMinutes: number;
  hoursStart: string | null;
  hoursEnd: string | null;
  hasSecret: boolean;
  lastErrorAt: string | null;
  lastError: string | null;
};
type Store = { id: string; name: string; link: Link | null };

const PROVIDER_LABEL: Record<string, string> = {
  INTERNAL: "CRM内の予約枠のみ（外部連携なし）",
  GOOGLE_CALENDAR: "Googleカレンダー（未実装）",
  CYBOZU: "サイボウズ（未実装）",
  TIMETREE: "TimeTree（未実装）",
  CANARY: "カナリークラウド（未実装）",
};

const S = {
  page: { padding: "24px 32px", maxWidth: 720, overflow: "auto" as const, height: "100%" } as React.CSSProperties,
  title: { fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#1f2937" } as React.CSSProperties,
  lead: { fontSize: 13, color: "#6b7280", lineHeight: 1.8, marginBottom: 20 } as React.CSSProperties,
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px", marginBottom: 16, minHeight: 190 } as React.CSSProperties,
  cardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 } as React.CSSProperties,
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#1f2937" } as React.CSSProperties,
  label: { fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" } as React.CSSProperties,
  input: { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, marginBottom: 12, boxSizing: "border-box" as const } as React.CSSProperties,
  row: { display: "flex", gap: 12 } as React.CSSProperties,
  hint: { fontSize: 11, color: "#9ca3af", marginTop: -8, marginBottom: 12, lineHeight: 1.7 } as React.CSSProperties,
  btn: { background: "#d4a017", color: "#fff", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" } as React.CSSProperties,
  err: { background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", borderRadius: 6, padding: "8px 12px", fontSize: 12, marginBottom: 12, lineHeight: 1.7 } as React.CSSProperties,
};

export default function ScheduleLinkPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [defaultHours, setDefaultHours] = useState({ start: "09:30", end: "17:00" });
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [message, setMessage] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await fetch("/api/schedule-links");
      const data = await res.json();
      setStores(data.stores || []);
      if (data.defaultHours) setDefaultHours(data.defaultHours);
    } finally { setLoading(false); }
  }

  function val(store: Store, key: string, fallback: any = "") {
    const k = `${store.id}:${key}`;
    if (k in draft) return draft[k];
    const v = store.link ? (store.link as any)[key] : null;
    return v ?? fallback;
  }
  const set = (store: Store, key: string, value: any) => setDraft(d => ({ ...d, [`${store.id}:${key}`]: value }));

  async function save(store: Store) {
    setMessage("");
    const res = await fetch("/api/schedule-links", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: store.id,
        provider: val(store, "provider", "INTERNAL"),
        isActive: !!val(store, "isActive", false),
        slotMinutes: Number(val(store, "slotMinutes", 60)),
        hoursStart: val(store, "hoursStart") || null,
        hoursEnd: val(store, "hoursEnd") || null,
        calendarId: val(store, "calendarId") || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setMessage(res.ok ? `${store.name} の設定を保存しました` : json.error || "保存に失敗しました");
    await load();
    setTimeout(() => setMessage(""), 4000);
  }

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><CyberpunkSpinner size={40} /></div>;

  return (
    <div style={S.page}>
      <h1 style={S.title}>店舗スケジュール連動</h1>
      <p style={S.lead}>
        連動を有効にした店舗では、お客様がセルフ予約を入れた時点で空きを確認し、空いていれば<strong>その場で確定</strong>します。
        連動していない店舗の予約は<strong>未確定</strong>のまま受け付け、担当者がお客様へ連絡して確定させます。
      </p>

      {stores.length === 0 && <div style={S.card}>店舗が登録されていません。先に会社・店舗情報を登録してください。</div>}

      {stores.map(store => (
        <div key={store.id} style={S.card}>
          <div style={S.cardHead}>
            <div style={S.cardTitle}>{store.name}</div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
              <input type="checkbox" checked={!!val(store, "isActive", false)} onChange={e => set(store, "isActive", e.target.checked)} />
              連動を有効にする
            </label>
          </div>

          {store.link?.lastError && (
            <div style={S.err}>
              連動先でエラーが続いています。この店舗は「連動なし」として扱われ、予約は未確定になります。<br />
              {store.link.lastError}
            </div>
          )}

          <label style={S.label}>連動先</label>
          <select style={S.input} value={val(store, "provider", "INTERNAL")} onChange={e => set(store, "provider", e.target.value)}>
            {Object.entries(PROVIDER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div style={S.hint}>
            外部カレンダーとの接続はまだ実装していません。「未実装」を選ぶと、勝手に確定させないため連動なしとして扱います。
          </div>

          <label style={S.label}>1枠の長さ（分）</label>
          <input style={S.input} type="number" min={15} step={15} value={val(store, "slotMinutes", 60)} onChange={e => set(store, "slotMinutes", e.target.value)} />

          <label style={S.label}>受付時間（空欄なら来店予約設定の {defaultHours.start}〜{defaultHours.end}）</label>
          <div style={S.row}>
            <input style={S.input} value={val(store, "hoursStart")} onChange={e => set(store, "hoursStart", e.target.value)} placeholder={defaultHours.start} />
            <input style={S.input} value={val(store, "hoursEnd")} onChange={e => set(store, "hoursEnd", e.target.value)} placeholder={defaultHours.end} />
          </div>
          <div style={S.hint}>定休日は店舗の定休日ルールから判定します。埋まっている枠は同じ日の来店予定から数えます。</div>

          <button style={S.btn} onClick={() => save(store)}>保存</button>
        </div>
      ))}

      {message && <div style={{ fontSize: 13, color: message.includes("失敗") || message.includes("できません") ? "#dc2626" : "#059669" }}>{message}</div>}
    </div>
  );
}
