"use client";

import { useState, useEffect, useRef, useCallback } from "react";

function fmtDate(d) {
  const o = new Date(d);
  return o.getFullYear() + "/" + String(o.getMonth()+1).padStart(2,"0") + "/" + String(o.getDate()).padStart(2,"0") + " " + String(o.getHours()).padStart(2,"0") + ":" + String(o.getMinutes()).padStart(2,"0");
}

function Spinner({ size = 16, color = "#14b8a6" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" fill="none" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function StatusDropdown({ currentStatusId, statuses, onSwitch, loading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cur = statuses.find((s) => s.id === currentStatusId);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px",
        fontSize: 11, fontWeight: 600, color: cur?.color || "#6b7280",
        backgroundColor: (cur?.color || "#6b7280") + "15",
        border: "1px solid " + (cur?.color || "#6b7280") + "30",
        borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
      }}>
        {loading && <Spinner size={10} color={cur?.color} />}
        {cur?.name || "不明"}
        <span style={{ fontSize: 7, marginLeft: 2, opacity: 0.6 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 9999, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 3, marginTop: 2, minWidth: 130 }}>
          {statuses.map((s) => (
            <button key={s.id} onClick={() => { onSwitch(s.id); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "5px 8px", border: "none", borderRadius: 4, background: currentStatusId === s.id ? s.color + "15" : "transparent", cursor: "pointer", fontSize: 11, color: "#1f2937" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomerDetailPanel({ customerId, statuses, staffList, onClose, onUpdated }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  const fetchCustomer = useCallback(async () => {
    try {
      const res = await fetch("/api/customers/" + customerId);
      if (res.ok) setCustomer(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { setLoading(true); setComposing(false); fetchCustomer(); }, [fetchCustomer]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [customer?.messages]);

  const patchCustomer = async (data) => {
    const res = await fetch("/api/customers/" + customerId, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Update failed");
    return res.json();
  };

  const handleStatusSwitch = async (newStatusId) => {
    if (!customer) return;
    const prev = customer.statusId;
    setCustomer((c) => c ? { ...c, statusId: newStatusId, status: statuses.find((s) => s.id === newStatusId) || c.status } : c);
    setStatusLoading(true);
    try { await patchCustomer({ statusId: newStatusId }); onUpdated?.(); }
    catch { setCustomer((c) => c ? { ...c, statusId: prev } : c); }
    finally { setStatusLoading(false); }
  };

  const handleToggleAction = async () => {
    if (!customer) return;
    const prev = customer.isNeedAction;
    setCustomer((c) => c ? { ...c, isNeedAction: !prev } : c);
    setActionLoading(true);
    try { await patchCustomer({ isNeedAction: !prev }); onUpdated?.(); }
    catch { setCustomer((c) => c ? { ...c, isNeedAction: prev } : c); }
    finally { setActionLoading(false); }
  };

  const handleAssigneeChange = async (newId) => {
    if (!customer) return;
    const prevId = customer.assigneeId;
    setCustomer((c) => c ? { ...c, assigneeId: newId || null, assignee: staffList.find((s) => s.id === newId) || null } : c);
    try { await patchCustomer({ assigneeId: newId || null }); onUpdated?.(); }
    catch { setCustomer((c) => c ? { ...c, assigneeId: prevId } : c); }
  };

  const handleSendEmail = async () => {
    if (!body.trim() || !customer?.email) return;
    setSending(true);
    try {
      const res = await fetch("/api/send-message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, channel: "EMAIL", subject, body, to: customer.email }),
      });
      if (res.ok) {
        setCustomer((c) => c ? { ...c, isNeedAction: false } : c);
        setComposing(false); setSubject(""); setBody("");
        fetchCustomer(); onUpdated?.();
      }
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  if (loading) {
    return (<div style={{ width: 520, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderLeft: "1px solid #d1d5db", background: "#fff", gap: 10 }}>
      <Spinner size={28} /><span style={{ fontSize: 13, color: "#6b7280" }}>読み込み中...</span>
    </div>);
  }
  if (!customer) {
    return (<div style={{ width: 520, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderLeft: "1px solid #d1d5db", background: "#fff", color: "#9ca3af", fontSize: 13 }}>顧客が見つかりません</div>);
  }

  return (
    <div style={{ width: 520, flexShrink: 0, display: "flex", flexDirection: "column", borderLeft: "1px solid #d1d5db", background: "#fff" }}>
      <div style={{ padding: "10px 16px 0", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "#9ca3af", cursor: "pointer", padding: 0, lineHeight: 1 }}>✕</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>- / {customer.sourcePortal || "不明"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{customer.name}</span>
              {customer.isNeedAction && <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: "#EF4444", padding: "2px 6px", borderRadius: 3, flexShrink: 0 }}>反響せ情報あり</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            {customer.email && <span style={{ fontSize: 14, cursor: "pointer" }} title={customer.email}>✉️</span>}
            {customer.phone ? <span style={{ fontSize: 10, color: "#6b7280" }}>📞 {customer.phone}</span> : <span style={{ fontSize: 10, color: "#9ca3af" }}>電話番号なし</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0 10px", flexWrap: "wrap" }}>
          <button onClick={handleToggleAction} style={{
            display: "inline-flex", alignItems: "center", gap: 3, padding: "4px 12px", fontSize: 11, fontWeight: 700,
            color: customer.isNeedAction ? "#fff" : "#DC2626",
            background: customer.isNeedAction ? "#DC2626" : "#fff",
            border: customer.isNeedAction ? "1.5px solid #DC2626" : "1.5px solid #FECACA",
            borderRadius: 4, cursor: "pointer",
          }}>
            {actionLoading && <Spinner size={10} color={customer.isNeedAction ? "#fff" : "#DC2626"} />}
            要対応
          </button>
          <button style={{ padding: "4px 10px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", color: "#374151", cursor: "pointer" }}>スケジュール追加</button>
          <StatusDropdown currentStatusId={customer.statusId} statuses={statuses} onSwitch={handleStatusSwitch} loading={statusLoading} />
          <select value={customer.assigneeId || ""} onChange={(e) => handleAssigneeChange(e.target.value)}
            style={{ padding: "3px 8px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", color: "#374151", cursor: "pointer" }}>
            <option value="">担当者なし</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", background: "#fafafa", alignItems: "center" }}>
        <div style={{ padding: "7px 16px", fontSize: 12, fontWeight: 600, borderBottom: "2px solid #14b8a6", color: "#14b8a6", cursor: "pointer" }}>チャットビュー</div>
        {["📋","👤","🏢","📊","🔗"].map((ic, i) => <span key={i} style={{ padding: "7px 8px", fontSize: 14, cursor: "pointer", opacity: 0.4 }}>{ic}</span>)}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", background: "#fafafa" }}>
        {customer.messages?.length === 0 ? (
          <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: 32 }}>メッセージがありません</div>
        ) : customer.messages?.map((msg) => (
          <div key={msg.id} style={{ marginBottom: 12 }}>
            {msg.direction === "OUTBOUND" ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2, paddingRight: 4 }}>送信 · {fmtDate(msg.createdAt)}</div>
                {msg.subject && <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 2, paddingRight: 4 }}>{msg.subject}</div>}
                <div style={{ maxWidth: "85%", padding: "10px 14px", background: "#14b8a6", color: "#fff", borderRadius: "12px 12px 2px 12px", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.body}</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2, paddingLeft: 4 }}>{msg.channel === "LINE" ? "LINE" : "受信"} · {fmtDate(msg.createdAt)}</div>
                {msg.subject && <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 2, paddingLeft: 4 }}>{msg.subject}</div>}
                <div style={{ maxWidth: "85%", padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", color: "#1f2937", borderRadius: "12px 12px 12px 2px", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.body}</div>
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      {composing ? (
        <div style={{ borderTop: "2px solid #14b8a6", padding: 14, background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#6b7280", width: 32 }}>To:</span>
            <span style={{ fontSize: 12 }}>{customer.email || "メールなし"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#6b7280", width: 32 }}>件名:</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="件名を入力"
              style={{ flex: 1, padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 12, outline: "none" }} />
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="メール本文を入力..." rows={5}
            style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 5, fontSize: 12, outline: "none", resize: "vertical", lineHeight: 1.6, fontFamily: "inherit", boxSizing: "border-box" }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
            <button onClick={() => { setComposing(false); setSubject(""); setBody(""); }}
              style={{ padding: "5px 14px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 5, background: "#fff", color: "#6b7280", cursor: "pointer" }}>キャンセル</button>
            <button onClick={handleSendEmail} disabled={sending || !body.trim() || !customer.email}
              style={{ padding: "5px 18px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 5, background: sending ? "#9ca3af" : "#14b8a6", color: "#fff", cursor: sending ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              {sending && <Spinner size={12} color="#fff" />}送信
            </button>
          </div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4, textAlign: "right" }}>※ 送信すると要対応が自動解除されます</div>
        </div>
      ) : (
        <div style={{ padding: 10, borderTop: "1px solid #e5e7eb", display: "flex", gap: 6 }}>
          <button onClick={() => setComposing(true)} style={{ flex: 1, padding: "9px 14px", fontSize: 12, fontWeight: 600, background: "#14b8a6", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✉️ メール作成</button>
          <button style={{ padding: "9px 14px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", color: "#374151", cursor: "pointer" }}>📞 電話メモ</button>
        </div>
      )}
    </div>
  );
}