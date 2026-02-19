"use client";
import { useState, useEffect } from "react";

type Step = { id?: string; name: string; daysAfter: number; timeOfDay: string; channel: string; templateId: string; order: number };
type Workflow = { id: string; name: string; isActive: boolean; steps: Step[] };
type Tpl = { id: string; name: string; channel: string };

export default function WorkflowPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [form, setForm] = useState({ name: "", steps: [] as Step[] });
  const [isNew, setIsNew] = useState(false);

  const load = async () => {
    const [wRes, tRes] = await Promise.all([fetch("/api/workflows"), fetch("/api/templates")]);
    const wData = await wRes.json(); const tData = await tRes.json();
    setWorkflows(wData.workflows || []); setTpls(tData.templates || []);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setForm({ name: "", steps: [{ name: "\u30B9\u30C6\u30C3\u30D71", daysAfter: 1, timeOfDay: "10:00", channel: "EMAIL", templateId: "", order: 0 }] }); setIsNew(true); setEditing(null); };
  const startEdit = (w: Workflow) => { setForm({ name: w.name, steps: w.steps.map((s, i) => ({ ...s, order: i })) }); setEditing(w); setIsNew(false); };
  const cancel = () => { setIsNew(false); setEditing(null); };

  const addStep = () => setForm(f => ({ ...f, steps: [...f.steps, { name: `\u30B9\u30C6\u30C3\u30D7${f.steps.length + 1}`, daysAfter: f.steps.length + 1, timeOfDay: "10:00", channel: "EMAIL", templateId: "", order: f.steps.length }] }));
  const removeStep = (i: number) => setForm(f => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }));
  const updateStep = (i: number, key: string, val: any) => setForm(f => ({ ...f, steps: f.steps.map((s, j) => j === i ? { ...s, [key]: val } : s) }));

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

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{"\u30B7\u30CA\u30EA\u30AA\u914D\u4FE1"}</h1>
        <button onClick={startNew} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">{"\uFF0B \u65B0\u898F\u4F5C\u6210"}</button>
      </div>

      {(isNew || editing) && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">{"\u30B7\u30CA\u30EA\u30AA\u540D"}</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm" />
          </div>
          <div className="text-xs font-semibold text-gray-500 mb-2">{"\u30B9\u30C6\u30C3\u30D7"}</div>
          {form.steps.map((s, i) => (
            <div key={i} className="flex gap-2 items-center mb-2 p-2 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-400 w-6">{i + 1}.</span>
              <div className="flex-1 grid grid-cols-5 gap-2">
                <input value={s.name} onChange={e => updateStep(i, "name", e.target.value)} placeholder={"\u30B9\u30C6\u30C3\u30D7\u540D"} className="px-2 py-1 border rounded text-xs" />
                <div className="flex items-center gap-1">
                  <input type="number" value={s.daysAfter} onChange={e => updateStep(i, "daysAfter", +e.target.value)} min={0} className="w-14 px-2 py-1 border rounded text-xs" />
                  <span className="text-xs text-gray-400">{"\u65E5\u5F8C"}</span>
                </div>
                <input type="time" value={s.timeOfDay} onChange={e => updateStep(i, "timeOfDay", e.target.value)} className="px-2 py-1 border rounded text-xs" />
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
          <button onClick={addStep} className="text-xs text-blue-600 hover:underline mt-1">{"\uFF0B \u30B9\u30C6\u30C3\u30D7\u8FFD\u52A0"}</button>
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={cancel} className="px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">{"\u30AD\u30E3\u30F3\u30BB\u30EB"}</button>
            <button onClick={save} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-semibold">{"\u4FDD\u5B58"}</button>
          </div>
        </div>
      )}

      {workflows.map(w => (
        <div key={w.id} className="bg-white border rounded-xl p-4 mb-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold flex items-center gap-2">{w.name}
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${w.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>{w.isActive ? "\u6709\u52B9" : "\u505C\u6B62"}</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{w.steps.length}{"\u30B9\u30C6\u30C3\u30D7"}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => toggle(w.id, w.isActive)} className={`text-xs px-2 py-1 rounded ${w.isActive ? "text-red-500 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}>{w.isActive ? "\u505C\u6B62" : "\u6709\u52B9\u5316"}</button>
              <button onClick={() => startEdit(w)} className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded">{"\u7DE8\u96C6"}</button>
            </div>
          </div>
          <div className="mt-2 space-y-1">
            {w.steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-semibold">{i + 1}</span>
                <span>{s.daysAfter}{"\u65E5\u5F8C"} {s.timeOfDay}</span>
                <span className={`px-1.5 py-0.5 rounded font-semibold ${s.channel === "EMAIL" ? "bg-blue-50 text-blue-600" : s.channel === "LINE" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>{s.channel}</span>
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {workflows.length === 0 && !isNew && (
        <div className="text-center text-gray-400 text-sm py-12">{"\u30B7\u30CA\u30EA\u30AA\u304C\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002\u300C\uFF0B \u65B0\u898F\u4F5C\u6210\u300D\u304B\u3089\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}</div>
      )}
    </div>
  );
}
