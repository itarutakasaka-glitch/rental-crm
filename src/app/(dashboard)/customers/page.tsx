"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CustomerDetailPanel } from "@/components/customers/customer-detail-panel";
import { CustomerAddModal } from "@/components/customers/customer-add-modal";

function Spinner({ size = 20 }) {
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

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedId = searchParams.get("id");

  const [customers, setCustomers] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Filters
  const [filterNeedAction, setFilterNeedAction] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [cRes, sRes, stRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/statuses"),
        fetch("/api/staff"),
      ]);
      if (cRes.ok) setCustomers(await cRes.json());
      if (sRes.ok) setStatuses(await sRes.json());
      if (stRes.ok) setStaffList(await stRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const needActionCount = customers.filter((c) => c.isNeedAction).length;

  const filtered = customers.filter((c) => {
    if (filterNeedAction && !c.isNeedAction) return false;
    if (filterStatus && c.statusId !== filterStatus) return false;
    if (filterStaff && c.assigneeId !== filterStaff) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = (c.name || "").toLowerCase().includes(q)
        || (c.nameKana || "").toLowerCase().includes(q)
        || (c.email || "").toLowerCase().includes(q)
        || (c.phone || "").includes(q);
      if (!match) return false;
    }
    return true;
  });

  const selectCustomer = (id: string) => {
    router.push("/customers?id=" + id, { scroll: false });
  };

  const closePanel = () => {
    router.push("/customers", { scroll: false });
  };

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* Left: Table */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>顧客一覧</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setFilterNeedAction(!filterNeedAction)} style={{
                padding: "5px 14px", fontSize: 12, fontWeight: 600, borderRadius: 5, cursor: "pointer",
                border: filterNeedAction ? "1px solid #DC2626" : "1px solid #d1d5db",
                background: filterNeedAction ? "#FEE2E2" : "#fff",
                color: filterNeedAction ? "#DC2626" : "#374151",
              }}>
                要対応{needActionCount > 0 ? ` (${needActionCount})` : ""}
              </button>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                style={{ padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 5, color: "#374151" }}>
                <option value="">全ステータス</option>
                {statuses.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)}
                style={{ padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 5, color: "#374151" }}>
                <option value="">全担当者</option>
                {staffList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="キーワード検索"
                style={{ padding: "5px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 5, width: 150, outline: "none" }} />
              <button onClick={() => setShowAddModal(true)} style={{
                padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 5,
                background: "#29B6F6", color: "#fff", cursor: "pointer",
              }}>顧客追加</button>
            </div>
          </div>
          {/* View tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e5e7eb" }}>
            <button style={{
              padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#29B6F6",
              background: "transparent", border: "none", borderBottom: "2px solid #29B6F6",
              marginBottom: -2, cursor: "pointer",
            }}>すべての顧客</button>
            <button style={{
              padding: "6px 16px", fontSize: 12, color: "#9ca3af",
              background: "transparent", border: "none", borderBottom: "2px solid transparent",
              marginBottom: -2, cursor: "pointer",
            }}>ビュー1</button>
            <button style={{
              padding: "6px 16px", fontSize: 12, color: "#9ca3af",
              background: "transparent", border: "none", borderBottom: "2px solid transparent",
              marginBottom: -2, cursor: "pointer",
            }}>+ ビューを追加する</button>
          </div>
        </div>
        {/* Table */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 1 }}>
                {["顧客名","電話番号","担当者","ステータス","最終アクティブ","最新のやりとり","タグ"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center" }}><Spinner /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>顧客がいません</td></tr>
              ) : filtered.map((c: any) => (
                <tr key={c.id} onClick={() => selectCustomer(c.id)} style={{
                  cursor: "pointer", borderBottom: "1px solid #f3f4f6",
                  background: selectedId === c.id ? "#EBF5FF" : c.isNeedAction ? "#FFFBEB" : "#fff",
                  transition: "background 0.1s",
                }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {c.isNeedAction && <span style={{ color: "#DC2626", fontSize: 8 }}>●</span>}
                      <div>
                        {c.nameKana && <div style={{ fontSize: 10, color: "#9ca3af" }}>{c.nameKana}</div>}
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                        <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                          {c.email && <span style={{ fontSize: 10, color: "#93C5FD" }}>✉️</span>}
                          {c.lineUserId && <span style={{ fontSize: 10, color: "#06C755" }}>💬</span>}
                          {c.phone && <span style={{ fontSize: 10, color: "#F472B6" }}>📞</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#374151" }}>{c.phone || "-"}</td>
                  <td style={{ padding: "10px 12px", color: "#374151" }}>{c.assignee?.name || "-"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {c.status ? (
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                        color: c.status.color || "#6b7280",
                        background: (c.status.color || "#6b7280") + "18",
                      }}>{c.status.name}</span>
                    ) : "-"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 11 }}>
                    {timeAgo(c.updatedAt)}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 11, color: "#374151", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.lastMessage ? (
                      <span>
                        <span style={{ color: "#9ca3af" }}>{timeAgo(c.lastMessage.createdAt)}：{c.lastMessage.direction === "INBOUND" ? "受信" : "送信"}</span>
                        <br />{c.lastMessage.body?.substring(0, 40)}
                      </span>
                    ) : "-"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {c.sourcePortal && (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "#EFF6FF", color: "#2563eb", fontWeight: 600 }}>
                        {c.sourcePortal}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "10px 12px", fontSize: 11, color: "#9ca3af", borderTop: "1px solid #e5e7eb" }}>
            該当する顧客が {filtered.length} 件見つかりました
          </div>
        </div>
      </div>
      {/* Right: Detail Panel */}
      {selectedId && (
        <CustomerDetailPanel
          customerId={selectedId}
          statuses={statuses}
          staffList={staffList}
          onClose={closePanel}
          onUpdated={fetchAll}
        />
      )}
      {/* Add Modal */}
      {showAddModal && (
        <CustomerAddModal
          statuses={statuses}
          staffList={staffList}
          onClose={() => setShowAddModal(false)}
          onCreated={fetchAll}
        />
      )}
    </div>
  );
}
// v2
