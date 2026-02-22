"use client";

import { useState, useEffect, useCallback } from "react";
import { CyberpunkSpinner } from "@/components/ui/cyberpunk-spinner";

const COLORS = [
  { value: "#EF4444", label: "赤" }, { value: "#3B82F6", label: "青" },
  { value: "#d4a017", label: "オレンジ" }, { value: "#8B5CF6", label: "紫" },
  { value: "#EC4899", label: "ピンク" }, { value: "#6B7280", label: "グレー" },
  { value: "#10B981", label: "緑" }, { value: "#06B6D4", label: "シアン" },
];

export default function StatusSettingsPage() {
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#3B82F6");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3B82F6");
  const [saving, setSaving] = useState(false);

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch("/api/statuses");
      if (res.ok) setStatuses(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, color: newColor, order: statuses.length }),
      });
      if (res.ok) { setNewName(""); setNewColor("#3B82F6"); setShowAdd(false); fetchStatuses(); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/statuses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName, color: editColor }),
      });
      if (res.ok) { setEditingId(null); fetchStatuses(); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このステータスを削除しますか？")) return;
    try {
      await fetch("/api/statuses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchStatuses();
    } catch (e) { console.error(e); }
  };

  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const newList = [...statuses];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    setStatuses(newList);
    await fetch("/api/statuses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders: newList.map((s, i) => ({ id: s.id, order: i })) }),
    });
  };

  const handleMoveDown = async (index: number) => {
    if (index >= statuses.length - 1) return;
    const newList = [...statuses];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    setStatuses(newList);
    await fetch("/api/statuses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders: newList.map((s, i) => ({ id: s.id, order: i })) }),
    });
  };

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><CyberpunkSpinner size={36} /></div>;

  return (
    <div style={{ padding: "24px 32px", overflow: "auto", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="/settings" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>← 設定</a>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>ステータス設定</h1>
          <span style={{ fontSize: 13, color: "#9ca3af" }}>({statuses.length}/20)</span>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          padding: "8px 20px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 6,
          background: "#d4a017", color: "#fff", cursor: "pointer",
        }}>＋ 追加</button>
      </div>

      {showAdd && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>新規ステータス</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>名前</div>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ステータス名"
                style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, width: 200, outline: "none" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>色</div>
              <div style={{ display: "flex", gap: 4 }}>
                {COLORS.map((c) => (
                  <button key={c.value} onClick={() => setNewColor(c.value)} style={{
                    width: 24, height: 24, borderRadius: "50%", background: c.value, border: newColor === c.value ? "3px solid #111" : "2px solid #e5e7eb",
                    cursor: "pointer",
                  }} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleAdd} disabled={saving || !newName.trim()} style={{
              padding: "6px 20px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 6,
              background: saving || !newName.trim() ? "#d1d5db" : "#d4a017", color: "#fff", cursor: saving ? "not-allowed" : "pointer",
            }}>{saving ? "保存中..." : "保存"}</button>
            <button onClick={() => { setShowAdd(false); setNewName(""); }} style={{
              padding: "6px 16px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer", color: "#374151",
            }}>キャンセル</button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
        {statuses.map((status, index) => (
          <div key={status.id} style={{
            display: "flex", alignItems: "center", padding: "12px 16px",
            borderBottom: index < statuses.length - 1 ? "1px solid #f3f4f6" : "none",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: 8 }}>
              <button onClick={() => handleMoveUp(index)} style={{
                border: "none", background: "transparent", cursor: index > 0 ? "pointer" : "default",
                color: index > 0 ? "#9ca3af" : "#e5e7eb", fontSize: 10, padding: 0, lineHeight: 1,
              }}>▲</button>
              <button onClick={() => handleMoveDown(index)} style={{
                border: "none", background: "transparent", cursor: index < statuses.length - 1 ? "pointer" : "default",
                color: index < statuses.length - 1 ? "#9ca3af" : "#e5e7eb", fontSize: 10, padding: 0, lineHeight: 1,
              }}>▼</button>
            </div>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: status.color || "#6B7280", marginRight: 12, flexShrink: 0 }} />

            {editingId === status.id ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                  style={{ padding: "5px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 4, width: 160, outline: "none" }} />
                <div style={{ display: "flex", gap: 3 }}>
                  {COLORS.map((c) => (
                    <button key={c.value} onClick={() => setEditColor(c.value)} style={{
                      width: 20, height: 20, borderRadius: "50%", background: c.value,
                      border: editColor === c.value ? "3px solid #111" : "1px solid #e5e7eb", cursor: "pointer",
                    }} />
                  ))}
                </div>
                <button onClick={() => handleEdit(status.id)} disabled={saving} style={{
                  padding: "4px 12px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 4,
                  background: "#d4a017", color: "#fff", cursor: "pointer",
                }}>{saving ? "..." : "保存"}</button>
                <button onClick={() => setEditingId(null)} style={{
                  padding: "4px 12px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", cursor: "pointer", color: "#374151",
                }}>取消</button>
              </div>
            ) : (
              <>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#111827", flex: 1 }}>{status.name}</span>
                {status.isDefault && <span style={{ fontSize: 11, color: "#d4a017", fontWeight: 600, marginRight: 12 }}>デフォルト</span>}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { setEditingId(status.id); setEditName(status.name); setEditColor(status.color || "#6B7280"); }}
                    style={{ padding: "4px 12px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", cursor: "pointer", color: "#374151" }}>
                    編集
                  </button>
                  {!status.isDefault && (
                    <button onClick={() => handleDelete(status.id)} style={{
                      padding: "4px 8px", fontSize: 12, border: "1px solid #fca5a5", borderRadius: 4, background: "#fff", cursor: "pointer", color: "#DC2626",
                    }}>削除</button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}