"use client";

import { useState, useEffect } from "react";
import { CyberpunkSpinner } from "@/components/ui/cyberpunk-spinner";

interface Setting {
  id: string;
  enabled: boolean;
  closedDays: string;
  availableTimeStart: string;
  availableTimeEnd: string;
  visitMethods: string;
  storeNotice: string;
  autoReplySubject: string;
  autoReplyBody: string;
}

export default function StoreVisitSettingPage() {
  const [setting, setSetting] = useState<Setting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [orgId, setOrgId] = useState("");
  const [editInfo, setEditInfo] = useState(false);
  const [editReply, setEditReply] = useState(false);

  useEffect(() => { fetchSetting(); fetchOrgId(); }, []);

  async function fetchOrgId() {
    try { const res = await fetch("/api/organization"); const data = await res.json(); if (data.id) setOrgId(data.id); } catch {}
  }

  async function fetchSetting() {
    try { const res = await fetch("/api/store-visit-settings"); const data = await res.json(); setSetting(data); } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleSave(section: "info" | "reply") {
    if (!setting) return;
    setSaving(true); setMessage("");
    try {
      const res = await fetch("/api/store-visit-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(setting) });
      if (res.ok) { setMessage("\u4FDD\u5B58\u3057\u307E\u3057\u305F"); setTimeout(() => setMessage(""), 3000); if (section === "info") setEditInfo(false); else setEditReply(false); }
    } catch { setMessage("\u4FDD\u5B58\u306B\u5931\u6557"); } finally { setSaving(false); }
  }

  function upd<K extends keyof Setting>(key: K, value: Setting[K]) { setSetting(prev => prev ? { ...prev, [key]: value } : prev); }

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><CyberpunkSpinner size={40} /></div>;
  if (!setting) return <div style={{ padding: 40, color: "#dc2626" }}>{"\u8A2D\u5B9A\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557"}</div>;

  const bookingUrl = orgId ? `${typeof window !== "undefined" ? window.location.origin : ""}/visit/${orgId}` : "";

  const S = {
    page: { padding: "24px 32px", maxWidth: 720, overflow: "auto" as const, height: "100%" } as React.CSSProperties,
    title: { fontSize: 18, fontWeight: 700, marginBottom: 24, color: "#1f2937" } as React.CSSProperties,
    card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px", marginBottom: 20 } as React.CSSProperties,
    sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } as React.CSSProperties,
    sectionTitle: { fontSize: 15, fontWeight: 700, color: "#1f2937" } as React.CSSProperties,
    pencil: { background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#9ca3af", padding: 4 } as React.CSSProperties,
    label: { fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 } as React.CSSProperties,
    value: { fontSize: 14, color: "#1f2937", paddingBottom: 12, borderBottom: "1px solid #f3f4f6", marginBottom: 12 } as React.CSSProperties,
    input: { width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 12px", fontSize: 13, outline: "none" } as React.CSSProperties,
    textarea: { width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 12px", fontSize: 13, outline: "none", resize: "vertical" as const, fontFamily: "inherit" } as React.CSSProperties,
    saveBtn: { padding: "8px 24px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 6, cursor: "pointer", color: "#fff", background: "#0891b2" } as React.CSSProperties,
    cancelBtn: { padding: "8px 24px", fontSize: 13, fontWeight: 600, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", color: "#6b7280", background: "#fff" } as React.CSSProperties,
    replyPreview: { background: "#e0f7fa", borderRadius: 8, padding: "16px 20px", fontSize: 13, lineHeight: 1.8, color: "#1f2937", whiteSpace: "pre-wrap" as const } as React.CSSProperties,
  };

  return (
    <div style={S.page}>
      <h1 style={S.title}>{"\u6765\u5E97\u4E88\u7D04"}</h1>

      {/* custom questions hidden */}

      {/* 隴夲ｽ･陟主ｶｺ・ｺ閧ｲ・ｴ繝ｻ・ｾ蠕後・髢ｾ・ｪ陷肴・・ｿ豈費ｽｿ・｡髫ｪ・ｭ陞ｳ繝ｻ*/}
      <div style={S.card}>
        <div style={S.sectionHeader}>
          <span style={S.sectionTitle}>{"\u6765\u5E97\u4E88\u7D04\u5F8C\u306E\u81EA\u52D5\u8FD4\u4FE1\u8A2D\u5B9A"}</span>
          <button style={S.pencil} onClick={() => setEditReply(!editReply)}>{"\u270F"}</button>
        </div>
        {!editReply ? (
          <div style={S.replyPreview}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{"\u3010\u4EF6\u540D: "}{setting.autoReplySubject || "\u2014"}{"\u3011"}</div>
            {setting.autoReplyBody || "\u81EA\u52D5\u8FD4\u4FE1\u672A\u8A2D\u5B9A"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={S.label}>{"\u4EF6\u540D"}</div>
              <input style={S.input} value={setting.autoReplySubject} onChange={e => upd("autoReplySubject", e.target.value)} />
            </div>
            <div>
              <div style={S.label}>{"\u672C\u6587"}</div>
              <textarea style={{ ...S.textarea, minHeight: 200, fontFamily: "monospace" }} value={setting.autoReplyBody} onChange={e => upd("autoReplyBody", e.target.value)} />
            </div>
            <div style={{ background: "#f9fafb", borderRadius: 6, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 4 }}>{"\u5229\u7528\u53EF\u80FD\u306A\u5909\u6570:"}</div>
              <div style={{ fontSize: 11, color: "#b0b0b0" }}>{"{{customer_name}} {{store_name}} {{store_address}} {{store_phone}} {{visit_date}} {{visit_time}} {{visit_method}} {{visit_url}} {{line_url}}"}</div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.cancelBtn} onClick={() => { setEditReply(false); fetchSetting(); }}>{"\u30AD\u30E3\u30F3\u30BB\u30EB"}</button>
              <button style={S.saveBtn} disabled={saving} onClick={() => handleSave("reply")}>{saving ? "\u4FDD\u5B58\u4E2D..." : "\u4FDD\u5B58"}</button>
            </div>
          </div>
        )}
      </div>

      {message && <div style={{ position: "fixed", bottom: 20, right: 20, background: "#065f46", color: "#fff", padding: "10px 20px", borderRadius: 8, fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>{message}</div>}
    </div>
  );
}
