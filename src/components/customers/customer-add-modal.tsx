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
    if (!name.trim()) { setError("\u540D\u524D\u306F\u5FC5\u9808\u3067\u3059"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/customers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), nameKana, email, phone, sourcePortal, statusId: statusId || undefined, assigneeId: assigneeId || undefined }),
      });
      if (res.ok) { onCreated(); onClose(); }
      else { const d = await res.json(); setError(d.error || "\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F"); }
    } catch { setError("\u901A\u4FE1\u30A8\u30E9\u30FC"); }
    finally { setSaving(false); }
  };
  const fieldStyle = {
    width: "100%", padding: "7px 10px", fontSize: 13, border: "1px solid #d1d5db",
    borderRadius: 5, outline: "none", boxSizing: "border-box" as const,
  };
  const labelStyle = { fontSize: 12, fontWeight: 600 as const, color: "#374151", display: "block", marginBottom: 4 };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} />
      <div style={{ position: "relative", width: 460, background: "#fff", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", padding: "24px 28px", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>{"\u9867\u5BA2\u8FFD\u52A0"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "#6b7280", cursor: "pointer" }}>{"\u2715"}</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>{"\u540D\u524D"} <span style={{ color: "#DC2626" }}>*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={"\u5C71\u7530 \u592A\u90CE"} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>{"\u30D5\u30EA\u30AC\u30CA"}</label>
            <input value={nameKana} onChange={(e) => setNameKana(e.target.value)} placeholder={"\u30E4\u30DE\u30C0 \u30BF\u30ED\u30A6"} style={fieldStyle} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{"\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9"}</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="yamada@example.com" type="email" style={fieldStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{"\u96FB\u8A71\u756A\u53F7"}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="090-1234-5678" style={fieldStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>{"\u53CD\u97FF\u5143"}</label>
            <select value={sourcePortal} onChange={(e) => setSourcePortal(e.target.value)} style={fieldStyle}>
              <option value="">{"\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044"}</option>
              <option value="SUUMO">SUUMO</option>
              <option value="HOME'S">HOME&apos;S</option>
              <option value={"\u30A2\u30D1\u30DE\u30F3\u30B7\u30E7\u30C3\u30D7"}>{"\u30A2\u30D1\u30DE\u30F3\u30B7\u30E7\u30C3\u30D7"}</option>
              <option value="LINE">LINE</option>
              <option value={"\u96FB\u8A71"}>{"\u96FB\u8A71"}</option>
              <option value={"\u6765\u5E97"}>{"\u6765\u5E97"}</option>
              <option value={"\u305D\u306E\u4ED6"}>{"\u305D\u306E\u4ED6"}</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{"\u30B9\u30C6\u30FC\u30BF\u30B9"}</label>
              <select value={statusId} onChange={(e) => setStatusId(e.target.value)} style={fieldStyle}>
                <option value="">{"\u672A\u8A2D\u5B9A"}</option>
                {statuses.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{"\u62C5\u5F53\u8005"}</label>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={fieldStyle}>
                <option value="">{"\u81EA\u52D5"}</option>
                {staffList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {error && <div style={{ fontSize: 12, color: "#DC2626", background: "#FEE2E2", padding: "6px 10px", borderRadius: 5 }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button onClick={onClose} style={{ padding: "7px 18px", fontSize: 12, fontWeight: 600, border: "1px solid #d1d5db", borderRadius: 5, background: "#fff", color: "#374151", cursor: "pointer" }}>{"\u30AD\u30E3\u30F3\u30BB\u30EB"}</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: "7px 20px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 5, background: saving ? "#9ca3af" : "#0891b2", color: "#fff", cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "\u4F5C\u6210\u4E2D..." : "\u4F5C\u6210\u3059\u308B"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}