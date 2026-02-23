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
      setMessage({ type: "error", text: "取得に失敗しました" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDuplicates(); }, []);

  const handleMerge = async (keepId: string, removeId: string) => {
    if (!confirm("本当にマージしますか？この操作は取り消せません。")) return;
    setMerging(removeId);
    try {
      const res = await fetch("/api/customers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepId, removeId }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "マージが完了しました" });
        fetchDuplicates();
      } else {
        setMessage({ type: "error", text: data.error || "マージに失敗しました" });
      }
    } catch {
      setMessage({ type: "error", text: "マージに失敗しました" });
    } finally {
      setMerging(null);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>名寄せ管理</h1>
      {message && (
        <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: 8, background: message.type === "success" ? "#f0fdf4" : "#fef2f2", color: message.type === "success" ? "#166534" : "#991b1b", border: `1px solid ${message.type === "success" ? "#bbf7d0" : "#fecaca"}` }}>
          {message.text}
          <button onClick={() => setMessage(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>&times;</button>
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>重複候補一覧</h2>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>名前と電話番号の部分一致で検出した重複候補です</p>
          </div>
          <button onClick={fetchDuplicates} disabled={loading} style={{ padding: "8px 20px", background: "#d4a017", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "検出中..." : "再検出"}
          </button>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>検出中...</div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>重複候補は見つかりませんでした</div>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: "#d4a017", fontWeight: 600, marginBottom: 16 }}>{groups.length} 件の重複候補</p>
            {groups.map((group, gi) => (
              <div key={gi} style={{ border: "1px solid #fde68a", borderRadius: 8, marginBottom: 16, overflow: "hidden" }}>
                <div style={{ background: "rgba(212,160,23,0.08)", padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#92400e" }}>グループ {gi + 1} — {group.customers.length}件の重複</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>名前</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>電話</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>メール</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>反響元</th>
                      <th style={{ padding: "8px 12px", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}>メッセージ数</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>登録日</th>
                      <th style={{ padding: "8px 12px", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.customers.map((c, ci) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "10px 12px", fontWeight: ci === 0 ? 600 : 400 }}>
                          {c.name}
                          {ci === 0 && <span style={{ marginLeft: 8, fontSize: 11, background: "#d4a017", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>残す</span>}
                        </td>
                        <td style={{ padding: "10px 12px" }}>{c.phone || "-"}</td>
                        <td style={{ padding: "10px 12px" }}>{c.email || "-"}</td>
                        <td style={{ padding: "10px 12px" }}>{c.sourcePortal || "-"}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>{c._count.messages}</td>
                        <td style={{ padding: "10px 12px" }}>{new Date(c.createdAt).toLocaleDateString("ja-JP")}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {ci !== 0 && (
                            <button onClick={() => handleMerge(group.customers[0].id, c.id)} disabled={merging === c.id} style={{ padding: "4px 12px", background: merging === c.id ? "#9ca3af" : "#dc2626", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: merging === c.id ? "not-allowed" : "pointer" }}>
                              {merging === c.id ? "処理中..." : "マージ"}
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