"use client";

import { useState, useEffect, useRef } from "react";
import { CyberpunkSpinner } from "@/components/ui/cyberpunk-spinner";

const VARS = [
  { label: "{{customer_name}}", desc: "\u9867\u5BA2\u540D" },
  { label: "{{customer_email}}", desc: "\u30E1\u30FC\u30EB" },
  { label: "{{customer_phone}}", desc: "\u96FB\u8A71" },
  { label: "{{staff_name}}", desc: "\u62C5\u5F53\u8005" },
  { label: "{{store_name}}", desc: "\u5E97\u8217\u540D" },
  { label: "{{store_address}}", desc: "\u4F4F\u6240" },
  { label: "{{store_phone}}", desc: "\u5E97\u8217\u96FB\u8A71" },
  { label: "{{property_name}}", desc: "\u7269\u4EF6\u540D" },
  { label: "{{line_url}}", desc: "LINE URL" },
  { label: "{{visit_url}}", desc: "\u4E88\u7D04URL" },
  { label: "{{license_number}}", desc: "\u514D\u8A31\u756A\u53F7" },
  { label: "{{source_portal}}", desc: "\u53CD\u97FF\u5143\u30DD\u30FC\u30BF\u30EB" },
];

export default function HankyoSettingPage() {
  const inboundEmail = "crm@moutrenoi.resend.app";
  const [copied, setCopied] = useState(false);
  const [autoReply, setAutoReply] = useState(false);
  const [template, setTemplate] = useState("");
  const [subject, setSubject] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/settings/hankyo")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setAutoReply(d.autoReplyEnabled ?? false);
          setTemplate(d.autoReplyTemplate ?? "");
          setSubject(d.autoReplySubject ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copyEmail = () => {
    navigator.clipboard.writeText(inboundEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/hankyo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoReplyEnabled: autoReply, autoReplyTemplate: template, autoReplySubject: subject }),
      });
      if (res.ok) setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const insertVar = (label: string, target: "subject" | "body") => {
    if (target === "subject") {
      const el = subjectRef.current;
      if (!el) return;
      const s = el.selectionStart || 0;
      const e = el.selectionEnd || 0;
      const nv = subject.slice(0, s) + label + subject.slice(e);
      setSubject(nv);
      setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = s + label.length; }, 0);
    } else {
      const el = bodyRef.current;
      if (!el) return;
      const s = el.selectionStart || 0;
      const e = el.selectionEnd || 0;
      const nv = template.slice(0, s) + label + template.slice(e);
      setTemplate(nv);
      setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = s + label.length; }, 0);
    }
  };

  const btnStyle: React.CSSProperties = { padding: "2px 8px", fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 4, background: "#f9fafb", color: "#6b7280", cursor: "pointer" };

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><CyberpunkSpinner size={36} /></div>;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 800 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 32, color: "#111" }}>
        {"\u53CD\u97FF\u8A2D\u5B9A"}
      </h1>

      {/* INBOUND EMAIL */}
      <section style={{ marginBottom: 32 }}>
        <label style={{ fontSize: 13, color: "#6b7280", display: "block", marginBottom: 8 }}>
          {"\u53CD\u97FF\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\uFF1F"}
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #e5e7eb", borderRadius: 6, padding: "10px 12px", background: "#fff" }}>
          <span style={{ flex: 1, fontSize: 14, color: "#111" }}>{inboundEmail}</span>
          <button onClick={copyEmail} style={{ padding: "4px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", cursor: "pointer", color: "#374151" }}>
            {copied ? "\u2713 Copied" : "\uD83D\uDCCB"}
          </button>
        </div>
        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
          {"\u30DD\u30FC\u30BF\u30EB\u30B5\u30A4\u30C8\uFF08SUUMO/\u30A2\u30D1\u30DE\u30F3/HOME\u2019S\uFF09\u306E\u554F\u5408\u305B\u8EE2\u9001\u5148\u306B\u3053\u306E\u30A2\u30C9\u30EC\u30B9\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044"}
        </p>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "24px 0" }} />

      {/* TOGGLE */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 12 }}>
          {"\u521D\u56DE\u53CD\u97FF\u53D6\u308A\u8FBC\u307F\u5F8C\u306E\u81EA\u52D5\u8FD4\u4FE1\u8A2D\u5B9A"}
        </h2>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#374151" }}>
            {"\u521D\u56DE\u53CD\u97FF\u30E1\u30FC\u30EB\u6642\u306B\u81EA\u52D5\u3067\u8FD4\u4FE1\u3059\u308B"}
          </span>
          <button onClick={() => setAutoReply(!autoReply)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: autoReply ? "#0891b2" : "#d1d5db", position: "relative", transition: "background 0.2s" }}>
            <span style={{ position: "absolute", top: 2, left: autoReply ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </button>
        </div>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "24px 0" }} />

      {/* TEMPLATE */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>
            {"\u81EA\u52D5\u8FD4\u4FE1\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8"}
          </h2>
          <button onClick={() => setEditing(!editing)} style={{ padding: "4px 12px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", cursor: "pointer", color: "#374151" }}>
            {editing ? "\u30AD\u30E3\u30F3\u30BB\u30EB" : "\u2710 \u7DE8\u96C6"}
          </button>
        </div>

        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>{"\u4EF6\u540D"}</label>
              <input ref={subjectRef} value={subject} onChange={(e) => setSubject(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, outline: "none" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>{"\u672C\u6587"}</label>
              <textarea ref={bodyRef} value={template} onChange={(e) => setTemplate(e.target.value)}
                rows={8}
                style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, outline: "none", resize: "vertical", lineHeight: 1.7 }}
              />
            </div>

            {/* Variable buttons */}
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>{"\u5909\u6570\u3092\u633F\u5165"}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {VARS.map((v) => (
                  <button key={v.label} onClick={() => insertVar(v.label, "body")} style={btnStyle} title={v.label}>
                    {v.desc}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveSettings} disabled={saving} style={{ padding: "8px 24px", fontSize: 13, fontWeight: 600, background: "#d4a017", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "\u4FDD\u5B58\u4E2D..." : "\u4FDD\u5B58"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px", background: "#fafafa", fontSize: 13, lineHeight: 1.8, color: "#374151", whiteSpace: "pre-wrap" }}>
            {subject && <div style={{ fontWeight: 600, marginBottom: 12 }}>{"\u3010\u4EF6\u540D: "}{subject}{"\u3011"}</div>}
            {template || <span style={{ color: "#9ca3af" }}>{"\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u304C\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u300C\u7DE8\u96C6\u300D\u30DC\u30BF\u30F3\u304B\u3089\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}</span>}
          </div>
        )}
      </section>
    </div>
  );
}