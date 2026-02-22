"use client";
import { CyberpunkSpinner } from "@/components/ui/cyberpunk-spinner";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CustomerDetailPanel } from "@/components/customers/customer-detail-panel";
import { CustomerAddModal } from "@/components/customers/customer-add-modal";

// Spinner replaced by CyberpunkSpinner

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return m + "分前";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "時間前";
  return Math.floor(h / 24) + "日前";
}

interface SavedView {
  id: string;
  name: string;
  filters: { needAction?: boolean; statusId?: string; staffId?: string; source?: string; };
}

const defaultViews: SavedView[] = [
  { id: "all", name: "すべての顧客", filters: {} },
  { id: "need-action", name: "要対応", filters: { needAction: true } },
  { id: "suumo", name: "SUUMO反響", filters: { source: "SUUMO" } },
  { id: "homes", name: "HOME'S反響", filters: { source: "HOME'S" } },
  { id: "apaman", name: "アパマン反響", filters: { source: "アパマンショップ" } },
];

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedId = searchParams.get("id");

  const [customers, setCustomers] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [views, setViews] = useState<SavedView[]>(defaultViews);
  const [activeViewId, setActiveViewId] = useState("all");
  const [showAddView, setShowAddView] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  // Extra filters on top of view
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [cRes, sRes, stRes] = await Promise.all([
        fetch("/api/customers"), fetch("/api/statuses"), fetch("/api/staff"),
      ]);
      if (cRes.ok) setCustomers(await cRes.json());
      if (sRes.ok) setStatuses(await sRes.json());
      if (stRes.ok) setStaffList(await stRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    const iv = setInterval(fetchAll, 10000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  const activeView = views.find((v) => v.id === activeViewId) || views[0];
  const needActionCount = customers.filter((c) => c.isNeedAction).length;

  const filtered = customers.filter((c) => {
    // View filters
    const vf = activeView.filters;
    if (vf.needAction && !c.isNeedAction) return false;
    if (vf.statusId && c.statusId !== vf.statusId) return false;
    if (vf.staffId && c.assigneeId !== vf.staffId) return false;
    if (vf.source && c.sourcePortal !== vf.source) return false;
    // Extra filters
    if (filterStatus && c.statusId !== filterStatus) return false;
    if (filterStaff && c.assigneeId !== filterStaff) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(c.name || "").toLowerCase().includes(q) && !(c.nameKana || "").toLowerCase().includes(q)
        && !(c.email || "").toLowerCase().includes(q) && !(c.phone || "").includes(q)) return false;
    }
    return true;
  });

  const addView = () => {
    if (!newViewName.trim()) return;
    const newView: SavedView = {
      id: "custom-" + Date.now(),
      name: newViewName.trim(),
      filters: {
        ...(filterStatus ? { statusId: filterStatus } : {}),
        ...(filterStaff ? { staffId: filterStaff } : {}),
      },
    };
    setViews([...views, newView]);
    setActiveViewId(newView.id);
    setNewViewName(""); setShowAddView(false);
  };

  const deleteView = (id: string) => {
    if (["all","need-action","suumo","homes","apaman"].includes(id)) return;
    setViews(views.filter((v) => v.id !== id));
    if (activeViewId === id) setActiveViewId("all");
  };

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>顧客一覧</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                background: "#d4a017", color: "#fff", cursor: "pointer",
              }}>顧客追加</button>
            </div>
          </div>
          {/* View tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e5e7eb", alignItems: "end" }}>
            {views.map((v) => (
              <div key={v.id} style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <button onClick={() => setActiveViewId(v.id)} style={{
                  padding: "6px 14px", fontSize: 12, background: "transparent", border: "none", cursor: "pointer",
                  fontWeight: activeViewId === v.id ? 600 : 400,
                  color: activeViewId === v.id ? "#b8860b" : "#9ca3af",
                  borderBottom: activeViewId === v.id ? "2px solid #d4a017" : "2px solid transparent",
                  marginBottom: -2, whiteSpace: "nowrap",
                }}>
                  {v.name}
                  {v.id === "need-action" && needActionCount > 0 && (
                    <span style={{ marginLeft: 4, fontSize: 10, background: "#DC2626", color: "#fff", padding: "0 5px", borderRadius: 8 }}>{needActionCount}</span>
                  )}
                </button>
                {!["all","need-action","suumo","homes","apaman"].includes(v.id) && activeViewId === v.id && (
                  <button onClick={() => deleteView(v.id)} style={{
                    fontSize: 10, color: "#9ca3af", background: "none", border: "none", cursor: "pointer",
                    marginLeft: -6, marginBottom: -2,
                  }}>✕</button>
                )}
              </div>
            ))}
            {showAddView ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: -2, padding: "0 8px" }}>
                <input value={newViewName} onChange={(e) => setNewViewName(e.target.value)} placeholder="ビュー名"
                  autoFocus onKeyDown={(e) => e.key === "Enter" && addView()}
                  style={{ width: 100, padding: "3px 6px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 3, outline: "none" }} />
                <button onClick={addView} style={{ fontSize: 11, color: "#b8860b", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>保存</button>
                <button onClick={() => { setShowAddView(false); setNewViewName(""); }} style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>✕</button>
              </div>
            ) : (
              <button onClick={() => setShowAddView(true)} style={{
                padding: "6px 14px", fontSize: 12, color: "#9ca3af", background: "transparent",
                border: "none", borderBottom: "2px solid transparent", marginBottom: -2, cursor: "pointer",
              }}>+ ビューを追加</button>
            )}
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
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center" }}><CyberpunkSpinner size={20} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>顧客がいません</td></tr>
              ) : filtered.map((c: any) => (
                <tr key={c.id} onClick={() => router.push("/customers?id=" + c.id, { scroll: false })} style={{
                  cursor: "pointer", borderBottom: "1px solid #f3f4f6",
                  background: selectedId === c.id ? "rgba(212,160,23,0.08)" : c.isNeedAction ? "#FFFBEB" : "#fff",
                }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {c.isNeedAction && <span style={{ color: "#DC2626", fontSize: 8 }}>●</span>}
                      <div>
                        {c.nameKana && <div style={{ fontSize: 10, color: "#9ca3af" }}>{c.nameKana}</div>}
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                        <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                          {c.email && <span style={{ fontSize: 10 }}>✉️</span>}
                          {c.lineUserId && <span style={{ fontSize: 10 }}>💬</span>}
                          {c.phone && <span style={{ fontSize: 10 }}>📞</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#374151" }}>{c.phone || "-"}</td>
                  <td style={{ padding: "10px 12px", color: "#374151" }}>{c.assignee?.name || "-"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {c.status ? (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600, color: c.status.color || "#6b7280", background: (c.status.color || "#6b7280") + "18" }}>{c.status.name}</span>
                    ) : "-"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 11 }}>{timeAgo(c.updatedAt)}</td>
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
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "rgba(212,160,23,0.1)", color: "#b85309", fontWeight: 600 }}>{c.sourcePortal}</span>
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
      {selectedId && (
        <CustomerDetailPanel customerId={selectedId} statuses={statuses} staffList={staffList}
          onClose={() => router.push("/customers", { scroll: false })} onUpdated={fetchAll} />
      )}
      {showAddModal && (
        <CustomerAddModal statuses={statuses} staffList={staffList}
          onClose={() => setShowAddModal(false)} onCreated={fetchAll} />
      )}
    </div>
  );
}