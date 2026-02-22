"use client";
import { useState, useEffect } from "react";
export default function BroadcastPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState("EMAIL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    fetch("/api/customers").then(r => r.json()).then(d => setCustomers(d.customers || []));
    fetch("/api/statuses").then(r => r.json()).then(setStatuses);
    fetch("/api/staff").then(r => r.json()).then(setStaffList);
  }, []);
  const filtered = customers.filter(c => {
    if (filterStatus && c.statusId !== filterStatus) return false;
    if (filterStaff && c.assigneeId !== filterStaff) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(c.name||"").toLowerCase().includes(q) && !(c.nameKana||"").toLowerCase().includes(q) && !(c.email||"").toLowerCase().includes(q) && !(c.phone||"").includes(q)) return false;
    }
    if (channel === "LINE" && !c.lineUserId) return false;
    if (channel === "EMAIL" && !c.email) return false;
    return true;
  });
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(c => c.id)));
  };
  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const handleSend = async () => {
    if (!selected.size || !body.trim()) return;
    setSending(true); setResult(null);
    try {
      const res = await fetch("/api/broadcast", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds: Array.from(selected), channel, subject, body }),
      });
      const d = await res.json();
      setResult(d);
      if (d.sent > 0) { setSelected(new Set()); setBody(""); setSubject(""); }
    } catch { setResult({ error: "\u901A\u4FE1\u30A8\u30E9\u30FC" }); }
    finally { setSending(false); }
  };
  const labelStyle = { fontSize: 12, fontWeight: 600 as const, color: "#374151", display: "block", marginBottom: 4 };
  const fieldStyle = { width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 5, outline: "none", boxSizing: "border-box" as const };
  return (
    <div style={{ padding: "24px 28px", height: "100%", overflow: "auto" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 20 }}>{"\u4E00\u6589\u9001\u4FE1"}</h1>
      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[{ v: "EMAIL", l: "\u2709\uFE0F \u30E1\u30FC\u30EB" }, { v: "LINE", l: "\uD83D\uDCAC LINE" }].map(ch => (
              <button key={ch.v} onClick={() => { setChannel(ch.v); setSelected(new Set()); }} style={{
                padding: "6px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 5, cursor: "pointer",
                background: channel === ch.v ? "#0891b2" : "#f3f4f6", color: channel === ch.v ? "#fff" : "#6b7280",
              }}>{ch.l}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...fieldStyle, flex: 1 }}>
              <option value="">{"\u5168\u30B9\u30C6\u30FC\u30BF\u30B9"}</option>
              {statuses.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} style={{ ...fieldStyle, flex: 1 }}>
              <option value="">{"\u5168\u62C5\u5F53\u8005"}</option>
              {staffList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={"\u691C\u7D22"} style={{ ...fieldStyle, flex: 1 }} />
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, maxHeight: 400, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", width: 30 }}>
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
                  </th>
                  <th style={{ padding: "8px 10px", textAlign: "left" }}>{"\u540D\u524D"}</th>
                  <th style={{ padding: "8px 10px", textAlign: "left" }}>{channel === "EMAIL" ? "\u30E1\u30FC\u30EB" : "LINE"}</th>
                  <th style={{ padding: "8px 10px", textAlign: "left" }}>{"\u30B9\u30C6\u30FC\u30BF\u30B9"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} onClick={() => toggle(c.id)} style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer", background: selected.has(c.id) ? "rgba(8,145,178,0.05)" : "#fff" }}>
                    <td style={{ padding: "6px 10px" }}><input type="checkbox" checked={selected.has(c.id)} readOnly /></td>
                    <td style={{ padding: "6px 10px", fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: "6px 10px", color: "#6b7280" }}>{channel === "EMAIL" ? c.email : (c.lineUserId ? "\u2705" : "-")}</td>
                    <td style={{ padding: "6px 10px" }}>{c.status?.name || "-"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>{"\u5BFE\u8C61\u306E\u9867\u5BA2\u304C\u3044\u307E\u305B\u3093"}</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>{"\u9078\u629E\u4E2D: "}{selected.size}{"\u4EF6"} / {"\u5BFE\u8C61: "}{filtered.length}{"\u4EF6"}</div>
        </div>
        <div style={{ width: 400 }}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 16, marginTop: 0 }}>{"\u9001\u4FE1\u5185\u5BB9"}</h3>
            {channel === "EMAIL" && (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{"\u4EF6\u540D"}</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder={"\u30E1\u30FC\u30EB\u306E\u4EF6\u540D"} style={fieldStyle} />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{"\u672C\u6587"}</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} placeholder={"\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u5165\u529B"} rows={10}
                style={{ ...fieldStyle, resize: "vertical" }} />
            </div>
            {result && (
              <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 6, fontSize: 12,
                background: result.error ? "#fef2f2" : "#f0fdf4", color: result.error ? "#dc2626" : "#16a34a",
                border: result.error ? "1px solid #fecaca" : "1px solid #bbf7d0",
              }}>
                {result.error ? result.error : `${"\u9001\u4FE1\u5B8C\u4E86: "}${result.sent}${"\u4EF6\u6210\u529F"}${result.failed > 0 ? ` / ${result.failed}${"\u4EF6\u5931\u6557"}` : ""}`}
              </div>
            )}
            <button onClick={handleSend} disabled={sending || !selected.size || !body.trim()} style={{
              width: "100%", padding: "10px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 6, cursor: sending || !selected.size || !body.trim() ? "not-allowed" : "pointer",
              background: sending || !selected.size || !body.trim() ? "#d1d5db" : "#0891b2", color: "#fff",
            }}>{sending ? `${"\u9001\u4FE1\u4E2D"}...` : `${selected.size}${"\u4EF6\u306B\u9001\u4FE1"}`}</button>
          </div>
        </div>
      </div>
    </div>
  );
}