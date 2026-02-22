"use client";
import { CyberpunkSpinner } from "@/components/ui/cyberpunk-spinner";

import { useState, useEffect, useCallback, useRef } from "react";

// Spinner replaced by CyberpunkSpinner

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
  { id: "EMAIL", label: "\u30E1\u30FC\u30EB", icon: "\u2709\uFE0F" },
  { id: "LINE", label: "LINE", icon: "\uD83D\uDCAC" },
  { id: "SMS", label: "SMS", icon: "\uD83D\uDCF1" },
  { id: "CALL", label: "\u67B6\u96FB\u7D50\u679C", icon: "\uD83D\uDCDE" },
  { id: "NOTE", label: "\u30E1\u30E2", icon: "\uD83D\uDCDD" },
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
  const [panelW, setPanelW] = useState(520);
  const [panelDragging, setPanelDragging] = useState(false);
  const panelDragX = useRef(0);
  const panelDragW = useRef(0);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [callResult, setCallResult] = useState("success");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Info tab editing state
  const [infoForm, setInfoForm] = useState<any>({});
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);

  // Schedule tab state
  const [schedules, setSchedules] = useState<any[]>([]);
  const [schTitle, setSchTitle] = useState("");
  const [schType, setSchType] = useState("FOLLOW_UP");
  const [schStartAt, setSchStartAt] = useState("");
  const [schDesc, setSchDesc] = useState("");
  const [schSaving, setSchSaving] = useState(false);
  const [schEndAt, setSchEndAt] = useState("");
  const [schStaff, setSchStaff] = useState("");
  const [schEditId, setSchEditId] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/customers/" + customerId + "/schedules");
      if (res.ok) setSchedules(await res.json());
    } catch (e) { console.error(e); }
  }, [customerId]);

  const handleScheduleSave = async () => {
    if (!schTitle.trim() || !schStartAt) return;
    setSchSaving(true);
    try {
      const orgId = customer?.organizationId || customer?.organization?.id;
      if (schEditId) {
        await fetch("/api/customers/" + customerId + "/schedules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduleId: schEditId, title: schTitle.trim(), type: schType, startAt: schStartAt, endAt: schEndAt || null, description: schDesc.trim() || null, userId: schStaff || null }),
        });
      } else {
        await fetch("/api/customers/" + customerId + "/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: schTitle.trim(), type: schType, startAt: schStartAt, endAt: schEndAt || null, description: schDesc.trim() || null, organizationId: orgId, userId: schStaff || null }),
        });
      }
      setSchTitle(""); setSchDesc(""); setSchStartAt(""); setSchEndAt(""); setSchStaff(""); setSchEditId(null);
      fetchSchedules();
    } catch (e) { console.error(e); }
    finally { setSchSaving(false); }
  };

  // Preference (condition) tab state
  const [prefForm, setPrefForm] = useState<any>({});
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);

  const fetchPreference = useCallback(async () => {
    try {
      const res = await fetch("/api/customers/" + customerId + "/preference");
      if (res.ok) { const d = await res.json(); setPrefForm(d || {}); }
    } catch (e) { console.error(e); }
  }, [customerId]);

  const handlePrefSave = async () => {
    setPrefSaving(true); setPrefSaved(false);
    try {
      await fetch("/api/customers/" + customerId + "/preference", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefForm),
      });
      setPrefSaved(true);
      setTimeout(() => setPrefSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setPrefSaving(false); }
  };

  // Workflow tab state
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [wfRuns, setWfRuns] = useState<any[]>([]);
  const [selectedWfId, setSelectedWfId] = useState("");
  const [wfStarting, setWfStarting] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/workflows");
      if (res.ok) { const d = await res.json(); setWorkflows(d.workflows || d); }
    } catch (e) { console.error(e); }
  }, []);

  const fetchWfRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/workflow-run?customerId=" + customerId);
      if (res.ok) { const d = await res.json(); setWfRuns(Array.isArray(d) ? d : d.runs || []); }
    } catch (e) { console.error(e); }
  }, [customerId]);

  const handleWfStart = async () => {
    if (!selectedWfId) return;
    setWfStarting(true);
    try {
      await fetch("/api/workflow-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, workflowId: selectedWfId }),
      });
      setSelectedWfId("");
      fetchWfRuns();
    } catch (e) { console.error(e); }
    finally { setWfStarting(false); }
  };

  const handleWfStop = async (runId: string) => {
    try {
      await fetch("/api/workflow-run", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, action: "stop" }),
      });
      fetchWfRuns();
    } catch (e) { console.error(e); }
  };

  // Records tab state
  const [records, setRecords] = useState<any[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recType, setRecType] = useState("CALL");
  const [recCallResult, setRecCallResult] = useState("success");
  const [recBody, setRecBody] = useState("");
  const [recVisitDate, setRecVisitDate] = useState("");
  const [recSaving, setRecSaving] = useState(false);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch("/api/customers/" + customerId + "/records");
      if (res.ok) setRecords(await res.json());
    } catch (e) { console.error(e); }
  }, [customerId]);

  const handleRecordSave = async () => {
    if (!recBody.trim() && recType !== "CALL") return;
    setRecSaving(true);
    try {
      await fetch("/api/customers/" + customerId + "/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: recType,
          callResult: recType === "CALL" ? recCallResult : null,
          title: recType === "CALL" ? "\u67B6\u96FB\u8A18\u9332" : recType === "MEMO" ? "\u30E1\u30E2" : recType === "VISIT" ? "\u6765\u5E97\u8A18\u9332" : "\u304A\u90E8\u5C4B\u63A2\u3057\u8A18\u9332",
          body: recBody.trim() || null,
          visitDate: recType === "VISIT" && recVisitDate ? recVisitDate : null,
        }),
      });
      setRecBody(""); setRecVisitDate("");
      fetchRecords(); fetchCustomer(); onUpdated();
    } catch (e) { console.error(e); }
    finally { setRecSaving(false); }
  };

  const fetchCustomer = useCallback(async () => {
    try {
      const res = await fetch("/api/customers/" + customerId);
      if (res.ok) {
        const data = await res.json();
        setCustomer(data);
        // Initialize info form when customer data loads
        setInfoForm({
          name: data.name || "",
          nameKana: data.nameKana || "",
          email: data.email || "",
          phone: data.phone || "",
          memo: data.memo || "",
        });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [customerId]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) { const data = await res.json(); setTemplates(data.templates || data); }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { setLoading(true); fetchCustomer(); fetchTemplates(); fetchRecords(); fetchSchedules(); fetchPreference(); fetchWorkflows(); fetchWfRuns(); }, [fetchCustomer, fetchTemplates, fetchRecords, fetchSchedules, fetchPreference, fetchWorkflows, fetchWfRuns]);
  useEffect(() => { const iv = setInterval(fetchCustomer, 10000); return () => clearInterval(iv); }, [fetchCustomer]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [customer?.messages]);

  useEffect(() => {
    if (!editorDragging) return;
    const onMove = (e: MouseEvent) => setEditorH(Math.max(50, Math.min(400, editorDragH.current + (editorDragY.current - e.clientY))));
    const onUp = () => setEditorDragging(false);
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [editorDragging]);

  useEffect(() => {
    if (!panelDragging) return;
    const onMove = (e: MouseEvent) => setPanelW(Math.max(380, Math.min(900, panelDragW.current + (panelDragX.current - e.clientX))));
    const onUp = () => setPanelDragging(false);
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [panelDragging]);

  const patchCustomer = async (data: any) => {
    try {
      await fetch("/api/customers/" + customerId, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      fetchCustomer(); onUpdated();
    } catch (e) { console.error(e); }
  };

  const handleInfoSave = async () => {
    setInfoSaving(true);
    setInfoSaved(false);
    try {
      await fetch("/api/customers/" + customerId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(infoForm),
      });
      fetchCustomer();
      onUpdated();
      setInfoSaved(true);
      setTimeout(() => setInfoSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setInfoSaving(false); }
  };

  const applyTemplate = (t: any) => {
    setSubject(t.subject || "");
    let b = t.body || "";
    if (customer) {
      b = b.replace(/\{\{\u5BA2\u5BA2\u540D\}\}/g, customer.name || "")
        .replace(/\{\{\u30E1\u30FC\u30EB\}\}/g, customer.email || "")
        .replace(/\{\{\u96FB\u8A71\u756A\u53F7\}\}/g, customer.phone || "")
        .replace(/\{\{\u62C5\u5F53\u8005\u540D\}\}/g, customer.assignee?.name || "");
    }
    setBody(b); setShowTemplates(false);
  };

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      const payload: any = { customerId, channel: composeChannel, body: body.trim() };
      if (composeChannel === "EMAIL") {
        if (!customer?.email) { setSending(false); return; }
        payload.to = customer.email;
        payload.subject = subject;
      } else if (composeChannel === "LINE") {
        if (!customer?.lineUserId) { setSending(false); return; }
        payload.lineUserId = customer.lineUserId;
      } else if (composeChannel === "SMS") {
        if (!customer?.phone) { setSending(false); return; }
        payload.phone = customer.phone;
      } else if (composeChannel === "CALL") {
        payload.subject = "\u67B6\u96FB\u8A18\u9332";
        payload.callResult = callResult;
      } else if (composeChannel === "NOTE") {
        payload.subject = "\u30E1\u30E2";
      }
      await fetch("/api/send-message", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      setSubject(""); setBody("");
      fetchCustomer(); onUpdated();
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  if (loading) {
    return (
      <div style={{ width: panelW, minWidth: panelW, borderLeft: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CyberpunkSpinner size={28} />
      </div>
    );
  }
  if (!customer) {
    return (
      <div style={{ width: panelW, minWidth: panelW, borderLeft: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#9ca3af", fontSize: 13 }}>{"\u9867\u5BA2\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"}</span>
      </div>
    );
  }

  const messages = customer.messages || [];
  const tabs = [
    { id: "chat", label: "\u3084\u308A\u3068\u308A", icon: "\uD83D\uDCAC" },
    { id: "record", label: "\u8A18\u9332", icon: "\uD83D\uDCCB" },
    { id: "schedule", label: "\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB", icon: "\uD83D\uDCC5" },
    { id: "info", label: "\u9867\u5BA2\u60C5\u5831", icon: "\uD83D\uDC64" },
    { id: "condition", label: "\u5E0C\u671B\u6761\u4EF6", icon: "\uD83C\uDFE0" },
    { id: "workflow", label: "\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC", icon: "\u2699\uFE0F" },
  ];

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", fontSize: 13, border: "1px solid #d1d5db",
    borderRadius: 6, outline: "none", boxSizing: "border-box" as const, background: "#fff",
    transition: "border-color 0.15s",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block",
  };

  return (
    <div style={{ display: "flex", position: "relative" }}>
      {/* Panel resize handle */}
      <div onMouseDown={(e) => { setPanelDragging(true); panelDragX.current = e.clientX; panelDragW.current = panelW; }}
        style={{ width: 5, cursor: "col-resize", background: panelDragging ? "#D97706" : "transparent", flexShrink: 0, zIndex: 2 }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#e5e7eb"; }}
        onMouseLeave={(e) => { if (!panelDragging) (e.target as HTMLElement).style.background = "transparent"; }} />
      <div style={{ width: panelW, minWidth: 380, borderLeft: "1px solid #e5e7eb", background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={onClose} style={{ width: 24, height: 24, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: "#6b7280" }}>{"\u2716"}</button>
              {customer.sourcePortal && <span style={{ fontSize: 11, color: "#9ca3af" }}>/ {customer.sourcePortal}</span>}
            </div>
            {customer.assignee && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#B45309" }}>
                {customer.assignee.avatarUrl ? <img src={customer.assignee.avatarUrl} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} /> : customer.assignee.name?.charAt(0)}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>{customer.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              {customer.email && <span style={{ fontSize: 11, color: "#D97706" }}>{"\u2709\uFE0F"}</span>}
              {customer.lineUserId && <span style={{ fontSize: 11, color: "#06C755" }}>{"\uD83D\uDCAC"}</span>}
              {customer.phone && <span style={{ fontSize: 12, color: "#374151" }}>{"\uD83D\uDCDE"} {customer.phone}</span>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => { setCustomer({ ...customer, isNeedAction: !customer.isNeedAction }); patchCustomer({ isNeedAction: !customer.isNeedAction }); }} style={{
              padding: "3px 10px", fontSize: 11, fontWeight: 700, border: "none", borderRadius: 4, cursor: "pointer",
              background: customer.isNeedAction ? "#DC2626" : "#e5e7eb", color: customer.isNeedAction ? "#fff" : "#6b7280",
            }}>{customer.isNeedAction ? "\u8981\u5BFE\u5FDC" : "\u5BFE\u5FDC\u6E08"}</button>
            <select value={customer.statusId || ""} onChange={(e) => { setCustomer({ ...customer, statusId: e.target.value }); patchCustomer({ statusId: e.target.value }); }}
              style={{ padding: "3px 6px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", cursor: "pointer", maxWidth: 140 }}>
              {statuses.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={customer.assigneeId || ""} onChange={(e) => { setCustomer({ ...customer, assigneeId: e.target.value }); patchCustomer({ assigneeId: e.target.value }); }}
              style={{ padding: "3px 6px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", cursor: "pointer", maxWidth: 100 }}>
              <option value="">{"\u62C5\u5F53\u8005\u306A\u3057"}</option>
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
              <span style={{ fontSize: 13 }}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        {/* ============ CHAT TAB ============ */}
        {activeTab === "chat" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, overflow: "auto", padding: "12px 14px" }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "#9ca3af", fontSize: 12 }}>{"\u30E1\u30C3\u30BB\u30FC\u30B8\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093"}</div>
              ) : (
                messages.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((msg: any) => {
                  const out = msg.direction === "OUTBOUND";
                  const isNote = msg.channel === "NOTE";
                  const isCall = msg.channel === "CALL";
                  if (isNote || isCall) {
                    return (
                      <div key={msg.id} style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                        <div style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, lineHeight: 1.5, background: isCall ? "#FEF3C7" : "#f3f4f6", border: "1px solid #e5e7eb", maxWidth: "90%", color: "#374151" }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", marginBottom: 2 }}>{isCall ? "\uD83D\uDCDE \u67B6\u96FB\u8A18\u9332" : "\uD83D\uDCDD \u30E1\u30E2"}</div>
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
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#6b7280" }}>{"\uD83D\uDC64"}</div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{customer.name}</span>
                          {msg.channel === "LINE" && <span style={{ fontSize: 9, color: "#06C755", fontWeight: 600 }}>LINE</span>}
                          {msg.channel === "SMS" && <span style={{ fontSize: 9, color: "#2563eb", fontWeight: 600 }}>SMS</span>}
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
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                        {msg.channel === "EMAIL" && <span>{"\u2709\uFE0F"}</span>}
                        {msg.channel === "LINE" && <span>{"\uD83D\uDCAC"}</span>}
                        {msg.channel === "SMS" && <span>{"\uD83D\uDCF1"}</span>}
                        {formatDate(msg.createdAt)}
                        {out && msg.openedAt && <span style={{ color: "#2563eb", fontWeight: 600, marginLeft: 4 }}>{"\u65E2\u8AAD"}</span>}
                        {out && msg.status === "DELIVERED" && !msg.openedAt && <span style={{ color: "#6b7280", marginLeft: 4 }}>{"\u9001\u4FE1\u6E08"}</span>}
                        {out && msg.status === "SENT" && !msg.openedAt && <span style={{ color: "#9ca3af", marginLeft: 4 }}>{msg.channel === "LINE" ? "\u9001\u4FE1\u6E08" : msg.channel === "SMS" ? "SMS\u9001\u4FE1\u6E08" : "\u9001\u4FE1\u6E08"}</span>}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>
            {/* Compose area */}
            <div style={{ borderTop: "1px solid #e5e7eb", flexShrink: 0 }}>
              <div onMouseDown={(e) => { setEditorDragging(true); editorDragY.current = e.clientY; editorDragH.current = editorH; }}
                style={{ height: 6, cursor: "ns-resize", background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 30, height: 3, borderRadius: 2, background: "#d1d5db" }} />
              </div>
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
                        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={"\u4EF6\u540D"}
                          style={{ flex: 1, padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, outline: "none", boxSizing: "border-box" }} />
                        <button onClick={() => setShowTemplates(!showTemplates)} style={{
                          padding: "5px 10px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4,
                          background: showTemplates ? "#FEF3C7" : "#fff", color: "#374151", cursor: "pointer", whiteSpace: "nowrap",
                        }}>{"\uD83D\uDCC4"} {"\u5B9A\u578B\u6587"}</button>
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
                      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={"\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u5165\u529B..."}
                        style={{ width: "100%", height: editorH, padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>{"\u9001\u4FE1\u5148"}: {customer.email}</span>
                        <button onClick={handleSend} disabled={sending || !body.trim()} style={{
                          padding: "5px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4,
                          cursor: sending || !body.trim() ? "not-allowed" : "pointer",
                          background: sending || !body.trim() ? "#d1d5db" : "#D97706", color: "#fff",
                        }}>{sending ? "\u9001\u4FE1\u4E2D..." : "\u9001\u4FE1"}</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", padding: 10 }}>{"\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u672A\u767B\u9332"}</div>
                  )
                ) : composeChannel === "LINE" ? (
                  customer.lineUserId ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <button onClick={() => setShowTemplates(!showTemplates)} style={{
                          padding: "5px 10px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4,
                          background: showTemplates ? "#FEF3C7" : "#fff", color: "#374151", cursor: "pointer",
                        }}>{"\uD83D\uDCC4"} {"\u5B9A\u578B\u6587"}</button>
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
                            </button>
                          ))}
                        </div>
                      )}
                      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={"LINE\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u5165\u529B..."}
                        style={{ width: "100%", height: editorH, padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                        <span style={{ fontSize: 10, color: "#06C755" }}>LINE: {customer.lineDisplayName || "\u9023\u643A\u6E08"}</span>
                        <button onClick={handleSend} disabled={sending || !body.trim()} style={{
                          padding: "5px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4,
                          cursor: sending || !body.trim() ? "not-allowed" : "pointer",
                          background: sending || !body.trim() ? "#d1d5db" : "#06C755", color: "#fff",
                        }}>{sending ? "\u9001\u4FE1\u4E2D..." : "LINE\u9001\u4FE1"}</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", padding: 10 }}>{"\u004C\u0049\u004E\u0045\u672A\u9023\u643A"}</div>
                  )
                ) : composeChannel === "SMS" ? (
                  customer.phone ? (
                    <>
                      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={"SMS\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u5165\u529B\uFF0870\u6587\u5B57\u4EE5\u5185\u63A8\u5968\uFF09..."}
                        style={{ width: "100%", height: editorH, padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>{"\u9001\u4FE1\u5148"}: {customer.phone}{"\uFF08"}{body.length}{"\u6587\u5B57\uFF09"}</span>
                        <button onClick={handleSend} disabled={sending || !body.trim()} style={{
                          padding: "5px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4,
                          cursor: sending || !body.trim() ? "not-allowed" : "pointer",
                          background: sending || !body.trim() ? "#d1d5db" : "#2563eb", color: "#fff",
                        }}>{sending ? "\u9001\u4FE1\u4E2D..." : "SMS\u9001\u4FE1"}</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", padding: 10 }}>{"\u96FB\u8A71\u756A\u53F7\u672A\u767B\u9332"}</div>
                  )
                ) : (
                  <>
                    {composeChannel === "CALL" && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                        {[{ v: "success", l: "\u6210\u529F\uFF08\u901A\u8A71\u3042\u308A\uFF09" }, { v: "noanswer", l: "\u4E0D\u5728" }, { v: "busy", l: "\u8A71\u3057\u4E2D" }].map((r) => (
                          <label key={r.v} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 3, color: "#374151", cursor: "pointer" }}>
                            <input type="radio" name="callResult" value={r.v} checked={callResult === r.v} onChange={() => setCallResult(r.v)} style={{ accentColor: "#D97706" }} />{r.l}
                          </label>
                        ))}
                      </div>
                    )}
                    <textarea value={body} onChange={(e) => setBody(e.target.value)}
                      placeholder={composeChannel === "CALL" ? "\u67B6\u96FB\u5185\u5BB9\u3092\u8A18\u9332..." : "\u30E1\u30E2\u3092\u5165\u529B..."}
                      style={{ width: "100%", height: editorH, padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                      <button onClick={handleSend} disabled={sending || !body.trim()} style={{
                        padding: "5px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4,
                        cursor: sending || !body.trim() ? "not-allowed" : "pointer",
                        background: sending || !body.trim() ? "#d1d5db" : "#D97706", color: "#fff",
                      }}>{sending ? "\u4FDD\u5B58\u4E2D..." : "\u4FDD\u5B58"}</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

        /* ============ INFO TAB (EDITABLE) ============ */
        ) : activeTab === "info" ? (
          <div style={{ flex: 1, overflow: "auto", padding: "16px 14px" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <span>{"\uD83D\uDC64"}</span> {"\u57FA\u672C\u60C5\u5831"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={labelStyle}>{"\u540D\u524D"}</label>
                  <input value={infoForm.name || ""} onChange={(e) => setInfoForm({ ...infoForm, name: e.target.value })}
                    style={inputStyle} placeholder={"\u4F8B\uFF09\u5C71\u7530 \u592A\u90CE"} />
                </div>
                <div>
                  <label style={labelStyle}>{"\u30AB\u30CA"}</label>
                  <input value={infoForm.nameKana || ""} onChange={(e) => setInfoForm({ ...infoForm, nameKana: e.target.value })}
                    style={inputStyle} placeholder={"\u4F8B\uFF09\u30E4\u30DE\u30C0 \u30BF\u30ED\u30A6"} />
                </div>
                <div>
                  <label style={labelStyle}>{"\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9"}</label>
                  <input value={infoForm.email || ""} onChange={(e) => setInfoForm({ ...infoForm, email: e.target.value })}
                    type="email" style={inputStyle} placeholder="example@email.com" />
                </div>
                <div>
                  <label style={labelStyle}>{"\u96FB\u8A71\u756A\u53F7"}</label>
                  <input value={infoForm.phone || ""} onChange={(e) => setInfoForm({ ...infoForm, phone: e.target.value })}
                    type="tel" style={inputStyle} placeholder="090-1234-5678" />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <span>{"\uD83D\uDCDD"}</span> {"\u30E1\u30E2"}
              </div>
              <textarea value={infoForm.memo || ""} onChange={(e) => setInfoForm({ ...infoForm, memo: e.target.value })}
                placeholder={"\u9867\u5BA2\u306B\u95A2\u3059\u308B\u30E1\u30E2\u3092\u5165\u529B..."}
                style={{ ...inputStyle, height: 100, resize: "vertical", lineHeight: 1.5 }} />
            </div>

            <div style={{ marginBottom: 20, padding: "12px", background: "#F8F9FB", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span>{"\u2139\uFE0F"}</span> {"\u305D\u306E\u4ED6\u60C5\u5831"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "\u53CD\u97FF\u5143", value: customer.sourcePortal },
                  { label: "\u554F\u5408\u305B\u5185\u5BB9", value: customer.inquiryContent },
                  { label: "LINE\u9023\u643A", value: customer.lineUserId ? `\u2705 ${customer.lineDisplayName || "\u9023\u643A\u6E08"}` : "\u274C \u672A\u9023\u643A" },
                  { label: "\u6700\u7D42\u30A2\u30AF\u30C6\u30A3\u30D6", value: customer.lastActiveAt ? formatDate(customer.lastActiveAt) : "-" },
                  { label: "\u4F5C\u6210\u65E5", value: customer.createdAt ? formatDate(customer.createdAt) : "-" },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", fontSize: 12, padding: "4px 0" }}>
                    <div style={{ width: 110, color: "#6b7280", fontWeight: 500, flexShrink: 0 }}>{item.label}</div>
                    <div style={{ color: "#111827" }}>{item.value || "-"}</div>
                  </div>
                ))}
              </div>
            </div>

            {customer.properties && customer.properties.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{"\uD83C\uDFE2"}</span> {"\u53CD\u97FF\u7269\u4EF6"}
                </div>
                {customer.properties.map((p: any, i: number) => (
                  <div key={i} style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 6, marginBottom: 6, background: "#fff", fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: "#111827", marginBottom: 4 }}>{p.name || "\u7269\u4EF6\u540D\u4E0D\u660E"}</div>
                    {p.address && <div style={{ color: "#6b7280" }}>{"\uD83D\uDCCD"} {p.address}</div>}
                    {p.station && <div style={{ color: "#6b7280" }}>{"\uD83D\uDE83"} {p.station}</div>}
                    <div style={{ display: "flex", gap: 10, marginTop: 4, color: "#374151" }}>
                      {p.rent && <span>{"\u00A5"} {p.rent}</span>}
                      {p.layout && <span>{p.layout}</span>}
                      {p.area && <span>{p.area}</span>}
                    </div>
                    {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#D97706", marginTop: 4, display: "inline-block" }}>{"\u7269\u4EF6\u30DA\u30FC\u30B8\u3092\u958B\u304F"} →</a>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb" }}>
              {infoSaved && <span style={{ fontSize: 12, color: "#16a34a", display: "flex", alignItems: "center", gap: 4 }}>{"\u2705"} {"\u4FDD\u5B58\u3057\u307E\u3057\u305F"}</span>}
              <button onClick={handleInfoSave} disabled={infoSaving} style={{
                padding: "7px 20px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 6,
                cursor: infoSaving ? "not-allowed" : "pointer",
                background: infoSaving ? "#d1d5db" : "#D97706", color: "#fff",
              }}>{infoSaving ? "\u4FDD\u5B58\u4E2D..." : "\u4FDD\u5B58"}</button>
            </div>
          </div>

        /* ============ RECORD TAB ============ */
        ) : activeTab === "record" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Record form */}
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {[
                  { v: "CALL", l: "\uD83D\uDCDE \u67B6\u96FB" },
                  { v: "MEMO", l: "\uD83D\uDCDD \u30E1\u30E2" },
                  { v: "VISIT", l: "\uD83C\uDFE0 \u6765\u5E97" },
                  { v: "ROOM_SEARCH", l: "\uD83D\uDD0D \u304A\u90E8\u5C4B\u63A2\u3057" },
                ].map((t) => (
                  <button key={t.v} onClick={() => setRecType(t.v)} style={{
                    padding: "4px 10px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4,
                    background: recType === t.v ? "#FEF3C7" : "#fff",
                    color: recType === t.v ? "#B45309" : "#6b7280",
                    fontWeight: recType === t.v ? 600 : 400, cursor: "pointer",
                  }}>{t.l}</button>
                ))}
              </div>
              {recType === "CALL" && (
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  {[{ v: "success", l: "\u2705 \u6210\u529F" }, { v: "noanswer", l: "\u274C \u4E0D\u5728" }, { v: "busy", l: "\uD83D\uDCF5 \u8A71\u3057\u4E2D" }].map((r) => (
                    <label key={r.v} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 3, color: "#374151", cursor: "pointer" }}>
                      <input type="radio" name="recCallResult" value={r.v} checked={recCallResult === r.v} onChange={() => setRecCallResult(r.v)} style={{ accentColor: "#D97706" }} />{r.l}
                    </label>
                  ))}
                </div>
              )}
              {recType === "VISIT" && (
                <div style={{ marginBottom: 6 }}>
                  <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>{"\u6765\u5E97\u65E5\u6642"}</label>
                  <input type="datetime-local" value={recVisitDate} onChange={(e) => setRecVisitDate(e.target.value)}
                    style={{ padding: "4px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, outline: "none" }} />
                </div>
              )}
              <textarea value={recBody} onChange={(e) => setRecBody(e.target.value)}
                placeholder={recType === "CALL" ? "\u901A\u8A71\u5185\u5BB9\u3092\u8A18\u9332..." : recType === "MEMO" ? "\u30E1\u30E2\u3092\u5165\u529B..." : recType === "VISIT" ? "\u6765\u5E97\u6642\u306E\u5185\u5BB9..." : "\u304A\u90E8\u5C4B\u63A2\u3057\u306E\u5185\u5BB9..."}
                style={{ width: "100%", height: 60, padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <button onClick={handleRecordSave} disabled={recSaving} style={{
                  padding: "5px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4,
                  cursor: recSaving ? "not-allowed" : "pointer",
                  background: recSaving ? "#d1d5db" : "#D97706", color: "#fff",
                }}>{recSaving ? "\u4FDD\u5B58\u4E2D..." : "\u4FDD\u5B58"}</button>
              </div>
            </div>
            {/* Records timeline */}
            <div style={{ flex: 1, overflow: "auto", padding: "12px 14px" }}>
              {records.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "#9ca3af", fontSize: 12 }}>{"\u8A18\u9332\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093"}</div>
              ) : (
                records.map((rec: any) => {
                  const icon = rec.type === "CALL" ? "\uD83D\uDCDE" : rec.type === "MEMO" ? "\uD83D\uDCDD" : rec.type === "VISIT" ? "\uD83C\uDFE0" : "\uD83D\uDD0D";
                  const typeLabel = rec.type === "CALL" ? "\u67B6\u96FB" : rec.type === "MEMO" ? "\u30E1\u30E2" : rec.type === "VISIT" ? "\u6765\u5E97" : "\u304A\u90E8\u5C4B\u63A2\u3057";
                  const bgColor = rec.type === "CALL" ? (rec.callResult === "success" ? "#ECFDF5" : "#FEF2F2") : rec.type === "VISIT" ? "#EFF6FF" : "#f3f4f6";
                  return (
                    <div key={rec.id} style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: bgColor, border: "1px solid #e5e7eb" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>
                          {icon} {typeLabel}
                          {rec.type === "CALL" && rec.callResult && (
                            <span style={{ marginLeft: 6, fontSize: 10, color: rec.callResult === "success" ? "#16a34a" : "#dc2626" }}>
                              {rec.callResult === "success" ? "\u2705\u6210\u529F" : rec.callResult === "noanswer" ? "\u274C\u4E0D\u5728" : "\uD83D\uDCF5\u8A71\u3057\u4E2D"}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>{formatDate(rec.createdAt)}</span>
                      </div>
                      {rec.type === "VISIT" && rec.visitDate && (
                        <div style={{ fontSize: 11, color: "#2563eb", marginBottom: 3 }}>{"\uD83D\uDCC5"} {formatDate(rec.visitDate)}</div>
                      )}
                      {rec.body && <div style={{ fontSize: 12, color: "#111827", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{rec.body}</div>}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        /* ============ SCHEDULE TAB ============ */
        ) : activeTab === "schedule" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {[
                  { v: "VISIT", l: "\uD83C\uDFE0 \u6765\u5E97\u4E88\u7D04" },
                  { v: "VIEWING", l: "\uD83D\uDC41 \u5185\u898B" },
                  { v: "CALL", l: "\uD83D\uDCDE \u67B6\u96FB" },
                  { v: "FOLLOW_UP", l: "\uD83D\uDCCB \u8FFD\u5BA2" },
                ].map((t) => (
                  <button key={t.v} onClick={() => setSchType(t.v)} style={{
                    padding: "4px 10px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4,
                    background: schType === t.v ? "#FEF3C7" : "#fff",
                    color: schType === t.v ? "#B45309" : "#6b7280",
                    fontWeight: schType === t.v ? 600 : 400, cursor: "pointer",
                  }}>{t.l}</button>
                ))}
              </div>
              <input value={schTitle} onChange={(e) => setSchTitle(e.target.value)} placeholder={"\u30BF\u30A4\u30C8\u30EB"}
                style={{ width: "100%", padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, outline: "none", marginBottom: 6, boxSizing: "border-box" as const }} />
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>{"\u958B\u59CB"}</div>
                  <input type="datetime-local" value={schStartAt} onChange={(e) => setSchStartAt(e.target.value)}
                    style={{ width: "100%", padding: "4px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, outline: "none", boxSizing: "border-box" as const }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>{"\u7D42\u4E86"}</div>
                  <input type="datetime-local" value={schEndAt} onChange={(e) => setSchEndAt(e.target.value)}
                    style={{ width: "100%", padding: "4px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, outline: "none", boxSizing: "border-box" as const }} />
                </div>
              </div>
              <select value={schStaff} onChange={(e) => setSchStaff(e.target.value)}
                style={{ width: "100%", padding: "4px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, outline: "none", marginBottom: 6, boxSizing: "border-box" as const }}>
                <option value="">{"\u62C5\u5F53\u8005\u306A\u3057"}</option>
                {staffList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <textarea value={schDesc} onChange={(e) => setSchDesc(e.target.value)} placeholder={"\u5099\u8003"}
                style={{ width: "100%", height: 40, padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, resize: "none", outline: "none", boxSizing: "border-box" as const, lineHeight: 1.5 }} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <button onClick={handleScheduleSave} disabled={schSaving || !schTitle.trim() || !schStartAt} style={{
                  padding: "5px 16px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4,
                  cursor: schSaving || !schTitle.trim() || !schStartAt ? "not-allowed" : "pointer",
                  background: schSaving || !schTitle.trim() || !schStartAt ? "#d1d5db" : "#D97706", color: "#fff",
                }}>{schSaving ? "\u4FDD\u5B58\u4E2D..." : schEditId ? "\u66F4\u65B0" : "\u4FDD\u5B58"}</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "12px 14px" }}>
              {schedules.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "#9ca3af", fontSize: 12 }}>{"\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093"}</div>
              ) : (
                schedules.map((sch: any) => {
                  const icon = sch.type === "VISIT" ? "\uD83C\uDFE0" : sch.type === "VIEWING" ? "\uD83D\uDC41" : sch.type === "CALL" ? "\uD83D\uDCDE" : "\uD83D\uDCCB";
                  const typeLabel = sch.type === "VISIT" ? "\u6765\u5E97\u4E88\u7D04" : sch.type === "VIEWING" ? "\u5185\u898B" : sch.type === "CALL" ? "\u67B6\u96FB" : "\u8FFD\u5BA2";
                  const isPast = new Date(sch.startAt) < new Date();
                  return (
                    <div key={sch.id} style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: isPast ? "#f3f4f6" : "#EFF6FF", border: "1px solid #e5e7eb", opacity: isPast ? 0.7 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{icon} {sch.title}</span>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "#FEF3C7", color: "#B45309" }}>{typeLabel}</span>
                          <button onClick={() => { setSchEditId(sch.id); setSchTitle(sch.title || ""); setSchType(sch.type || "FOLLOW_UP"); const sd = new Date(sch.startAt); setSchStartAt(sd.getFullYear()+"-"+String(sd.getMonth()+1).padStart(2,"0")+"-"+String(sd.getDate()).padStart(2,"0")+"T"+String(sd.getHours()).padStart(2,"0")+":"+String(sd.getMinutes()).padStart(2,"0")); if(sch.endAt){const ed=new Date(sch.endAt);setSchEndAt(ed.getFullYear()+"-"+String(ed.getMonth()+1).padStart(2,"0")+"-"+String(ed.getDate()).padStart(2,"0")+"T"+String(ed.getHours()).padStart(2,"0")+":"+String(ed.getMinutes()).padStart(2,"0"));}else{setSchEndAt("");} setSchDesc(sch.description||""); setSchStaff(sch.userId||""); }} style={{ fontSize: 10, color: "#D97706", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}>{"\u270F\uFE0F"}</button>
                          <button onClick={async()=>{if(!confirm("\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F"))return;await fetch("/api/customers/"+customerId+"/schedules?scheduleId="+sch.id,{method:"DELETE"});fetchSchedules();}} style={{ fontSize: 10, color: "#DC2626", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}>{"\uD83D\uDDD1"}</button>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "#2563eb", marginBottom: 2 }}>{"\uD83D\uDCC5"} {formatDate(sch.startAt)}{sch.endAt ? " - " + new Date(sch.endAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                      {sch.user && <div style={{ fontSize: 10, color: "#6b7280" }}>{"\uD83D\uDC64"} {sch.user.name}</div>}
                      {sch.description && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{sch.description}</div>}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        /* ============ CONDITION TAB ============ */
        ) : activeTab === "condition" ? (
          <div style={{ flex: 1, overflow: "auto", padding: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 12px" }}>
              <div>
                <label style={labelStyle}>{"\u5E0C\u671B\u30A8\u30EA\u30A2"}</label>
                <input value={prefForm.area || ""} onChange={(e) => setPrefForm({ ...prefForm, area: e.target.value })} placeholder={"\u4F8B: \u6E0B\u8C37\u533A, \u65B0\u5BBF\u533A"} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{"\u5E0C\u671B\u99C5"}</label>
                <input value={prefForm.station || ""} onChange={(e) => setPrefForm({ ...prefForm, station: e.target.value })} placeholder={"\u4F8B: \u6E0B\u8C37\u99C5"} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{"\u5F92\u6B69\u5206"}</label>
                <input type="number" value={prefForm.walkMinutes || ""} onChange={(e) => setPrefForm({ ...prefForm, walkMinutes: e.target.value ? parseInt(e.target.value) : null })} placeholder="\u5206" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{"\u9593\u53D6\u308A"}</label>
                <input value={prefForm.layout || ""} onChange={(e) => setPrefForm({ ...prefForm, layout: e.target.value })} placeholder={"\u4F8B: 1LDK, 2DK"} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{"\u8CC3\u6599\u4E0B\u9650(\u4E07\u5186)"}</label>
                <input type="number" value={prefForm.rentMin || ""} onChange={(e) => setPrefForm({ ...prefForm, rentMin: e.target.value ? parseInt(e.target.value) : null })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{"\u8CC3\u6599\u4E0A\u9650(\u4E07\u5186)"}</label>
                <input type="number" value={prefForm.rentMax || ""} onChange={(e) => setPrefForm({ ...prefForm, rentMax: e.target.value ? parseInt(e.target.value) : null })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{"\u5E83\u3055\u4E0B\u9650(m\u00B2)"}</label>
                <input type="number" value={prefForm.areaMin || ""} onChange={(e) => setPrefForm({ ...prefForm, areaMin: e.target.value ? parseFloat(e.target.value) : null })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{"\u5165\u5C45\u5E0C\u671B\u6642\u671F"}</label>
                <input value={prefForm.moveInDate || ""} onChange={(e) => setPrefForm({ ...prefForm, moveInDate: e.target.value })} placeholder={"\u4F8B: 2026\u5E744\u6708"} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginTop: 14, marginBottom: 10 }}>
              <label style={{ ...labelStyle, marginBottom: 8 }}>{"\u3053\u3060\u308F\u308A\u6761\u4EF6"}</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[
                  { k: "petOk", l: "\uD83D\uDC3E \u30DA\u30C3\u30C8\u53EF" },
                  { k: "autoLock", l: "\uD83D\uDD10 \u30AA\u30FC\u30C8\u30ED\u30C3\u30AF" },
                  { k: "bathToiletSeparate", l: "\uD83D\uDEBF \u30D0\u30B9\u30FB\u30C8\u30A4\u30EC\u5225" },
                  { k: "flooring", l: "\uD83C\uDFE0 \u30D5\u30ED\u30FC\u30EA\u30F3\u30B0" },
                  { k: "aircon", l: "\u2744\uFE0F \u30A8\u30A2\u30B3\u30F3" },
                  { k: "reheating", l: "\u2668\uFE0F \u8FFD\u3044\u7119\u304D" },
                  { k: "washletToilet", l: "\uD83D\uDEBD \u6E29\u6C34\u6D17\u6D44\u4FBF\u5EA7" },
                  { k: "freeInternet", l: "\uD83D\uDCF6 \u30A4\u30F3\u30BF\u30FC\u30CD\u30C3\u30C8\u7121\u6599" },
                ].map((item) => (
                  <label key={item.k} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "#374151", cursor: "pointer", padding: "3px 0" }}>
                    <input type="checkbox" checked={!!prefForm[item.k]} onChange={(e) => setPrefForm({ ...prefForm, [item.k]: e.target.checked })} style={{ accentColor: "#D97706" }} />
                    {item.l}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={labelStyle}>{"\u5099\u8003"}</label>
              <textarea value={prefForm.note || ""} onChange={(e) => setPrefForm({ ...prefForm, note: e.target.value })} placeholder={"\u305D\u306E\u4ED6\u306E\u5E0C\u671B\u6761\u4EF6..."}
                style={{ width: "100%", height: 60, padding: "6px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, resize: "none", outline: "none", boxSizing: "border-box" as const }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 10 }}>
              {prefSaved && <span style={{ fontSize: 12, color: "#16a34a" }}>{"\u2705 \u4FDD\u5B58\u3057\u307E\u3057\u305F"}</span>}
              <button onClick={handlePrefSave} disabled={prefSaving} style={{
                padding: "6px 20px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4,
                cursor: prefSaving ? "not-allowed" : "pointer",
                background: prefSaving ? "#d1d5db" : "#D97706", color: "#fff",
              }}>{prefSaving ? "\u4FDD\u5B58\u4E2D..." : "\u4FDD\u5B58"}</button>
            </div>
          </div>

        /* ============ WORKFLOW TAB ============ */
        ) : activeTab === "workflow" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>{"\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u3092\u958B\u59CB"}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <select value={selectedWfId} onChange={(e) => setSelectedWfId(e.target.value)}
                  style={{ flex: 1, padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, outline: "none" }}>
                  <option value="">{"\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u3092\u9078\u629E"}</option>
                  {workflows.filter((w: any) => w.isActive).map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}{w.isDefault ? " (\u30C7\u30D5\u30A9\u30EB\u30C8)" : ""}</option>
                  ))}
                </select>
                <button onClick={handleWfStart} disabled={!selectedWfId || wfStarting} style={{
                  padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4,
                  cursor: !selectedWfId || wfStarting ? "not-allowed" : "pointer",
                  background: !selectedWfId || wfStarting ? "#d1d5db" : "#D97706", color: "#fff",
                }}>{wfStarting ? "\u958B\u59CB\u4E2D..." : "\u958B\u59CB"}</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "12px 14px" }}>
              {wfRuns.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "#9ca3af", fontSize: 12 }}>{"\u5B9F\u884C\u4E2D\u306E\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u306F\u3042\u308A\u307E\u305B\u3093"}</div>
              ) : (
                wfRuns.map((run: any) => {
                  const isRunning = run.status === "RUNNING";
                  const statusColor = isRunning ? "#16a34a" : run.status === "COMPLETED" ? "#2563eb" : "#dc2626";
                  const statusLabel = run.status === "RUNNING" ? "\u5B9F\u884C\u4E2D" : run.status === "COMPLETED" ? "\u5B8C\u4E86" : run.status === "STOPPED" ? "\u505C\u6B62" : run.status === "STOPPED_BY_REPLY" ? "\u8FD4\u4FE1\u505C\u6B62" : run.status === "STOPPED_BY_LINE_ADD" ? "LINE\u8FFD\u52A0\u505C\u6B62" : run.status;
                  return (
                    <div key={run.id} style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: isRunning ? "#F0FDF4" : "#f9fafb" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{"\u2699\uFE0F"} {run.workflow?.name || "\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC"}</span>
                        <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 10, background: isRunning ? "#DCFCE7" : "#f3f4f6", color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
                        {"\u30B9\u30C6\u30C3\u30D7"}: {run.currentStepIndex + 1} / {run.workflow?.steps?.length || "?"}
                      </div>
                      {run.nextRunAt && isRunning && (
                        <div style={{ fontSize: 11, color: "#2563eb" }}>
                          {"\u6B21\u56DE\u914D\u4FE1"}: {new Date(run.nextRunAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                        {"\u958B\u59CB"}: {formatDate(run.createdAt)}
                      </div>
                      {isRunning && (
                        <button onClick={() => handleWfStop(run.id)} style={{
                          marginTop: 6, padding: "3px 12px", fontSize: 11, border: "1px solid #fca5a5", borderRadius: 4,
                          background: "#FEF2F2", color: "#dc2626", cursor: "pointer", fontWeight: 500,
                        }}>{"\u505C\u6B62"}</button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        /* ============ PLACEHOLDER TABS ============ */
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#9ca3af", fontSize: 13 }}>{"\u6E96\u5099\u4E2D"}</span>
          </div>
        )}
      </div>
    </div>
  );
}