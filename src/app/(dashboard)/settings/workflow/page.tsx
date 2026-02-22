"use client";
import { useState, useEffect } from "react";
import { CyberpunkSpinner } from "@/components/ui/cyberpunk-spinner";

type Step = { id?: string; name: string; daysAfter: number; timeOfDay: string; channel: string; templateId: string; order: number; isImmediate?: boolean };
type Workflow = { id: string; name: string; isActive: boolean; isDefault: boolean; steps: Step[] };
type Tpl = { id: string; name: string; channel: string };

export default function WorkflowPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [form, setForm] = useState({ name: "", steps: [] as Step[] });
  const [isNew, setIsNew] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const load = async () => {
    const [wRes, tRes] = await Promise.all([fetch("/api/workflows"), fetch("/api/templates")]);
    const wData = await wRes.json(); const tData = await tRes.json();
    setWorkflows(wData.workflows || []); setTpls(tData.templates || []);
    setPageLoading(false);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setForm({ name: "", steps: [{ name: "\u30B9\u30C6\u30C3\u30D71", daysAfter: 1, timeOfDay: "10:00", channel: "EMAIL", templateId: "", order: 0, isImmediate: false }] }); setIsNew(true); setEditing(null); };
  const startEdit = (w: Workflow) => { setForm({ name: w.name, steps: w.steps.map((s, i) => ({ ...s, order: i })) }); setEditing(w); setIsNew(false); };
  const cancel = () => { setIsNew(false); setEditing(null); };

  const addStep = () => setForm(f => ({ ...f, steps: [...f.steps, { name: `\u30B9\u30C6\u30C3\u30D7${f.steps.length + 1}`, daysAfter: f.steps.length + 1, timeOfDay: "10:00", channel: "EMAIL", templateId: "", order: f.steps.length, isImmediate: false }] }));
  const removeStep = (i: number) => setForm(f => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }));
  const updateStep = (i: number, key: string, val: any) => {
    setForm(f => ({ ...f, steps: f.steps.map((s, j) => {
      if (j !== i) return s;
      const updated = { ...s, [key]: val };
      if (key === "isImmediate" && val === true) {
        updated.daysAfter = 0;
        updated.timeOfDay = "00:00";
      }
      return updated;
    })}));
  };

  const save = async () => {
    if (!form.name || form.steps.length === 0) return;
    const method = isNew ? "POST" : "PUT";
    const body = isNew ? form : { id: editing!.id, ...form };
    await fetch("/api/workflows", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    cancel(); load();
  };

  const toggle = async (id: string, isActive: boolean) => {
    await fetch("/api/workflows", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, isActive: !isActive }) });
    load();
  };

  const setDefault = async (id: string) => {
    await fetch("/api/workflows", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, isDefault: true }) });
    load();
  };

  if (pageLoading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><CyberpunkSpinner size={40} /></div>;
  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{"\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC"}</h1>
        <button onClick={startNew} className="text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90" style={{ background: "#d4a017" }}>{"\uFF0B \u65B0\u898F\u4F5C\u6210"}</button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
        <strong>{"\u30C7\u30D5\u30A9\u30EB\u30C8\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC"}</strong>
        {"\uFF1A\u65B0\u898F\u554F\u5408\u305B\uFF08\u53CD\u97FF\uFF09\u304C\u5165\u3063\u305F\u969B\u306B\u81EA\u52D5\u3067\u958B\u59CB\u3055\u308C\u307E\u3059\u3002\u5404\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u306E\u300C\u30C7\u30D5\u30A9\u30EB\u30C8\u306B\u8A2D\u5B9A\u300D\u30DC\u30BF\u30F3\u3067\u5207\u308A\u66FF\u3048\u3067\u304D\u307E\u3059\u3002"}
      </div>

      {(isNew || editing) && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">{"\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u540D"}</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm" />
          </div>
          <div className="text-xs font-semibold text-gray-500 mb-2">{"\u30B9\u30C6\u30C3\u30D7"}</div>
          {form.steps.map((s, i) => (
            <div key={i} className="flex gap-2 items-center mb-2 p-2 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-400 w-6">{i + 1}.</span>
              <div className="flex-1 grid grid-cols-6 gap-2">
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" checked={!!s.isImmediate} onChange={e => updateStep(i, "isImmediate", e.target.checked)} className="w-3 h-3 accent-amber-600" />
                  {"\u5373\u6642"}
                </label>
                <input value={s.name} onChange={e => updateStep(i, "name", e.target.value)} placeholder={"\u30B9\u30C6\u30C3\u30D7\u540D"} className="px-2 py-1 border rounded text-xs" />
                <div className="flex items-center gap-1">
                  <input type="number" value={s.isImmediate ? 0 : s.daysAfter} onChange={e => updateStep(i, "daysAfter", +e.target.value)} min={0} disabled={!!s.isImmediate} className={`w-14 px-2 py-1 border rounded text-xs ${s.isImmediate ? "bg-gray-200 text-gray-400 cursor-not-allowed" : ""}`} />
                  <span className={`text-xs ${s.isImmediate ? "text-gray-300" : "text-gray-400"}`}>{"\u65E5\u5F8C"}</span>
                </div>
                <input type="time" value={s.isImmediate ? "00:00" : s.timeOfDay} onChange={e => updateStep(i, "timeOfDay", e.target.value)} disabled={!!s.isImmediate} className={`px-2 py-1 border rounded text-xs ${s.isImmediate ? "bg-gray-200 text-gray-400 cursor-not-allowed" : ""}`} />
                <select value={s.channel} onChange={e => updateStep(i, "channel", e.target.value)} className="px-2 py-1 border rounded text-xs">
                  <option value="EMAIL">Email</option><option value="LINE">LINE</option><option value="SMS">SMS</option>
                </select>
                <select value={s.templateId} onChange={e => updateStep(i, "templateId", e.target.value)} className="px-2 py-1 border rounded text-xs">
                  <option value="">{"\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u9078\u629E"}</option>
                  {tpls.filter(t => t.channel === s.channel).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <button onClick={() => removeStep(i)} className="text-red-400 text-xs hover:text-red-600">{"\u2715"}</button>
            </div>
          ))}
          <button onClick={addStep} className="text-xs hover:underline mt-1" style={{ color: "#d4a017" }}>{"\uFF0B \u30B9\u30C6\u30C3\u30D7\u8FFD\u52A0"}</button>
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={cancel} className="px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">{"\u30AD\u30E3\u30F3\u30BB\u30EB"}</button>
            <button onClick={save} className="px-4 py-1.5 text-sm text-white rounded-lg font-semibold" style={{ background: "#d4a017" }}>{"\u4FDD\u5B58"}</button>
          </div>
        </div>
      )}

      {workflows.map(w => (
        <div key={w.id} className={`bg-white border rounded-xl p-4 mb-2 ${w.isDefault ? "border-amber-300 ring-1 ring-amber-200" : ""}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold flex items-center gap-2">
                {w.name}
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${w.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>{w.isActive ? "\u6709\u52B9" : "\u505C\u6B62"}</span>
                {w.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-50 text-amber-600 border border-amber-200">{"\u30C7\u30D5\u30A9\u30EB\u30C8"}</span>}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{w.steps.length}{"\u30B9\u30C6\u30C3\u30D7"}</div>
            </div>
            <div className="flex gap-1">
              {!w.isDefault && (
                <button onClick={() => setDefault(w.id)} className="text-xs px-2 py-1 rounded text-amber-600 hover:bg-amber-50">{"\u30C7\u30D5\u30A9\u30EB\u30C8\u306B\u8A2D\u5B9A"}</button>
              )}
              <button onClick={() => toggle(w.id, w.isActive)} className={`text-xs px-2 py-1 rounded ${w.isActive ? "text-red-500 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}>{w.isActive ? "\u505C\u6B62" : "\u6709\u52B9\u5316"}</button>
              <button onClick={() => startEdit(w)} className="text-xs px-2 py-1 rounded hover:bg-gray-50" style={{ color: "#d4a017" }}>{"\u7DE8\u96C6"}</button>
            </div>
          </div>
          <div className="mt-2 space-y-1">
            {w.steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-5 h-5 rounded-full flex items-center justify-center font-semibold" style={{ background: "rgba(212,160,23,0.1)", color: "#d4a017" }}>{i + 1}</span>
                <span>{s.isImmediate ? "\u5373\u6642\u9001\u4ED8" : s.daysAfter + "\u65E5\u5F8C " + s.timeOfDay}</span>
                <span className={`px-1.5 py-0.5 rounded font-semibold ${s.channel === "EMAIL" ? "bg-blue-50 text-blue-600" : s.channel === "LINE" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>{s.channel}</span>
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {workflows.length === 0 && !isNew && (
        <div className="text-center text-gray-400 text-sm py-12">{"\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u304C\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002\u300C\uFF0B \u65B0\u898F\u4F5C\u6210\u300D\u304B\u3089\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}</div>
      )}
    </div>
  );
}
