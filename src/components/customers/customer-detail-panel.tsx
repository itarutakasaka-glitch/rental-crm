"use client";

import { useState, useEffect, useCallback, useRef } from "react";

function Spinner({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}>
      <circle cx="12" cy="12" r="10" stroke="#D97706" strokeWidth="3" fill="none" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#D97706" strokeWidth="3" fill="none" strokeLinecap="round" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleString("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface Props {
  customerId: string;
  statuses: any[];
  staffList: any[];
  onClose: () => void;
  onUpdated: () => void;
}

export function CustomerDetailPanel({ customerId, statuses, staffList, onClose, onUpdated }: Props) {
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("chat");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [editorH, setEditorH] = useState(80);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchCustomer = useCallback(async () => {
    try {
      const res = await fetch("/api/customers/" + customerId);
      if (res.ok) setCustomer(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { setLoading(true); fetchCustomer(); }, [fetchCustomer]);
  useEffect(() => {
    const iv = setInterval(fetchCustomer, 10000);
    return () => clearInterval(iv);
  }, [fetchCustomer]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [customer?.messages]);

  // Drag resize
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const diff = dragStartY.current - e.clientY;
      setEditorH(Math.max(50, Math.min(400, dragStartH.current + diff)));
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging]);

  const patchCustomer = async (data: any) => {
    try {
      await fetch("/api/customers/" + customerId, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      fetchCustomer(); onUpdated();
    } catch (e) { console.error(e); }
  };

  const handleSend = async () => {
    if (!body.trim() || !customer?.email) return;
    setSending(true);
    try {
      await fetch("/api/send-message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, channel: "EMAIL", subject, body: body.trim(), to: customer.email }),
      });
      setSubject(""); setBody("");
      fetchCustomer(); onUpdated();
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  if (loading) {
    return (
      <div style={{ width: 480, minWidth: 480, borderLeft: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spinner size={28} />
      </div>
    );
  }

  if (!customer) {
    return (
      <div style={{ width: 480, minWidth: 480, borderLeft: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#9ca3af", fontSize: 13 }}>顧客が見つかりません</span>
      </div>
    );
  }

  const messages = customer.messages || [];
  const tabs = [
    { id: "chat", label: "チャットビュー", icon: "💬" },
    { id: "record", label: "記録", icon: "📋" },
    { id: "schedule", label: "スケジュール", icon: "📅" },
    { id: "info", label: "顧客情報", icon: "👤" },
    { id: "condition", label: "希望条件", icon: "🏠" },
    { id: "workflow", label: "ワークフロー", icon: "⚡" },
  ];

  return (
    <div style={{ width: 480, minWidth: 480, borderLeft: "1px solid #e5e7eb", background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={onClose} style={{ width: 24, height: 24, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: "#6b7280" }}>✕</button>
            {customer.sourcePortal && <span style={{ fontSize: 11, color: "#9ca3af" }}>/ {customer.sourcePortal}</span>}
          </div>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", background: "#FEF3C7",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#B45309",
          }}>{customer.assignee?.name?.charAt(0) || "?"}</div>
        </div>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>{customer.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
            {customer.email && <span style={{ fontSize: 11, color: "#D97706" }}>✉️</span>}
            {customer.lineUserId && <span style={{ fontSize: 11, color: "#06C755" }}>💬</span>}
            {customer.phone && <span style={{ fontSize: 12, color: "#374151" }}>📞 {customer.phone}</span>}
          </div>
        </div>
        {customer.inquiryContent && (
          <div style={{ fontSize: 11, color: "#374151", background: "#FEF3C7", borderRadius: 4, padding: "4px 8px", lineHeight: 1.5, marginBottom: 6, maxHeight: 36, overflow: "hidden" }}>
            {customer.inquiryContent}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => { setCustomer({ ...customer, isNeedAction: !customer.isNeedAction }); patchCustomer({ isNeedAction: !customer.isNeedAction }); }} style={{
            padding: "3px 10px", fontSize: 11, fontWeight: 700, border: "none", borderRadius: 4, cursor: "pointer",
            background: customer.isNeedAction ? "#DC2626" : "#e5e7eb", color: customer.isNeedAction ? "#fff" : "#6b7280",
          }}>{customer.isNeedAction ? "要対応" : "対応済"}</button>
          <button style={{ padding: "3px 10px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", color: "#374151", cursor: "pointer" }}>スケジュール追加</button>
          <select value={customer.statusId || ""} onChange={(e) => { setCustomer({ ...customer, statusId: e.target.value }); patchCustomer({ statusId: e.target.value }); }}
            style={{ padding: "3px 6px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", cursor: "pointer", maxWidth: 140 }}>
            {statuses.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={customer.assigneeId || ""} onChange={(e) => { setCustomer({ ...customer, assigneeId: e.target.value }); patchCustomer({ assigneeId: e.target.value }); }}
            style={{ padding: "3px 6px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", cursor: "pointer", maxWidth: 100 }}>
            <option value="">担当者なし</option>
            {staffList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", flexShrink: 0, overflow: "auto" }}>
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "8px 10px", fontSize: 11, border: "none", background: "transparent",
            color: activeTab === tab.id ? "#D97706" : "#9ca3af", cursor: "pointer",
            borderBottom: activeTab === tab.id ? "2px solid #D97706" : "2px solid transparent",
            fontWeight: activeTab === tab.id ? 600 : 400, whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 3,
          }}>
            <span style={{ fontSize: 13 }}>{tab.icon}</span>
            {tab.id === "chat" && tab.label}
          </button>
        ))}
      </div>
      {/* Content */}
      {activeTab === "chat" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "auto", padding: "12px 14px" }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "#9ca3af", fontSize: 12 }}>メッセージはまだありません</div>
            ) : (
              messages.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((msg: any) => {
                const out = msg.direction === "OUTBOUND";
                return (
                  <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: out ? "flex-end" : "flex-start", marginBottom: 14 }}>
                    {!out && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#6b7280" }}>👤</div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{customer.name}</span>
                      </div>
                    )}
                    <div style={{
                      maxWidth: "85%", padding: "10px 12px", borderRadius: 10,
                      background: out ? "#E8F5E9" : "#fff",
                      border: out ? "1px solid #C8E6C9" : "1px solid #e5e7eb",
                      fontSize: 13, lineHeight: 1.6, color: "#111827",
                      borderTopRightRadius: out ? 2 : 10, borderTopLeftRadius: out ? 10 : 2,
                    }}>
                      {msg.subject && <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{msg.subject}</div>}
                      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.body}</div>
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>
                      {formatDate(msg.createdAt)}
                      {out && <span style={{ marginLeft: 6, color: "#06C755" }}>✓</span>}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
          {/* Compose with drag resize */}
          <div style={{ borderTop: "1px solid #e5e7eb", flexShrink: 0 }}>
            {/* Drag handle */}
            <div onMouseDown={(e) => { setDragging(true); dragStartY.current = e.clientY; dragStartH.current = editorH; }}
              style={{ height: 6, cursor: "ns-resize", background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 30, height: 3, borderRadius: 2, background: "#d1d5db" }} />
            </div>
            <div style={{ padding: "8px 14px", background: "#F8F9FB" }}>
              {customer.email ? (
                <>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="件名"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, marginBottom: 6, outline: "none", boxSizing: "border-box" }} />
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="メッセージを入力..."
                    style={{ width: "100%", height: editorH, padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>※ 送信すると要対応が自動解除</span>
                    <button onClick={handleSend} disabled={sending || !body.trim()} style={{
                      padding: "5px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4,
                      cursor: sending || !body.trim() ? "not-allowed" : "pointer",
                      background: sending || !body.trim() ? "#d1d5db" : "#D97706", color: "#fff",
                    }}>{sending ? "送信中..." : "送信"}</button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", padding: 10 }}>メールアドレス未登録のため送信不可</div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === "info" ? (
        <div style={{ flex: 1, overflow: "auto", padding: "14px" }}>
          {[
            { label: "名前", value: customer.name },
            { label: "カナ", value: customer.nameKana },
            { label: "メール", value: customer.email },
            { label: "電話番号", value: customer.phone },
            { label: "反響元", value: customer.sourcePortal },
            { label: "問合せ内容", value: customer.inquiryContent },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", padding: "8px 0", borderBottom: "1px solid #f3f4f6", fontSize: 13 }}>
              <div style={{ width: 100, color: "#6b7280", fontWeight: 500, flexShrink: 0 }}>{item.label}</div>
              <div style={{ color: "#111827" }}>{item.value || "-"}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#9ca3af", fontSize: 13 }}>準備中</span>
        </div>
      )}
    </div>
  );
}