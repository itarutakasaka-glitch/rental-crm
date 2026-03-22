"use client";
import { useState, useEffect } from "react";

type Rule = {
  id?: string; name: string; isDefault: boolean;
  deposit: string; keyMoney: string; brokerageFee: string; insuranceFee: string;
  lockChangeFee: string; guaranteeFee: string; cleaningFee: string;
  otherFees: string; advanceRent: string; notes: string;
};

const EMPTY: Rule = { name: "", isDefault: false, deposit: "", keyMoney: "", brokerageFee: "", insuranceFee: "", lockChangeFee: "", guaranteeFee: "", cleaningFee: "", otherFees: "", advanceRent: "", notes: "" };

const FIELDS: { key: keyof Rule; label: string; placeholder: string }[] = [
  { key: "deposit", label: "敷金", placeholder: "例: 賃料1ヶ月、0" },
  { key: "keyMoney", label: "礼金", placeholder: "例: 賃料1ヶ月、0" },
  { key: "brokerageFee", label: "仲介手数料", placeholder: "例: 賃料1ヶ月+税、賃料0.5ヶ月+税" },
  { key: "guaranteeFee", label: "保証料", placeholder: "例: 賃料50%、月額賃料等合計の50%" },
  { key: "insuranceFee", label: "火災保険", placeholder: "例: 20000、15000" },
  { key: "lockChangeFee", label: "鍵交換費", placeholder: "例: 16500、22000" },
  { key: "cleaningFee", label: "クリーニング費", placeholder: "例: 33000、物件による" },
  { key: "advanceRent", label: "前家賃", placeholder: "例: 当月日割+翌月" },
  { key: "otherFees", label: "その他費用", placeholder: "例: 消臭代11000、安心サポート16500" },
];

const inputStyle: React.CSSProperties = { width: "100%", padding: "7px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 12, outline: "none", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 2 };

export default function CostRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => fetch("/api/agent/cost-rules").then(r => r.json()).then(d => setRules(d.rules || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name) return;
    setSaving(true);
    const r = await fetch("/api/agent/cost-rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing) });
    if (r.ok) { setMsg("✅ 保存しました"); setEditing(null); load(); }
    else setMsg("❌ エラー");
    setSaving(false);
    setTimeout(() => setMsg(""), 2000);
  };

  const del = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch("/api/agent/cost-rules", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>💰 初期費用計算ルール</h1>
      <p style={{ fontSize: 11, color: "#888", marginBottom: 16 }}>
        会社ごとの初期費用計算ルールを設定します。AIエージェントが顧客への見積もり回答に使用します。
        {msg && <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 700 }}>{msg}</span>}
      </p>

      {/* Rule list */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {rules.map(r => (
          <div key={r.id} onClick={() => setEditing({ ...r })} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", cursor: "pointer", minWidth: 200, position: "relative" }}>
            {r.isDefault && <span style={{ position: "absolute", top: 4, right: 6, fontSize: 9, background: "#d4a017", color: "#fff", padding: "1px 6px", borderRadius: 4 }}>デフォルト</span>}
            <div style={{ fontSize: 14, fontWeight: 700 }}>{r.name}</div>
            <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>
              敷: {r.deposit || "-"} / 礼: {r.keyMoney || "-"} / 仲: {r.brokerageFee || "-"}
            </div>
          </div>
        ))}
        <div onClick={() => setEditing({ ...EMPTY })} style={{ background: "#f9fafb", border: "2px dashed #ddd", borderRadius: 8, padding: "10px 14px", cursor: "pointer", minWidth: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 13, fontWeight: 600 }}>
          ＋ ルールを追加
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{editing.id ? "✏️ ルール編集" : "➕ 新規ルール"}</h2>
            <div style={{ display: "flex", gap: 6 }}>
              {editing.id && <button onClick={() => del(editing.id!)} style={{ background: "#fee2e2", border: "none", color: "#dc2626", borderRadius: 6, padding: "5px 12px", fontSize: 11, cursor: "pointer" }}>🗑 削除</button>}
              <button onClick={() => setEditing(null)} style={{ background: "#f3f4f6", border: "none", color: "#666", borderRadius: 6, padding: "5px 12px", fontSize: 11, cursor: "pointer" }}>キャンセル</button>
              <button onClick={save} disabled={saving} style={{ background: "#d4a017", border: "none", color: "#fff", borderRadius: 6, padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {saving ? "保存中..." : "💾 保存"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ gridColumn: "span 2" }}>
              <div style={labelStyle}>ルール名 *</div>
              <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} style={inputStyle} placeholder="例: 標準プラン、初期費用軽減パック" />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={editing.isDefault} onChange={e => setEditing({ ...editing, isDefault: e.target.checked })} />
                デフォルトルールとして使用
              </label>
            </div>
            {FIELDS.map(f => (
              <div key={f.key}>
                <div style={labelStyle}>{f.label}</div>
                <input value={(editing as any)[f.key] || ""} onChange={e => setEditing({ ...editing, [f.key]: e.target.value })} style={inputStyle} placeholder={f.placeholder} />
              </div>
            ))}
            <div style={{ gridColumn: "span 2" }}>
              <div style={labelStyle}>備考・特記事項</div>
              <textarea value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder="その他の注意事項やルール" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
