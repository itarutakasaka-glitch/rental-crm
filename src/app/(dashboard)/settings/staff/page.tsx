"use client";

import { useState, useEffect, useCallback } from "react";

export default function StaffSettingsPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "MEMBER", avatarUrl: "" });
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

  const resetForm = () => { setForm({ name: "", email: "", role: "MEMBER", avatarUrl: "" }); setError(""); };

  const startAdd = () => { resetForm(); setEditId(null); setShowAdd(true); };
  const startEdit = (s: any) => {
    setForm({ name: s.name, email: s.email, role: s.role, avatarUrl: s.avatarUrl || "" });
    setEditId(s.id); setShowAdd(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError("名前とメールは必須です"); return; }
    setSaving(true); setError("");
    try {
      const isEdit = !!editId;
      const res = await fetch("/api/staff", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: editId, ...form } : form),
      });
      if (res.ok) { setShowAdd(false); resetForm(); setEditId(null); fetchStaff(); }
      else { const d = await res.json(); setError(d.error || "保存に失敗しました"); }
    } catch { setError("通信エラー"); }
    finally { setSaving(false); }
  };

  const f = (label: string, key: string, type = "text", placeholder = "") => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 3 }}>{label}</label>
      <input value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} type={type} placeholder={placeholder}
        style={{ width: "100%", padding: "7px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 5, outline: "none", boxSizing: "border-box" }} />
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>担当者管理</h2>
        <button onClick={startAdd} style={{
          padding: "6px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 5,
          background: "#29B6F6", color: "#fff", cursor: "pointer",
        }}>+ 担当者追加</button>
      </div>

      {showAdd && (
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 20,
          maxWidth: 500,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 12 }}>
            {editId ? "担当者を編集" : "新規担当者"}
          </h3>
          {f("名前", "name", "text", "山田太郎")}
          {f("メールアドレス", "email", "email", "yamada@example.com")}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 3 }}>権限</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              style={{ width: "100%", padding: "7px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 5, boxSizing: "border-box" }}>
              <option value="MEMBER">メンバー</option>
              <option value="ADMIN">管理者</option>
            </select>
          </div>
          {f("アバター画像URL", "avatarUrl", "url", "https://example.com/photo.jpg")}
          {form.avatarUrl && (
            <div style={{ marginBottom: 10 }}>
              <img src={form.avatarUrl} alt="preview" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "1px solid #e5e7eb" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
          {error && <div style={{ fontSize: 12, color: "#DC2626", background: "#FEE2E2", padding: "6px 10px", borderRadius: 5, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{
              padding: "6px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 5,
              background: saving ? "#9ca3af" : "#29B6F6", color: "#fff", cursor: saving ? "not-allowed" : "pointer",
            }}>{saving ? "保存中..." : "保存"}</button>
            <button onClick={() => { setShowAdd(false); resetForm(); setEditId(null); }} style={{
              padding: "6px 16px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 5,
              background: "#fff", color: "#374151", cursor: "pointer",
            }}>キャンセル</button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 11 }}>アバター</th>
              <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 11 }}>名前</th>
              <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 11 }}>メールアドレス</th>
              <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 11 }}>権限</th>
              <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 11 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>読み込み中...</td></tr>
            ) : staff.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "8px 14px" }}>
                  {s.avatarUrl ? (
                    <img src={s.avatarUrl} alt={s.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", background: "#E3F2FD",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: "#1976D2",
                    }}>{s.name.charAt(0)}</div>
                  )}
                </td>
                <td style={{ padding: "8px 14px", fontWeight: 600 }}>{s.name}</td>
                <td style={{ padding: "8px 14px", color: "#6b7280" }}>{s.email}</td>
                <td style={{ padding: "8px 14px" }}>
                  <span style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                    background: s.role === "ADMIN" ? "#FEE2E2" : "#EFF6FF",
                    color: s.role === "ADMIN" ? "#DC2626" : "#2563eb",
                  }}>{s.role === "ADMIN" ? "管理者" : "メンバー"}</span>
                </td>
                <td style={{ padding: "8px 14px" }}>
                  <button onClick={() => startEdit(s)} style={{
                    padding: "3px 10px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4,
                    background: "#fff", color: "#374151", cursor: "pointer",
                  }}>編集</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}