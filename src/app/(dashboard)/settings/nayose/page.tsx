"use client";
import { useState, useEffect } from "react";

interface CustomerSummary {
  id: string;
  name: string;
  nameKana: string | null;
  email: string | null;
  phone: string | null;
  sourcePortal: string | null;
  createdAt: string;
  status: { name: string } | null;
  assignee: { name: string } | null;
  _count: { messages: number };
}

interface DuplicateGroup {
  customers: CustomerSummary[];
}

export default function NayosePage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customers/duplicates");
      const data = await res.json();
      setGroups(data.groups || []);
    } catch {
      setMessage({ type: "error", text: "\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDuplicates(); }, []);

  const handleMerge = async (keepId: string, removeId: string) => {
    if (!confirm("\u672C\u5F53\u306B\u30DE\u30FC\u30B8\u3057\u307E\u3059\u304B\uFF1F\u3053\u306E\u64CD\u4F5C\u306F\u53D6\u308A\u6D88\u305B\u307E\u305B\u3093\u3002")) return;
    setMerging(removeId);
    try {
      const res = await fetch("/api/customers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepId, removeId }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "\u30DE\u30FC\u30B8\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F" });
        fetchDuplicates();
      } else {
        setMessage({ type: "error", text: data.error || "\u30DE\u30FC\u30B8\u306B\u5931\u6557\u3057\u307E\u3057\u305F" });
      }
    } catch {
      setMessage({ type: "error", text: "\u30DE\u30FC\u30B8\u306B\u5931\u6557\u3057\u307E\u3057\u305F" });
    } finally {
      setMerging(null);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>
        \u540D\u5BC4\u305B\u7BA1\u7406
      </h1>

      {message && (
        <div style={{
          padding: "12px 16px",
          marginBottom: 16,
          borderRadius: 8,
          background: message.type === "success" ? "#f0fdf4" : "#fef2f2",
          color: message.type === "success" ? "#166534" : "#991b1b",
          border: `1px solid ${message.type === "success" ? "#bbf7d0" : "#fecaca"}`,
        }}>
          {message.text}
          <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>&times;</button>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              \u91CD\u8907\u5019\u88DC\u4E00\u89A7
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
              \u540D\u524D\u3068\u96FB\u8A71\u756A\u53F7\u306E\u90E8\u5206\u4E00\u81F4\u3067\u691C\u51FA\u3057\u305F\u91CD\u8907\u5019\u88DC\u3067\u3059
            </p>
          </div>
          <button
            onClick={fetchDuplicates}
            disabled={loading}
            style={{
              padding: "8px 20px",
              background: "#d4a017",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "\u691C\u51FA\u4E2D..." : "\u518D\u691C\u51FA"}
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
            \u691C\u51FA\u4E2D...
          </div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
            \u91CD\u8907\u5019\u88DC\u306F\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: "#d4a017", fontWeight: 600, marginBottom: 16 }}>
              {groups.length} \u4EF6\u306E\u91CD\u8907\u5019\u88DC
            </p>
            {groups.map((group, gi) => (
              <div key={gi} style={{
                border: "1px solid #fde68a",
                borderRadius: 8,
                marginBottom: 16,
                overflow: "hidden",
              }}>
                <div style={{ background: "rgba(212,160,23,0.08)", padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#92400e" }}>
                  \u30B0\u30EB\u30FC\u30D7 {gi + 1} \u2014 {group.customers.length}\u4EF6\u306E\u91CD\u8907
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>\u540D\u524D</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>\u96FB\u8A71</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>\u30E1\u30FC\u30EB</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>\u53CD\u97FF\u5143</th>
                      <th style={{ padding: "8px 12px", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}>\u30E1\u30C3\u30BB\u30FC\u30B8\u6570</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>\u767B\u9332\u65E5</th>
                      <th style={{ padding: "8px 12px", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}>\u64CD\u4F5C</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.customers.map((c, ci) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "10px 12px", fontWeight: ci === 0 ? 600 : 400 }}>
                          {c.name}
                          {ci === 0 && <span style={{ marginLeft: 8, fontSize: 11, background: "#d4a017", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>\u6B8B\u3059</span>}
                        </td>
                        <td style={{ padding: "10px 12px" }}>{c.phone || "-"}</td>
                        <td style={{ padding: "10px 12px" }}>{c.email || "-"}</td>
                        <td style={{ padding: "10px 12px" }}>{c.sourcePortal || "-"}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>{c._count.messages}</td>
                        <td style={{ padding: "10px 12px" }}>{new Date(c.createdAt).toLocaleDateString("ja-JP")}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {ci !== 0 && (
                            <button
                              onClick={() => handleMerge(group.customers[0].id, c.id)}
                              disabled={merging === c.id}
                              style={{
                                padding: "4px 12px",
                                background: merging === c.id ? "#9ca3af" : "#dc2626",
                                color: "#fff",
                                border: "none",
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: merging === c.id ? "not-allowed" : "pointer",
                              }}
                            >
                              {merging === c.id ? "\u51E6\u7406\u4E2D..." : "\u30DE\u30FC\u30B8"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
