"use client";
import { useState, useEffect } from "react";

type Snippet = { key: string; name: string; text: string; category: string; isCustomized: boolean };

const CAT_LABELS: Record<string, string> = {
  appointment: "アポ組み", first_response: "初回返信", qa_answer: "Q&A回答",
  follow_up: "追客", internal: "社内連絡", phone: "電話対応", office: "事務", foreigner: "外国籍",
};
const CAT_COLORS: Record<string, string> = {
  appointment: "#22c55e", first_response: "#a855f7", qa_answer: "#0891b2",
  follow_up: "#ef4444", internal: "#6b7280", phone: "#eab308", office: "#f97316", foreigner: "#3b82f6",
};

export default function SnippetsPage() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Snippet | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/agent/snippets").then(r => r.json()).then(d => {
      const all: Snippet[] = [];
      for (const items of Object.values(d.categories || {})) (items as Snippet[]).forEach(s => all.push(s));
      setSnippets(all);
    }).catch(() => {});
  }, []);

  const filtered = snippets.filter(s => {
    if (filter !== "all" && s.category !== filter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const r = await fetch("/api/agent/snippets", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: editing.key, text: editing.text }) });
    if (r.ok) {
      setMsg("✅ 保存しました");
      setSnippets(prev => prev.map(s => s.key === editing.key ? { ...s, text: editing.text, isCustomized: true } : s));
    } else setMsg("❌ エラー");
    setSaving(false);
    setTimeout(() => setMsg(""), 2000);
  };

  const categories = [...new Set(snippets.map(s => s.category))];

  return (
    <div style={{ padding: "20px 24px", maxWidth: 920, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>📝 定型文DB（{snippets.length}件）</h1>
      <p style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>
        Text Blazeから取り込んだ定型文。編集→保存でエージェントが使用する内容が更新されます。
        {msg && <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 700 }}>{msg}</span>}
      </p>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 検索..." style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 12, width: 200 }} />
        <button onClick={() => setFilter("all")} style={{ padding: "4px 10px", borderRadius: 14, border: filter === "all" ? "2px solid #d4a017" : "1px solid #ddd", background: filter === "all" ? "#fefce8" : "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>全て ({snippets.length})</button>
        {categories.map(c => {
          const count = snippets.filter(s => s.category === c).length;
          return <button key={c} onClick={() => setFilter(c)} style={{ padding: "4px 10px", borderRadius: 14, border: filter === c ? `2px solid ${CAT_COLORS[c] || "#888"}` : "1px solid #ddd", background: filter === c ? `${CAT_COLORS[c]}15` : "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer", color: CAT_COLORS[c] || "#555" }}>{CAT_LABELS[c] || c} ({count})</button>;
        })}
      </div>

      {/* Snippet list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map(s => (
          <div key={s.key} onClick={() => setEditing({ ...s })} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fff", border: editing?.key === s.key ? "2px solid #0891b2" : "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", cursor: "pointer", transition: ".15s" }}>
            <div style={{ minWidth: 70 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: CAT_COLORS[s.category] || "#888", background: `${CAT_COLORS[s.category] || "#888"}15`, padding: "1px 6px", borderRadius: 4 }}>{CAT_LABELS[s.category] || s.category}</span>
              {s.isCustomized && <span style={{ display: "block", fontSize: 8, color: "#d4a017", marginTop: 2 }}>✏️ 編集済</span>}
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{s.name}</div>
              <div style={{ fontSize: 10, color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.text.slice(0, 80)}</div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 40, fontSize: 13 }}>該当する定型文がありません</div>}
      </div>

      {/* Edit panel */}
      {editing && (
        <div style={{ position: "fixed", bottom: 0, left: 160, right: 0, background: "#111", borderTop: "2px solid #d4a017", padding: 16, zIndex: 50, maxHeight: "40vh", overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, maxWidth: 920, margin: "0 auto 8px" }}>
            <div>
              <span style={{ fontSize: 9, fontWeight: 700, color: CAT_COLORS[editing.category], background: `${CAT_COLORS[editing.category]}20`, padding: "1px 6px", borderRadius: 4, marginRight: 8 }}>{CAT_LABELS[editing.category]}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{editing.name}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={save} disabled={saving} style={{ background: "#d4a017", border: "none", color: "#fff", borderRadius: 6, padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{saving ? "保存中..." : "💾 保存"}</button>
              <button onClick={() => setEditing(null)} style={{ background: "none", border: "1px solid #444", color: "#999", borderRadius: 6, padding: "4px 12px", fontSize: 10, cursor: "pointer" }}>閉じる ×</button>
            </div>
          </div>
          <textarea
            value={editing.text}
            onChange={e => setEditing({ ...editing, text: e.target.value })}
            style={{ width: "100%", minHeight: 150, maxWidth: 920, display: "block", margin: "0 auto", background: "#0a0a0a", color: "#ddd", border: "1px solid #333", borderRadius: 8, padding: 10, fontSize: 11, fontFamily: "monospace", lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box" }}
          />
        </div>
      )}
    </div>
  );
}
