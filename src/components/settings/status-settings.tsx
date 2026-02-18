"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStatus, deleteStatus, reorderStatuses } from "@/actions/statuses";
import Link from "next/link";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#6b7280"];

export function StatusSettings({ statuses, organizationId }: { statuses: any[]; organizationId: string }) {
  const [adding, setAdding] = useState(false); const [name, setName] = useState(""); const [color, setColor] = useState("#6b7280");
  const [isPending, start] = useTransition(); const router = useRouter();

  const add = () => { if (!name.trim()) return; start(async () => { await createStatus({ organizationId, name: name.trim(), color }); setAdding(false); setName(""); router.refresh(); }); };
  const del = (id: string) => { const def = statuses.find(s => s.isDefault); if (!def || def.id === id) return; start(async () => { await deleteStatus(id, def.id); router.refresh(); }); };
  const move = (i: number, dir: -1 | 1) => { const ids = statuses.map(s => s.id); [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]]; start(async () => { await reorderStatuses(ids); router.refresh(); }); };

  return (
    <div className="p-6 max-w-[600px]">
      <div className="flex items-center gap-2 mb-4">
        <Link href="/settings" className="text-gray-400 text-sm">← 設定</Link>
        <h1 className="text-lg font-bold">ステータス設定</h1>
        <span className="text-xs text-gray-400">({statuses.length}/20)</span>
        <button onClick={() => { setAdding(true); setName(""); }} className="ml-auto px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold">＋ 追加</button>
      </div>
      {adding && (
        <div className="mb-3 p-4 bg-white rounded-xl border-2 border-primary/20">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="ステータス名" className="w-full px-3 py-2 border rounded-lg text-sm mb-2" />
          <div className="flex gap-1 mb-2 flex-wrap">{COLORS.map(c => <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded-full" style={{ background: c, border: color === c ? "2px solid #000" : "2px solid transparent" }} />)}</div>
          <div className="flex gap-2 justify-end"><button onClick={() => setAdding(false)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs">取消</button><button onClick={add} className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold">作成</button></div>
        </div>
      )}
      <div className="bg-white rounded-xl border">
        {statuses.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => i > 0 && move(i, -1)} className="text-[9px] text-gray-300" disabled={i === 0}>▲</button>
              <button onClick={() => i < statuses.length - 1 && move(i, 1)} className="text-[9px] text-gray-300" disabled={i === statuses.length - 1}>▼</button>
            </div>
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="flex-1 text-sm font-medium">{s.name}</span>
            {s.isDefault && <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded font-semibold">デフォルト</span>}
            <button onClick={() => del(s.id)} className="text-xs text-gray-300 hover:text-red-400">🗑</button>
          </div>
        ))}
      </div>
    </div>
  );
}
