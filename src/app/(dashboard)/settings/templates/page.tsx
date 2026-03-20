"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { CyberpunkSpinner } from "@/components/ui/cyberpunk-spinner";

type Category = { id: string; name: string };
type Template = { id: string; name: string; channel: string; subject: string | null; body: string; categoryId: string; category: Category };

const VARS = [
  { key: "{{customer_name}}", label: "\u9867\u5BA2\u540D" },
  { key: "{{customer_email}}", label: "\u9867\u5BA2\u30E1\u30FC\u30EB" },
  { key: "{{customer_phone}}", label: "\u9867\u5BA2\u96FB\u8A71" },
  { key: "{{staff_name}}", label: "\u62C5\u5F53\u8005\u540D" },
  { key: "{{property_name}}", label: "\u7269\u4EF6\u540D" },
  { key: "{{property_url}}", label: "\u7269\u4EF6URL" },
  { key: "{{company_name}}", label: "\u4F1A\u793E\u540D" },
  { key: "{{store_name}}", label: "\u5E97\u8217\u540D" },
  { key: "{{store_address}}", label: "\u5E97\u8217\u4F4F\u6240" },
  { key: "{{store_phone}}", label: "\u5E97\u8217\u96FB\u8A71" },
  { key: "{{store_hours}}", label: "\u55B6\u696D\u6642\u9593" },
  { key: "{{line_url}}", label: "LINE URL" },
  { key: "{{visit_url}}", label: "\u4E88\u7D04\u30D5\u30A9\u30FC\u30E0URL" },
  { key: "{{license_number}}", label: "\u514D\u8A31\u756A\u53F7" },
];

const URL_BTNS = [
  { id: "visit", label: "\uD83D\uDDD3 \u6765\u5E97\u4E88\u7D04URL", varKey: "{{visit_url}}", text: "\u6765\u5E97\u30FB\u5185\u898B\u4E88\u7D04\u306F\u3053\u3061\u3089", color: "#0891b2" },
  { id: "line", label: "\uD83D\uDCAC LINE\u8FFD\u52A0URL", varKey: "{{line_url}}", text: "LINE\u3067\u304A\u6C17\u8EFD\u306B\u3054\u9023\u7D61", color: "#06c755" },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: "", categoryId: "", channel: "EMAIL", subject: "", body: "" });
  const [isNew, setIsNew] = useState(false);
  const [linkPopup, setLinkPopup] = useState<{ type: "link" | "line" | "visit" | "linkMenu"; linkText: string; linkUrl: string } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const savedSel = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const handleBodySelect = useCallback(() => {
    const ta = bodyRef.current;
    if (ta) savedSel.current = { start: ta.selectionStart, end: ta.selectionEnd };
  }, []);

  const load = () => fetch("/api/templates").then(r => r.json()).then(d => { setTemplates(d.templates); setCategories(d.categories); }).finally(() => setPageLoading(false));
  useEffect(() => { load(); }, []);

  const startNew = () => { const catId = categories.length > 0 ? categories[0].id : "cat_general"; setForm({ name: "", categoryId: catId, channel: "EMAIL", subject: "", body: "" }); setIsNew(true); setEditing(null); };
  const startEdit = (t: Template) => { setForm({ name: t.name, categoryId: t.categoryId, channel: t.channel, subject: t.subject || "", body: t.body }); setEditing(t); setIsNew(false); };
  const cancel = () => { setIsNew(false); setEditing(null); setLinkPopup(null); };

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

  const insertAtCursor = (text: string) => {
    const ta = bodyRef.current;
    if (ta) {
      const s = ta.selectionStart, e = ta.selectionEnd;
      const nb = form.body.slice(0, s) + text + form.body.slice(e);
      setForm(f => ({ ...f, body: nb }));
      setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + text.length; }, 0);
    } else {
      setForm(f => ({ ...f, body: f.body + text }));
    }
  };

  const openLinkPopup = (type: "link" | "line" | "visit" | "linkMenu") => {
    const { start, end } = savedSel.current;
    const selectedText = form.body.slice(start, end).trim();
    const defaultUrl = type === "line" ? "{{line_url}}" : type === "visit" ? "{{visit_url}}" : "";
    setLinkPopup({ type, linkText: selectedText, linkUrl: defaultUrl });
  };

  const confirmLinkInsert = (mode: "text" | "button") => {
    if (!linkPopup) return;
    const { linkText, linkUrl } = linkPopup;
    if (!linkText.trim() || !linkUrl.trim()) return;
    const { start, end } = savedSel.current;
    const selectedText = form.body.slice(start, end).trim();
    const snippet = mode === "button" ? `[■ ${linkText.trim()}] ${linkUrl.trim()}` : `[${linkText.trim()}](${linkUrl.trim()})`;
    const newBody = selectedText
      ? form.body.slice(0, start) + snippet + form.body.slice(end)
      : form.body.slice(0, start) + snippet + form.body.slice(start);
    setForm(f => ({ ...f, body: newBody }));
    setLinkPopup(null);
    const ta = bodyRef.current;
    if (ta) setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + snippet.length; }, 0);
  };

  const grouped = categories.map(c => ({ ...c, items: templates.filter(t => t.categoryId === c.id) }));

  if (pageLoading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><CyberpunkSpinner size={40} /></div>;
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
            <textarea ref={bodyRef} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} onSelect={handleBodySelect} onMouseUp={handleBodySelect} onKeyUp={handleBodySelect} rows={8} className="w-full px-3 py-2 border rounded-lg text-sm resize-none font-mono" />
            {/* Toolbar (CANARY Cloud style) */}
            <div className="flex items-center gap-1 flex-wrap border rounded-lg px-2 py-1.5 bg-gray-50">
              <button type="button" onClick={() => openLinkPopup("linkMenu")} className="px-2 py-1 text-xs rounded hover:bg-gray-200" title="リンク">🔗 リンク</button>
              <button type="button" onClick={() => openLinkPopup("line")} className="px-2 py-1 text-xs rounded hover:bg-green-100 text-green-700 font-semibold" title="LINE友だち追加リンク">💬 LINE追加</button>
              <button type="button" onClick={() => openLinkPopup("visit")} className="px-2 py-1 text-xs rounded hover:bg-cyan-100 text-cyan-700 font-semibold" title="来店予約リンク">🗓 来店予約</button>
              <div className="border-l mx-1 h-4" />
              <span className="text-[10px] text-gray-400 mr-1">変数:</span>
              {VARS.map(v => <button key={v.key} onClick={() => insertAtCursor(v.key)} className="text-[10px] px-1.5 py-0.5 bg-white border rounded text-gray-500 hover:bg-gray-100" title={v.key}>{v.label}</button>)}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={cancel} className="px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">{"\u30AD\u30E3\u30F3\u30BB\u30EB"}</button>
            <button onClick={save} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-semibold">{"\u4FDD\u5B58"}</button>
          </div>
          {/* Link popup (CANARY Cloud style) */}
          {linkPopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setLinkPopup(null)}>
              <div className="bg-white rounded-xl shadow-xl border p-5 w-[360px]" onClick={e => e.stopPropagation()}>
                <div className="text-sm font-bold mb-3">
                  {linkPopup.type === "line" ? "LINE友だち追加" : linkPopup.type === "visit" ? "来店予約リンク" : linkPopup.type === "linkMenu" ? "リンク" : "URL"}
                </div>
                {linkPopup.type === "linkMenu" ? (
                  <div className="space-y-2">
                    <button onClick={() => setLinkPopup({ ...linkPopup, type: "link" })} className="w-full text-left px-3 py-2.5 text-xs rounded-lg border hover:bg-gray-50">🔗 テキストリンクを挿入<div className="text-[10px] text-gray-400 mt-0.5">選択テキストにリンクを設定</div></button>
                    <button onClick={() => setLinkPopup({ ...linkPopup, type: "link", linkUrl: "" })} className="w-full text-left px-3 py-2.5 text-xs rounded-lg border hover:bg-gray-50">■ ボタンを挿入<div className="text-[10px] text-gray-400 mt-0.5">CTAボタン形式で挿入</div></button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div><label className="text-xs text-gray-600 mb-1 block">表示するテキスト</label><input value={linkPopup.linkText} onChange={e => setLinkPopup({ ...linkPopup, linkText: e.target.value })} placeholder="テキストを入力" className="w-full px-3 py-2 border rounded-lg text-sm" autoFocus /></div>
                    {linkPopup.type === "link" && (<div><label className="text-xs text-gray-600 mb-1 block">リンク先</label><input value={linkPopup.linkUrl} onChange={e => setLinkPopup({ ...linkPopup, linkUrl: e.target.value })} placeholder="URLを入力 または {{変数名}}" className="w-full px-3 py-2 border rounded-lg text-sm" /></div>)}
                    {(linkPopup.type === "line" || linkPopup.type === "visit") && (<div className="text-[10px] text-gray-400">リンク先: {linkPopup.linkUrl}（自動設定）</div>)}
                    <div className="flex justify-end gap-2 pt-1">
                      <button onClick={() => setLinkPopup(null)} className="px-3 py-1.5 text-xs bg-gray-100 rounded-lg">キャンセル</button>
                      <button onClick={() => confirmLinkInsert(linkPopup.type === "link" && linkPopup.linkUrl && !linkPopup.linkUrl.startsWith("{{") ? "text" : "button")} disabled={!linkPopup.linkText.trim() || !linkPopup.linkUrl.trim()} className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-40">挿入</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
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
