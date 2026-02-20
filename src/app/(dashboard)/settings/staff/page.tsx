"use client";

import { useState, useEffect, useCallback } from "react";

export default function StaffSettingsPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/staff");
      if (res.ok) setStaff(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleCreate = async () => {
    if (!name || !email) { setError("名前とメールは必須です"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/staff", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });
      if (res.ok) {
        setName(""); setEmail(""); setRole("MEMBER"); setShowForm(false);
        fetchStaff();
      } else {
        const data = await res.json();
        setError(data.error || "作成に失敗しました");
      }
    } catch { setError("通信エラー"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
      <div style={{ maxWidth: 700 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>担当者管理</h2>
          <button onClick={() => setShowForm(!showForm)} style={{
            padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#fff",
            background: "#29B6F6", border: "none", borderRadius: 5, cursor: "pointer",
          }}>
            {showForm ? "キャンセル" : "+ 担当者追加"}
          </button>
        </div>
        {showForm && (
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
            padding: 16, marginBottom: 16,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>名前 *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="山田太郎"
                  style={{ width: "100%", padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 5, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>メールアドレス *</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yamada@example.com" type="email"
                  style={{ width: "100%", padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 5, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>権限</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}
                  style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 5, outline: "none" }}>
                  <option value="MEMBER">メンバー</option>
                  <option value="ADMIN">管理者</option>
                </select>
              </div>
              {error && <div style={{ fontSize: 12, color: "#DC2626" }}>{error}</div>}
              <button onClick={handleCreate} disabled={saving} style={{
                padding: "7px 20px", fontSize: 12, fontWeight: 600, color: "#fff",
                background: saving ? "#9ca3af" : "#29B6F6", border: "none", borderRadius: 5,
                cursor: saving ? "not-allowed" : "pointer", alignSelf: "flex-start",
              }}>
                {saving ? "作成中..." : "作成する"}
              </button>
            </div>
          </div>
        )}
        {/* Staff List */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12 }}>名前</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12 }}>メールアドレス</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 12 }}>権限</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>読み込み中...</td></tr>
              ) : staff.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>担当者がいません</td></tr>
              ) : staff.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 500 }}>{s.name}</td>
                  <td style={{ padding: "10px 14px", color: "#6b7280" }}>{s.email}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                      color: s.role === "ADMIN" ? "#DC2626" : "#2563eb",
                      background: s.role === "ADMIN" ? "#FEE2E2" : "#EFF6FF",
                    }}>
                      {s.role === "ADMIN" ? "管理者" : "メンバー"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}