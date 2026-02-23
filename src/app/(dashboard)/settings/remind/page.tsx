"use client";

import { useState, useEffect, useCallback } from "react";

type Reminder = {
  id: string;
  channel: string;
  timing: string;
  timingHour: string;
  subject: string | null;
  body: string;
  skipLineNotAdded: boolean;
  order: number;
};

const CHANNEL_OPTIONS = [
  { value: "EMAIL", label: "\u30E1\u30FC\u30EB" },
  { value: "LINE", label: "LINE" },
  { value: "SMS", label: "SMS" },
];

const TIMING_OPTIONS = [
  { value: "3_days_before", label: "3\u65E5\u524D" },
  { value: "2_days_before", label: "2\u65E5\u524D" },
  { value: "1_day_before", label: "1\u65E5\u524D" },
  { value: "same_day", label: "\u5F53\u65E5" },
  { value: "1_hour_before", label: "1\u6642\u9593\u524D" },
  { value: "2_hours_before", label: "2\u6642\u9593\u524D" },
];

const TIMING_LABELS: Record<string, string> = {
  "3_days_before": "\u6765\u5E97\u4E88\u5B9A\u306E3\u65E5\u524D",
  "2_days_before": "\u6765\u5E97\u4E88\u5B9A\u306E2\u65E5\u524D",
  "1_day_before": "\u6765\u5E97\u4E88\u5B9A\u306E1\u65E5\u524D",
  "same_day": "\u6765\u5E97\u4E88\u5B9A\u306E\u5F53\u65E5",
  "1_hour_before": "\u6765\u5E97\u4E88\u5B9A\u306E1\u6642\u9593\u524D",
  "2_hours_before": "\u6765\u5E97\u4E88\u5B9A\u306E2\u6642\u9593\u524D",
};

export default function ReminderSettingsPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Reminder>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newForm, setNewForm] = useState<Partial<Reminder>>({
    channel: "EMAIL",
    timing: "1_day_before",
    timingHour: "10:00",
    subject: "",
    body: "",
    skipLineNotAdded: false,
  });

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch("/api/reminders");
      if (res.ok) {
        const data = await res.json();
        setReminders(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to fetch reminders:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleAdd = async () => {
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      if (res.ok) {
        setShowAddForm(false);
        setNewForm({ channel: "EMAIL", timing: "1_day_before", timingHour: "10:00", subject: "", body: "", skipLineNotAdded: false });
        fetchReminders();
      }
    } catch (e) {
      console.error("Failed to add reminder:", e);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const res = await fetch("/api/reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editForm }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditForm({});
        fetchReminders();
      }
    } catch (e) {
      console.error("Failed to update reminder:", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("\u3053\u306E\u30EA\u30DE\u30A4\u30F3\u30C9\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F")) return;
    try {
      const res = await fetch(`/api/reminders?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchReminders();
    } catch (e) {
      console.error("Failed to delete reminder:", e);
    }
  };

  const startEdit = (r: Reminder) => {
    setEditingId(r.id);
    setEditForm({ channel: r.channel, timing: r.timing, timingHour: r.timingHour, subject: r.subject, body: r.body, skipLineNotAdded: r.skipLineNotAdded });
  };

  const selectStyle: React.CSSProperties = { padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", color: "#374151", outline: "none" };
  const inputStyle: React.CSSProperties = { ...selectStyle, width: "100%" };
  const btnPrimary: React.CSSProperties = { padding: "7px 20px", fontSize: 13, fontWeight: 600, background: "#d4a017", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
  const btnSecondary: React.CSSProperties = { padding: "7px 16px", fontSize: 13, fontWeight: 500, background: "#fff", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" };
  const btnDanger: React.CSSProperties = { padding: "5px 12px", fontSize: 12, fontWeight: 500, background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer" };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #e5e7eb", borderTopColor: "#d4a017", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 960 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>
          {"\u30EA\u30DE\u30A4\u30F3\u30C9\u8A2D\u5B9A"}
        </h1>
      </div>

      {/* Section */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        {/* Section header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#374151", margin: 0 }}>
            {"\u6765\u5E97\u4E88\u5B9A\u304C\u3042\u308B\u9867\u5BA2\u3078\u306E\u30EA\u30DE\u30A4\u30F3\u30C9\u8A2D\u5B9A"}
          </h2>
          <button onClick={() => setShowAddForm(true)} style={btnPrimary}>
            {"\u30EA\u30DE\u30A4\u30F3\u30C9\u8FFD\u52A0"}
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", background: "rgba(212,160,23,0.04)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>{"\u30EA\u30DE\u30A4\u30F3\u30C9\u65B9\u6CD5"}</label>
                <select value={newForm.channel} onChange={(e) => setNewForm({ ...newForm, channel: e.target.value })} style={selectStyle}>
                  {CHANNEL_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>{"\u30BF\u30A4\u30DF\u30F3\u30B0"}</label>
                <select value={newForm.timing} onChange={(e) => setNewForm({ ...newForm, timing: e.target.value })} style={selectStyle}>
                  {TIMING_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>{"\u9001\u4FE1\u6642\u523B"}</label>
                <input type="time" value={newForm.timingHour} onChange={(e) => setNewForm({ ...newForm, timingHour: e.target.value })} style={selectStyle} />
              </div>
            </div>
            {newForm.channel === "EMAIL" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>{"\u4EF6\u540D"}</label>
                <input type="text" value={newForm.subject || ""} onChange={(e) => setNewForm({ ...newForm, subject: e.target.value })} placeholder={"\u30EA\u30DE\u30A4\u30F3\u30C9\u30E1\u30FC\u30EBu306E\u4EF6\u540D"} style={inputStyle} />
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>{"\u672C\u6587"}</label>
              <textarea value={newForm.body || ""} onChange={(e) => setNewForm({ ...newForm, body: e.target.value })} placeholder={"\u30EA\u30DE\u30A4\u30F3\u30C9\u30E1\u30C3\u30BB\u30FC\u30B8\u306E\u672C\u6587"} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            {(newForm.channel === "LINE" || newForm.channel === "SMS") && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151", cursor: "pointer" }}>
                  <input type="checkbox" checked={newForm.skipLineNotAdded || false} onChange={(e) => setNewForm({ ...newForm, skipLineNotAdded: e.target.checked })} style={{ width: 16, height: 16, accentColor: "#d4a017" }} />
                  {"LINE\u672A\u8FFD\u52A0\u306E\u9867\u5BA2\u306F\u30B9\u30AD\u30C3\u30D7\u3059\u308B"}
                </label>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAddForm(false)} style={btnSecondary}>{"\u30AD\u30E3\u30F3\u30BB\u30EB"}</button>
              <button onClick={handleAdd} style={btnPrimary}>{"\u8FFD\u52A0"}</button>
            </div>
          </div>
        )}

        {/* Table */}
        {reminders.length === 0 && !showAddForm ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            {"\u30EA\u30DE\u30A4\u30F3\u30C9\u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u300C\u30EA\u30DE\u30A4\u30F3\u30C9\u8FFD\u52A0\u300D\u304B\u3089\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["\u30EA\u30DE\u30A4\u30F3\u30C9\u65B9\u6CD5", "\u30BF\u30A4\u30DF\u30F3\u30B0", "\u9001\u4FE1\u6642\u523B", "\u5185\u5BB9", ""].map((h, i) => (
                  <th key={i} style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "#6b7280", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reminders.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6", background: editingId === r.id ? "rgba(212,160,23,0.04)" : "#fff" }}>
                  {editingId === r.id ? (
                    <>
                      <td style={{ padding: "12px 16px" }}>
                        <select value={editForm.channel} onChange={(e) => setEditForm({ ...editForm, channel: e.target.value })} style={selectStyle}>
                          {CHANNEL_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                        </select>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <select value={editForm.timing} onChange={(e) => setEditForm({ ...editForm, timing: e.target.value })} style={selectStyle}>
                          {TIMING_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                        </select>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <input type="time" value={editForm.timingHour} onChange={(e) => setEditForm({ ...editForm, timingHour: e.target.value })} style={selectStyle} />
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <textarea value={editForm.body || ""} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} rows={2} style={{ ...inputStyle, fontSize: 12 }} />
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => handleUpdate(r.id)} style={btnPrimary}>{"\u4FDD\u5B58"}</button>
                          <button onClick={() => { setEditingId(null); setEditForm({}); }} style={btnSecondary}>{"\u53D6\u6D88"}</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ display: "inline-block", padding: "3px 10px", fontSize: 12, fontWeight: 600, borderRadius: 4, background: r.channel === "EMAIL" ? "rgba(8,145,178,0.1)" : r.channel === "LINE" ? "rgba(6,199,85,0.1)" : "rgba(212,160,23,0.1)", color: r.channel === "EMAIL" ? "#0891b2" : r.channel === "LINE" ? "#06c755" : "#d4a017" }}>
                          {CHANNEL_OPTIONS.find((o) => o.value === r.channel)?.label || r.channel}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>
                        {TIMING_LABELS[r.timing] || r.timing}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>
                        {r.timingHour}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "#6b7280", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.subject ? `[${r.subject}] ` : ""}
                        {r.body || "\u2014"}
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => startEdit(r)} style={btnSecondary}>{"\u7DE8\u96C6"}</button>
                          <button onClick={() => handleDelete(r.id)} style={btnDanger}>{"\u524A\u9664"}</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Help text */}
      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 16 }}>
        {"\u203B \u6765\u5E97\u4E88\u7D04\u304C\u78BA\u5B9A\u3057\u305F\u9867\u5BA2\u306B\u5BFE\u3057\u3066\u3001\u8A2D\u5B9A\u3057\u305F\u30BF\u30A4\u30DF\u30F3\u30B0\u3067\u81EA\u52D5\u7684\u306B\u30EA\u30DE\u30A4\u30F3\u30C9\u3092\u9001\u4FE1\u3057\u307E\u3059\u3002"}
      </p>
    </div>
  );
}
