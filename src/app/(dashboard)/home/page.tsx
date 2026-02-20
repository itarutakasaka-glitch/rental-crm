"use client";

import { useState, useEffect, useCallback } from "react";

function Spinner({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}>
      <circle cx="12" cy="12" r="10" stroke="#29B6F6" strokeWidth="3" fill="none" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#29B6F6" strokeWidth="3" fill="none" strokeLinecap="round" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return m + "分前";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "時間前";
  return Math.floor(h / 24) + "日前";
}

export default function HomePage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/customers");
      if (res.ok) setCustomers(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const needAction = customers.filter((c: any) => c.isNeedAction);
  const tabs = [
    { id: "all", label: "すべて", count: needAction.length },
    { id: "inquiry", label: "反響", count: needAction.filter((c: any) => c.sourcePortal).length },
    { id: "message", label: "メッセージ", count: needAction.filter((c: any) => c.lastMessage).length },
  ];

  const filtered = activeTab === "all" ? needAction
    : activeTab === "inquiry" ? needAction.filter((c: any) => c.sourcePortal)
    : needAction.filter((c: any) => c.lastMessage);

  const today = new Date();
  const dateStr = today.getMonth() + 1 + "/" + today.getDate() + "(" + ["日","月","火","水","木","金","土"][today.getDay()] + ")";

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 24, display: "flex", gap: 24 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 16 }}>要対応リスト</h2>
        <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e5e7eb", marginBottom: 16 }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "8px 20px", fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? "#29B6F6" : "#6b7280", background: "transparent", border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #29B6F6" : "2px solid transparent",
              marginBottom: -2, cursor: "pointer", whiteSpace: "nowrap",
            }}>
              {tab.label} <span style={{
                marginLeft: 4, fontSize: 11, background: activeTab === tab.id ? "#29B6F6" : "#e5e7eb",
                color: activeTab === tab.id ? "#fff" : "#6b7280",
                padding: "1px 6px", borderRadius: 8, fontWeight: 600,
              }}>{tab.count}</span>
            </button>
          ))}
        </div>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner size={28} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 13 }}>要対応の顧客はありません</div>
        ) : (
          <div>
            {filtered.map((c: any) => (
              <a key={c.id} href={"/customers?id=" + c.id} style={{ display: "block", padding: "14px 16px", borderBottom: "1px solid #f3f4f6", textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#9ca3af", marginRight: 8 }}>{c.lastMessage?.direction === "INBOUND" ? "受信" : "反響"}</span>
                    <span style={{ fontSize: 11, color: "#6b7280", marginRight: 8 }}>担当者：{c.assignee?.name || "なし"}</span>
                    <span style={{ fontSize: 11, color: "#29B6F6" }}>{timeAgo(c.updatedAt)}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#2563eb" }}>{c.name}</span>
                      {c.status && (
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, fontWeight: 600, color: c.status.color || "#6b7280", background: (c.status.color || "#6b7280") + "18" }}>{c.status.name}</span>
                      )}
                      {c.sourcePortal && <span style={{ fontSize: 10, color: "#6b7280" }}>反響元：{c.sourcePortal}</span>}
                    </div>
                    {c.inquiryContent && (
                      <div style={{ fontSize: 12, color: "#374151", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 10px", marginTop: 4 }}>{c.inquiryContent}</div>
                    )}
                  </div>
                  {c.lastMessage && (
                    <div style={{ width: 280, flexShrink: 0 }}>
                      <div style={{ fontSize: 12, color: "#374151", background: c.lastMessage.direction === "INBOUND" ? "#fff" : "#E8F5E9", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", maxHeight: 80, overflow: "hidden" }}>
                        <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>{c.lastMessage.direction === "INBOUND" ? "受信" : "送信"} · {timeAgo(c.lastMessage.createdAt)}</div>
                        {c.lastMessage.subject && <div style={{ fontWeight: 600, fontSize: 11 }}>{c.lastMessage.subject}</div>}
                        <div style={{ fontSize: 11, lineHeight: 1.4 }}>{c.lastMessage.body?.substring(0, 100)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
      <div style={{ width: 320, flexShrink: 0 }}>
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", background: "#F8F9FB", borderBottom: "1px solid #e5e7eb" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>{dateStr}のスケジュール</h3>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ textAlign: "center", padding: 24, color: "#9ca3af", fontSize: 13 }}>本日のスケジュールはありません</div>
          </div>
        </div>
      </div>
    </div>
  );
}