"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CustomerDetailPanel } from "@/components/customers/customer-detail-panel";

function Spinner({ size = 18, color = "#14b8a6" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" fill="none" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function StatusBadge({ customerId, statusId, statuses, onChanged }) {
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState(statusId);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const cur = statuses.find((s) => s.id === currentId);

  useEffect(() => setCurrentId(statusId), [statusId]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = async (newId) => {
    setOpen(false); setCurrentId(newId); setBusy(true);
    try {
      await fetch("/api/customers/" + customerId, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statusId: newId }) });
      onChanged();
    } catch { setCurrentId(statusId); }
    finally { setBusy(false); }
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} style={{
        display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 7px", fontSize: 10, fontWeight: 600,
        color: cur?.color || "#6b7280", background: (cur?.color || "#6b7280") + "15",
        border: "1px solid " + (cur?.color || "#6b7280") + "30", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap", lineHeight: "18px",
      }}>
        {busy && <Spinner size={9} color={cur?.color} />}{cur?.name || "?"}<span style={{ fontSize: 7, opacity: 0.6 }}>▼</span>
      </button>
      {open && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "100%", left: 0, zIndex: 9999, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 3, marginTop: 2, minWidth: 120 }}>
          {statuses.map((s) => (
            <button key={s.id} onClick={(e) => { e.stopPropagation(); pick(s.id); }} style={{
              display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "4px 8px", border: "none", borderRadius: 4,
              background: currentId === s.id ? s.color + "15" : "transparent", cursor: "pointer", fontSize: 11, color: "#1f2937",
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, flexShrink: 0 }} />{s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function timeAgo(d) {
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

  const [customers, setCustomers] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStaff, setFilterStaff] = useState("all");
  const [filterAction, setFilterAction] = useState(false);
  const [search, setSearch] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [custRes, statusRes, staffRes] = await Promise.all([
        fetch("/api/customers"), fetch("/api/statuses"), fetch("/api/staff"),
      ]);
      if (custRes.ok) setCustomers(await custRes.json());
      if (statusRes.ok) setStatuses(await statusRes.json());
      if (staffRes.ok) setStaffList(await staffRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (filterStatus !== "all" && c.statusId !== filterStatus) return false;
      if (filterStaff !== "all" && c.assigneeId !== filterStaff) return false;
      if (filterAction && !c.isNeedAction) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) || (c.nameKana || "").toLowerCase().includes(q) || (c.phone || "").includes(q) || (c.email || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [customers, filterStatus, filterStaff, filterAction, search]);

  const actionCount = customers.filter((c) => c.isNeedAction).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>顧客一覧</h1>
          <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#14b8a6", borderBottom: "2px solid #14b8a6", paddingBottom: 4, cursor: "pointer" }}>すべての顧客</span>
            <span style={{ fontSize: 12, color: "#9ca3af", paddingBottom: 4, cursor: "pointer" }}>ビュー1</span>
            <span style={{ fontSize: 12, color: "#9ca3af", paddingBottom: 4, cursor: "pointer" }}>+ ビューを追加する</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setFilterAction(!filterAction)} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, color: filterAction ? "#fff" : "#DC2626", background: filterAction ? "#DC2626" : "#FEE2E2", border: "none", borderRadius: 5, cursor: "pointer" }}>
            要対応 {actionCount > 0 && "(" + actionCount + ")"}
          </button>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "5px 8px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 5, background: "#fff" }}>
            <option value="all">全ステータス</option>
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} style={{ padding: "5px 8px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 5, background: "#fff" }}>
            <option value="all">全担当者</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="キーワード検索" style={{ padding: "5px 10px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 5, width: 150, outline: "none" }} />
          <button style={{ padding: "5px 14px", fontSize: 11, fontWeight: 600, background: "#14b8a6", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>顧客追加</button>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
              <Spinner size={32} /><span style={{ fontSize: 13, color: "#6b7280" }}>読み込み中...</span>
            </div>
          ) : (
            <>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 10 }}>
                    {["顧客名","電話番号","担当者","ステータス","最終アクティブ","最新のやりとり","タグ"].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: 11, whiteSpace: "nowrap", background: "#f9fafb" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const isSelected = selectedId === c.id;
                    return (
                      <tr key={c.id} onClick={() => router.push("/customers?id=" + c.id, { scroll: false })}
                        style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer", background: isSelected ? "#f0fdfa" : c.isNeedAction ? "#fffbeb" : "#fff", transition: "background 0.1s" }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#f9fafb"; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = c.isNeedAction ? "#fffbeb" : "#fff"; }}>
                        <td style={{ padding: "8px 10px", maxWidth: 160 }}>
                          <div style={{ display: "flex", alignItems: "start", gap: 4 }}>
                            {c.isNeedAction && <span style={{ fontSize: 8, color: "#EF4444", marginTop: 4 }}>●</span>}
                            <div>
                              {c.nameKana && <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1 }}>{c.nameKana}</div>}
                              <div style={{ fontWeight: 600, color: "#111827" }}>{c.name}</div>
                              <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                                {c.email && <span style={{ fontSize: 10 }}>✉️</span>}
                                {c.phone && <span style={{ fontSize: 10 }}>📞</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "8px 10px", fontSize: 11, color: "#374151", whiteSpace: "nowrap" }}>{c.phone || "-"}</td>
                        <td style={{ padding: "8px 10px", fontSize: 11, color: "#374151" }}>{c.assignee?.name || "-"}</td>
                        <td style={{ padding: "8px 10px" }} onClick={(e) => e.stopPropagation()}>
                          <StatusBadge customerId={c.id} statusId={c.statusId} statuses={statuses} onChanged={fetchAll} />
                        </td>
                        <td style={{ padding: "8px 10px", fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>{timeAgo(c.updatedAt)}</td>
                        <td style={{ padding: "8px 10px", maxWidth: 200 }}>
                          {c.lastMessage ? (
                            <div>
                              <div style={{ fontSize: 10, color: "#9ca3af" }}>{timeAgo(c.lastMessage.createdAt)} : {c.lastMessage.direction === "OUTBOUND" ? "送信" : "受信"}</div>
                              <div style={{ fontSize: 11, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.lastMessage.subject || c.lastMessage.body?.substring(0, 40)}</div>
                            </div>
                          ) : <span style={{ color: "#d1d5db" }}>-</span>}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {c.sourcePortal && <span style={{ fontSize: 9, color: "#1d4ed8", background: "#EFF6FF", padding: "1px 5px", borderRadius: 3 }}>{c.sourcePortal}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ padding: "8px 16px", borderTop: "1px solid #e5e7eb", background: "#fff", fontSize: 11, color: "#6b7280", position: "sticky", bottom: 0 }}>
                該当する顧客が <strong>{filtered.length}</strong> 件見つかりました
              </div>
            </>
          )}
        </div>
        {selectedId && <CustomerDetailPanel customerId={selectedId} statuses={statuses} staffList={staffList} onClose={() => router.push("/customers", { scroll: false })} onUpdated={fetchAll} />}
      </div>
    </div>
  );
}