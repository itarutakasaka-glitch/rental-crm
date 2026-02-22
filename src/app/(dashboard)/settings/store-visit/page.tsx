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

      {/* Toggle */}
      <div style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>{"\u6765\u5E97\u4E88\u7D04\u3092\u53EF\u80FD\u306B\u3059\u308B"}</span>
        <button onClick={() => { upd("enabled", !setting.enabled); setTimeout(() => handleSave("info"), 100); }}
          style={{ position: "relative", width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: setting.enabled ? "#0891b2" : "#d1d5db", transition: "background 0.2s" }}>
          <span style={{ position: "absolute", top: 2, left: setting.enabled ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
        </button>
      </div>

      {/* Booking URL */}
      {setting.enabled && bookingUrl && (
        <div style={{ ...S.card, background: "#fffbeb", borderColor: "#fde68a" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 6 }}>{"\u4E88\u7D04\u30D5\u30A9\u30FC\u30E0URL"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <code style={{ fontSize: 12, background: "#fff", padding: "6px 10px", borderRadius: 4, border: "1px solid #e5e7eb", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bookingUrl}</code>
            <button onClick={() => { navigator.clipboard.writeText(bookingUrl); setMessage("URL\u30B3\u30D4\u30FC\u6E08\u307F"); setTimeout(() => setMessage(""), 2000); }}
              style={{ ...S.saveBtn, padding: "6px 14px", fontSize: 12 }}>{"\u30B3\u30D4\u30FC"}</button>
          </div>
        </div>
      )}

      {/* お客様に表示する情報 */}
      <div style={S.card}>
        <div style={S.sectionHeader}>
          <span style={S.sectionTitle}>{"\u304A\u5BA2\u69D8\u306B\u8868\u793A\u3059\u308B\u60C5\u5831"}</span>
          <button style={S.pencil} onClick={() => setEditInfo(!editInfo)}>{"\u270F"}</button>
        </div>
        {!editInfo ? (
          <>
            <div style={S.label}>{"\u5B9A\u4F11\u65E5"}</div>
            <div style={S.value}>{setting.closedDays || "\u2014"}</div>
            <div style={S.label}>{"\u6765\u5E97\u4E88\u7D04\u53EF\u80FD\u6642\u9593"}</div>
            <div style={S.value}>{setting.availableTimeStart}\uFF5E{setting.availableTimeEnd}</div>
            <div style={S.label}>{"\u6765\u5E97\u65B9\u6CD5"}</div>
            <div style={S.value}>{setting.visitMethods ? setting.visitMethods.split(",").join("\u3001") : "\u2014"}</div>
            <div style={S.label}>{"\u5E97\u8217\u304B\u3089\u306E\u304A\u77E5\u3089\u305B"}</div>
            <div style={{ ...S.value, borderBottom: "none", whiteSpace: "pre-wrap" }}>{setting.storeNotice || "\u2014"}</div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={S.label}>{"\u5B9A\u4F11\u65E5"}</div>
              <input style={S.input} value={setting.closedDays} onChange={e => upd("closedDays", e.target.value)} placeholder={"\u4F8B: \u6C34\u66DC\u65E5"} />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={S.label}>{"\u958B\u59CB\u6642\u9593"}</div>
                <input type="time" style={S.input} value={setting.availableTimeStart} onChange={e => upd("availableTimeStart", e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={S.label}>{"\u7D42\u4E86\u6642\u9593"}</div>
                <input type="time" style={S.input} value={setting.availableTimeEnd} onChange={e => upd("availableTimeEnd", e.target.value)} />
              </div>
            </div>
            <div>
              <div style={S.label}>{"\u6765\u5E97\u65B9\u6CD5\uFF08\u30AB\u30F3\u30DE\u533A\u5207\u308A\uFF09"}</div>
              <input style={S.input} value={setting.visitMethods} onChange={e => upd("visitMethods", e.target.value)} placeholder={"\u4F8B: \u5E97\u8217\u3078\u6765\u5E97,\u30D3\u30C7\u30AA\u901A\u8A71,\u5185\u898B,\u305D\u306E\u4ED6"} />
            </div>
            <div>
              <div style={S.label}>{"\u5E97\u8217\u304B\u3089\u306E\u304A\u77E5\u3089\u305B"}</div>
              <textarea style={{ ...S.textarea, minHeight: 100 }} value={setting.storeNotice} onChange={e => upd("storeNotice", e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.cancelBtn} onClick={() => { setEditInfo(false); fetchSetting(); }}>{"\u30AD\u30E3\u30F3\u30BB\u30EB"}</button>
              <button style={S.saveBtn} disabled={saving} onClick={() => handleSave("info")}>{saving ? "\u4FDD\u5B58\u4E2D..." : "\u4FDD\u5B58"}</button>
            </div>
          </div>
        )}
      </div>

      {/* カスタム設問 */}
      <div style={S.card}>
        <div style={S.sectionHeader}>
          <span style={S.sectionTitle}>{"\u30AB\u30B9\u30BF\u30E0\u8A2D\u554F"}</span>
          <button style={{ ...S.saveBtn, padding: "6px 16px", fontSize: 12 }}>{"\u8A2D\u554F\u3092\u8FFD\u52A0"}</button>
        </div>
        <p style={{ fontSize: 13, color: "#9ca3af" }}>{"\u30AB\u30B9\u30BF\u30E0\u8A2D\u554F\u306F\u307E\u3060\u767B\u9332\u3055\u308C\u3066\u3044\u307E\u305B\u3093"}</p>
      </div>

      {/* 来店予約後の自動返信設定 */}
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
