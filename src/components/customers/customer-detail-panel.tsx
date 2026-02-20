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

type ComposeChannel = "EMAIL" | "LINE" | "SMS" | "CALL" | "NOTE";

const channelTabs: { id: ComposeChannel; label: string; icon: string }[] = [
  { id: "EMAIL", label: "メール", icon: "✉️" },
  { id: "LINE", label: "LINE", icon: "💬" },
  { id: "SMS", label: "SMS", icon: "📱" },
  { id: "CALL", label: "架電結果", icon: "📞" },
  { id: "NOTE", label: "メモ", icon: "📝" },
];

export function CustomerDetailPanel({ customerId, statuses, staffList, onClose, onUpdated }: Props) {
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("chat");
  const [composeChannel, setComposeChannel] = useState<ComposeChannel>("EMAIL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [editorH, setEditorH] = useState(100);
  const [editorDragging, setEditorDragging] = useState(false);
  const editorDragY = useRef(0);
  const editorDragH = useRef(0);

  // Panel width resize
  const [panelW, setPanelW] = useState(520);
  const [panelDragging, setPanelDragging] = useState(false);
  const panelDragX = useRef(0);
  const panelDragW = useRef(0);

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchCustomer = useCallback(async () => {
    try {
      const res = await fetch("/api/customers/" + customerId);
      if (res.ok) setCustomer(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [customerId]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) setTemplates(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { setLoading(true); fetchCustomer(); fetchTemplates(); }, [fetchCustomer, fetchTemplates]);
  useEffect(() => {
    const iv = setInterval(fetchCustomer, 10000);
    return () => clearInterval(iv);
  }, [fetchCustomer]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [customer?.messages]);

  // Editor drag resize
  useEffect(() => {
    if (!editorDragging) return;
    const onMove = (e: MouseEvent) => {
      setEditorH(Math.max(50, Math.min(400, editorDragH.current + (editorDragY.current - e.clientY))));
    };
    const onUp = () => setEditorDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [editorDragging]);

  // Panel width drag resize
  useEffect(() => {
    if (!panelDragging) return;
    const onMove = (e: MouseEvent) => {
      setPanelW(Math.max(380, Math.min(900, panelDragW.current + (panelDragX.current - e.clientX))));
    };
    const onUp = () => setPanelDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [panelDragging]);

  const patchCustomer = async (data: any) => {
    try {
      await fetch("/api/customers/" + customerId, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      fetchCustomer(); onUpdated();
    } catch (e) { console.error(e); }
  };

  const applyTemplate = (t: any) => {
    setSubject(t.subject || "");
    // Variable replacement
    let b = t.body || "";
    if (customer) {
      b = b.replace(/\{\{顧客名\}\}/g, customer.name || "")
        .replace(/\{\{メール\}\}/g, customer.email || "")
        .replace(/\{\{電話番号\}\}/g, customer.phone || "")
        .replace(/\{\{担当者名\}\}/g, customer.assignee?.name || "");
    }
    setBody(b);
    setShowTemplates(false);
  };

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      if (composeChannel === "EMAIL") {
        if (!customer?.email) { setSending(false); return; }
        await fetch("/api/send-message", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, channel: "EMAIL", subject, body: body.trim(), to: customer.email }),
        });
      } else if (composeChannel === "NOTE" || composeChannel === "CALL") {
        // Save as message record
        await fetch("/api/send-message", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, channel: composeChannel, subject: composeChannel === "CALL" ? "架電記録" : "メモ", body: body.trim() }),
        });
      }
      setSubject(""); setBody("");
      fetchCustomer(); onUpdated();
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  if (loading) {
    return (
      <div style={{ width: panelW, minWidth: panelW, borderLeft: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spinner size={28} />
      </div>
    );
  }
  if (!customer) {
    return (
      <div style={{ width: panelW, minWidth: panelW, borderLeft: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
    <div style={{ display: "flex", position: "relative" }}>
      {/* Left drag handle for panel width */}
      <div
        onMouseDown={(e) => { setPanelDragging(true); panelDragX.current = e.clientX; panelDragW.current = panelW; }}
        style={{
          width: 5, cursor: "col-resize", background: panelDragging ? "#D97706" : "transparent",
          transition: "background 0.2s", flexShrink: 0, zIndex: 2,
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#e5e7eb"; }}
        onMouseLeave={(e) => { if (!panelDragging) (e.target as HTMLElement).style.background = "transparent"; }}
      />
      <div style={{ width: panelW, minWidth: 380, borderLeft: "1px solid #e5e7eb", background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={onClose} style={{ width: 24, height: 24, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: "#6b7280" }}>✕</button>
              {customer.sourcePortal && <span style={{ fontSize: 11, color: "#9ca3af" }}>/ {customer.sourcePortal}</span>}
            </div>
            {customer.assignee && (
              <div style={{
                width: 28, height: 28, borderRadius: "50%", background: "#FEF3C7",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#B45309",
              }}>{customer.assignee.avatarUrl ? (
                <img src={customer.assignee.avatarUrl} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
              ) : customer.assignee.name?.charAt(0)}</div>
            )}
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
            {/* Messages */}
            <div style={{ flex: 1, overflow: "auto", padding: "12px 14px" }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "#9ca3af", fontSize: 12 }}>メッセージはまだありません</div>
              ) : (
                messages.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((msg: any) => {
                  const out = msg.direction === "OUTBOUND";
                  const isNote = msg.channel === "NOTE";
                  const isCall = msg.channel === "CALL";
                  if (isNote || isCall) {
                    return (
                      <div key={msg.id} style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                        <div style={{
                          padding: "8px 14px", borderRadius: 8, fontSize: 12, lineHeight: 1.5,
                          background: isCall ? "#FEF3C7" : "#f3f4f6", border: "1px solid #e5e7eb",
                          maxWidth: "90%", color: "#374151",
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", marginBottom: 2 }}>{isCall ? "📞 架電記録" : "📝 メモ"}</div>
                          <div style={{ whiteSpace: "pre-wrap" }}>{msg.body}</div>
                          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{formatDate(msg.createdAt)}</div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: out ? "flex-end" : "flex-start", marginBottom: 14 }}>
                      {!out && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#6b7280" }}>👤</div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{customer.name}</span>
                          {msg.channel === "LINE" && <span style={{ fontSize: 9, color: "#06C755", fontWeight: 600 }}>LINE</span>}
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
                        {msg.channel === "EMAIL" && <span style={{ marginRight: 4 }}>✉️</span>}
                        {msg.channel === "LINE" && <span style={{ marginRight: 4 }}>💬</span>}
                        {formatDate(msg.createdAt)}
                        {out && <span style={{ marginLeft: 6, color: "#06C755" }}>✓</span>}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>
            {/* Compose */}
            <div style={{ borderTop: "1px solid #e5e7eb", flexShrink: 0 }}>
              {/* Editor drag handle */}
              <div onMouseDown={(e) => { setEditorDragging(true); editorDragY.current = e.clientY; editorDragH.current = editorH; }}
                style={{ height: 6, cursor: "ns-resize", background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 30, height: 3, borderRadius: 2, background: "#d1d5db" }} />
              </div>
              {/* Channel tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", background: "#F8F9FB" }}>
                {channelTabs.map((ch) => (
                  <button key={ch.id} onClick={() => setComposeChannel(ch.id)} style={{
                    padding: "5px 10px", fontSize: 11, border: "none", cursor: "pointer",
                    background: composeChannel === ch.id ? "#fff" : "transparent",
                    color: composeChannel === ch.id ? "#D97706" : "#6b7280",
                    fontWeight: composeChannel === ch.id ? 600 : 400,
                    borderBottom: composeChannel === ch.id ? "2px solid #D97706" : "2px solid transparent",
                    display: "flex", alignItems: "center", gap: 3,
                  }}>
                    <span style={{ fontSize: 12 }}>{ch.icon}</span>{ch.label}
                  </button>
                ))}
              </div>
              <div style={{ padding: "8px 14px", background: "#F8F9FB" }}>
                {composeChannel === "EMAIL" ? (
                  customer.email ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="件名"
                          style={{ flex: 1, padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, outline: "none", boxSizing: "border-box" }} />
                        <button onClick={() => setShowTemplates(!showTemplates)} style={{
                          padding: "5px 10px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4,
                          background: showTemplates ? "#FEF3C7" : "#fff", color: "#374151", cursor: "pointer", whiteSpace: "nowrap",
                        }}>📄 定型文</button>
                      </div>
                      {showTemplates && templates.length > 0 && (
                        <div style={{ marginBottom: 6, maxHeight: 120, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 4, background: "#fff" }}>
                          {templates.map((t: any) => (
                            <button key={t.id} onClick={() => applyTemplate(t)} style={{
                              display: "block", width: "100%", padding: "6px 10px", fontSize: 11,
                              border: "none", borderBottom: "1px solid #f3f4f6", background: "transparent",
                              textAlign: "left", cursor: "pointer", color: "#374151",
                            }}>
                              <span style={{ fontWeight: 600 }}>{t.name}</span>
                              <span style={{ color: "#9ca3af", marginLeft: 8 }}>{t.subject}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="メッセージを入力..."
                        style={{ width: "100%", height: editorH, padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>送信先: {customer.email}</span>
                        <button onClick={handleSend} disabled={sending || !body.trim()} style={{
                          padding: "5px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4,
                          cursor: sending || !body.trim() ? "not-allowed" : "pointer",
                          background: sending || !body.trim() ? "#d1d5db" : "#D97706", color: "#fff",
                        }}>{sending ? "送信中..." : "送信"}</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", padding: 10 }}>メールアドレス未登録のため送信不可</div>
                  )
                ) : composeChannel === "LINE" ? (
                  customer.lineUserId ? (
                    <>
                      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="LINEメッセージを入力..."
                        style={{ width: "100%", height: editorH, padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                        <button disabled style={{ padding: "5px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4, background: "#d1d5db", color: "#fff", cursor: "not-allowed" }}>LINE送信（準備中）</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", padding: 10 }}>LINE未連携</div>
                  )
                ) : composeChannel === "SMS" ? (
                  <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", padding: 10 }}>SMS送信機能（準備中）</div>
                ) : (
                  <>
                    <textarea value={body} onChange={(e) => setBody(e.target.value)}
                      placeholder={composeChannel === "CALL" ? "架電結果を記録..." : "メモを入力..."}
                      style={{ width: "100%", height: editorH, padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      {composeChannel === "CALL" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 3, color: "#374151" }}>
                            <input type="radio" name="callResult" defaultChecked style={{ accentColor: "#D97706" }} /> 成功
                          </label>
                          <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 3, color: "#374151" }}>
                            <input type="radio" name="callResult" style={{ accentColor: "#D97706" }} /> 不在
                          </label>
                        </div>
                      )}
                      {composeChannel === "NOTE" && <span />}
                      <button onClick={handleSend} disabled={sending || !body.trim()} style={{
                        padding: "5px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4,
                        cursor: sending || !body.trim() ? "not-allowed" : "pointer",
                        background: sending || !body.trim() ? "#d1d5db" : "#D97706", color: "#fff",
                      }}>{sending ? "保存中..." : "保存"}</button>
                    </div>
                  </>
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
    </div>
  );
}