"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTemplate, updateTemplate, deleteTemplate, duplicateTemplate } from "@/actions/templates";
import Link from "next/link";

const CH_OPTS = [{ v: "EMAIL", l: "✉️ メール", c: "#3b82f6" }, { v: "LINE", l: "💬 LINE", c: "#06c755" }, { v: "SMS", l: "📱 SMS", c: "#d4a017" }];
const VARS = ["{顧客名}", "{担当者名}", "{店舗名}", "{物件名}", "{マイページURL}", "{来店予約URL}"];

export function TemplateSettings({ categories, organizationId }: { categories: any[]; organizationId: string }) {
  const allTemplates = categories.flatMap((c: any) => c.templates.map((t: any) => ({ ...t, catName: c.name, categoryId: c.id })));
  const [sel, setSel] = useState<string | null>(null); const [adding, setAdding] = useState(false);
  const [name, setName] = useState(""); const [ch, setCh] = useState("EMAIL"); const [subj, setSubj] = useState(""); const [body, setBody] = useState("");
  const [isPending, start] = useTransition(); const router = useRouter();

  const edit = (t: any) => { setSel(t.id); setName(t.name); setCh(t.channel); setSubj(t.subject || ""); setBody(t.body); setAdding(false); };
  const startAdd = () => { setAdding(true); setSel(null); setName(""); setCh("EMAIL"); setSubj(""); setBody(""); };
  const save = () => {
    if (!name.trim() || !body.trim()) return;
    start(async () => {
      if (adding && categories[0]) { await createTemplate({ organizationId, categoryId: categories[0].id, name: name.trim(), channel: ch as any, subject: subj, body }); setAdding(false); }
      else if (sel) { await updateTemplate(sel, { name: name.trim(), channel: ch as any, subject: subj, body }); setSel(null); }
      router.refresh();
    });
  };

  const isEditing = sel || adding;
  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Link href="/settings" className="text-gray-400 text-sm">← 設定</Link>
        <h1 className="text-lg font-bold">テンプレート設定</h1>
        <button onClick={startAdd} className="ml-auto px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold">＋ 追加</button>
      </div>
      <div className="flex gap-4">
        <div className={isEditing ? "w-[45%]" : "flex-1"}>
          <div className="bg-white rounded-xl border">{allTemplates.map((t: any) => {
            const chC = CH_OPTS.find(c => c.v === t.channel); const active = sel === t.id;
            return (
              <div key={t.id} onClick={() => edit(t)} className={`flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 cursor-pointer ${active ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: (chC?.c || "#6b7280") + "15", color: chC?.c }}>{chC?.l}</span>
                <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{t.name}</div><div className="text-[10px] text-gray-400">{t.catName}</div></div>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => start(async () => { await duplicateTemplate(t.id); router.refresh(); })} className="text-[10px] text-gray-300">📋</button>
                  <button onClick={() => start(async () => { await deleteTemplate(t.id); router.refresh(); if (sel === t.id) setSel(null); })} className="text-[10px] text-gray-300">🗑</button>
                </div>
              </div>
            );
          })}</div>
        </div>
        {isEditing && (
          <div className="w-[55%] bg-white rounded-xl border p-4 self-start sticky top-4">
            <div className="flex justify-between mb-3"><h3 className="text-sm font-bold">{adding ? "新規作成" : "編集"}</h3><button onClick={() => { setSel(null); setAdding(false); }} className="text-xs text-gray-400">✕</button></div>
            <div className="space-y-2">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="テンプレート名" className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="flex gap-1">{CH_OPTS.map(o => <button key={o.v} onClick={() => setCh(o.v)} className={`px-2.5 py-1 rounded-md text-xs ${ch === o.v ? "text-white font-semibold" : "text-gray-500"}`} style={{ background: ch === o.v ? o.c : "#f1f5f9" }}>{o.l}</button>)}</div>
              {ch === "EMAIL" && <input value={subj} onChange={e => setSubj(e.target.value)} placeholder="件名" className="w-full px-3 py-2 border rounded-lg text-sm" />}
              <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="本文" rows={6} className="w-full px-3 py-2 border rounded-lg text-sm font-mono resize-none" />
              <div><div className="text-[10px] text-gray-400 mb-1">変数</div><div className="flex gap-1 flex-wrap">{VARS.map(v => <button key={v} onClick={() => setBody(b => b + v)} className="px-1.5 py-0.5 text-[10px] bg-gray-50 border rounded text-gray-500">{v}</button>)}</div></div>
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => { setSel(null); setAdding(false); }} className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs">キャンセル</button>
                <button onClick={save} disabled={!name.trim() || !body.trim() || isPending} className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold disabled:opacity-40">{adding ? "作成" : "更新"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
