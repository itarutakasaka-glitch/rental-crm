"use client";

import { useState } from "react";

interface Props {
  statuses: any[];
  staffList: any[];
  onClose: () => void;
  onCreated: () => void;
}

export function CustomerAddModal({ statuses, staffList, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [nameKana, setNameKana] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sourcePortal, setSourcePortal] = useState("");
  const [statusId, setStatusId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim()) { setError("名前は必須です"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/customers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), nameKana, email, phone, sourcePortal, statusId: statusId || undefined, assigneeId: assigneeId || undefined }),
      });
      if (res.ok) { onCreated(); onClose(); }
      else { const d = await res.json(); setError(d.error || "作成に失敗しました"); }
    } catch { setError("通信エラー"); }
    finally { setSaving(false); }
  };

  const fieldStyle = {
    width: "100%", padding: "7px 10px", fontSize: 13, border: "1px solid #d1d5db",
    borderRadius: 5, outline: "none", boxSizing: "border-box" as const,
  };
  const labelStyle = { fontSize: 12, fontWeight: 600 as const, color: "#374151", display: "block", marginBottom: 4 };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} />
      <div style={{
        position: "relative", width: 460, background: "#fff", borderRadius: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)", padding: "24px 28px", maxHeight: "90vh", overflow: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>顧客追加</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "#6b7280", cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>名前 <span style={{ color: "#DC2626" }}>*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="山田太郎" style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>フリガナ</label>
            <input value={nameKana} onChange={(e) => setNameKana(e.target.value)} placeholder="ヤマダタロウ" style={fieldStyle} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>メールアドレス</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yamada@example.com" type="email" style={fieldStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>電話番号</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="090-1234-5678" style={fieldStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>反響元</label>
            <select value={sourcePortal} onChange={(e) => setSourcePortal(e.target.value)} style={fieldStyle}>
              <option value="">選択してください</option>
              <option value="SUUMO">SUUMO</option>
              <option value="HOME'S">HOME&apos;S</option>
              <option value="アパマンショップ">アパマンショップ</option>
              <option value="LINE">LINE</option>
              <option value="電話">電話</option>
              <option value="来店">来店</option>
              <option value="その他">その他</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>ステータス</label>
              <select value={statusId} onChange={(e) => setStatusId(e.target.value)} style={fieldStyle}>
                <option value="">未設定</option>
                {statuses.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>担当者</label>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={fieldStyle}>
                <option value="">自分</option>
                {staffList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {error && <div style={{ fontSize: 12, color: "#DC2626", background: "#FEE2E2", padding: "6px 10px", borderRadius: 5 }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button onClick={onClose} style={{
              padding: "7px 18px", fontSize: 12, fontWeight: 600, border: "1px solid #d1d5db",
              borderRadius: 5, background: "#fff", color: "#374151", cursor: "pointer",
            }}>キャンセル</button>
            <button onClick={handleSave} disabled={saving} style={{
              padding: "7px 20px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 5,
              background: saving ? "#9ca3af" : "#D97706", color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
            }}>{saving ? "作成中..." : "作成する"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}