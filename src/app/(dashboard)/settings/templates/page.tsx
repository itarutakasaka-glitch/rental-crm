"use client";
import { useState, useEffect } from "react";

type Category = { id: string; name: string };
type Template = { id: string; name: string; channel: string; subject: string | null; body: string; categoryId: string; category: Category };

const VARS = [
  { key: "{{customer_name}}", label: "\u9867\u5BA2\u540D" },
  { key: "{{staff_name}}", label: "\u62C5\u5F53\u8005\u540D" },
  { key: "{{property_name}}", label: "\u7269\u4EF6\u540D" },
  { key: "{{company_name}}", label: "\u4F1A\u793E\u540D" },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: "", categoryId: "", channel: "EMAIL", subject: "", body: "" });
  const [isNew, setIsNew] = useState(false);

  const load = () => fetch("/api/templates").then(r => r.json()).then(d => { setTemplates(d.templates); setCategories(d.categories); });
  useEffect(() => { load(); }, []);

  const startNew = () => { setForm({ name: "", categoryId: categories[0]?.id || "", channel: "EMAIL", subject: "", body: "" }); setIsNew(true); setEditing(null); };
  const startEdit = (t: Template) => { setForm({ name: t.name, categoryId: t.categoryId, channel: t.channel, subject: t.subject || "", body: t.body }); setEditing(t); setIsNew(false); };
  const cancel = () => { setIsNew(false); setEditing(null); };

  const save = async () => {
    if (!form.name || !form.body) return;
    if (isNew) { await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); }
    else if (editing) { await fetch("/api/templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...form }) }); }
    cancel(); load();
  };

  const remove = async (id: string) => {
    await fetch("/api/templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  };

  const insertVar = (v: string) => setForm(f => ({ ...f, body: f.body + v }));

  const grouped = categories.map(c => ({ ...c, items: templates.filter(t => t.categoryId === c.id) }));

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{"\u5B9A\u578B\u6587\u7BA1\u7406"}</h1>
        <button onClick={startNew} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">{"\uFF0B \u65B0\u898F\u4F5C\u6210"}</button>
      </div>

      {(isNew || editing) && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{"\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u540D"}</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">{"\u30AB\u30C6\u30B4\u30EA"}</label>
                <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm">
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">{"\u30C1\u30E3\u30CD\u30EB"}</label>
                <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm">
                  <option value="EMAIL">Email</option><option value="LINE">LINE</option><option value="SMS">SMS</option>
                </select>
              </div>
            </div>
          </div>
          {form.channel === "EMAIL" && (
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">{"\u4EF6\u540D"}</label>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm" />
            </div>
          )}
          <div className="mb-2">
            <label className="text-xs text-gray-500 mb-1 block">{"\u672C\u6587"}</label>
            <div className="flex gap-1 mb-1">
              {VARS.map(v => <button key={v.key} onClick={() => insertVar(v.key)} className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">{v.label}</button>)}
            </div>
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={6} className="w-full px-3 py-2 border rounded-lg text-sm resize-none font-mono" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={cancel} className="px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">{"\u30AD\u30E3\u30F3\u30BB\u30EB"}</button>
            <button onClick={save} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-semibold">{"\u4FDD\u5B58"}</button>
          </div>
        </div>
      )}

      {grouped.map(g => g.items.length > 0 && (
        <div key={g.id} className="mb-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">{g.name}</h2>
          <div className="bg-white border rounded-xl divide-y">
            {g.items.map(t => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{t.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${t.channel === "EMAIL" ? "bg-blue-50 text-blue-600" : t.channel === "LINE" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>{t.channel}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{t.body.slice(0, 80)}</div>
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => startEdit(t)} className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded">{"\u7DE8\u96C6"}</button>
                  <button onClick={() => remove(t.id)} className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded">{"\u524A\u9664"}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {templates.length === 0 && !isNew && (
        <div className="text-center text-gray-400 text-sm py-12">{"\u5B9A\u578B\u6587\u304C\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002\u300C\uFF0B \u65B0\u898F\u4F5C\u6210\u300D\u304B\u3089\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}</div>
      )}
    </div>
  );
}
