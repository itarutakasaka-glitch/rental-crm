"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkflowStep, deleteWorkflowStep, toggleWorkflow } from "@/actions/workflows";
import Link from "next/link";

const CH_INFO: Record<string, { l: string; c: string }> = { EMAIL: { l: "透 繝｡繝ｼ繝ｫ", c: "#3b82f6" }, LINE: { l: "泙 LINE", c: "#06c755" }, SMS: { l: "導 SMS", c: "#8b5cf6" } };

export function WorkflowSettings({ workflows, templates }: { workflows: any[]; templates: any[] }) {
  const wf = workflows[0]; // Show first workflow
  const [adding, setAdding] = useState(false);
  const [sName, setSName] = useState(""); const [sDays, setSDays] = useState(1); const [sTime, setSTime] = useState("10:00");
  const [sCh, setSCh] = useState("EMAIL"); const [sTpl, setSTpl] = useState("");
  const [sImmediate, setSImmediate] = useState(false);
  const [isPending, start] = useTransition(); const router = useRouter();

  if (!wf) return <div className="p-6"><Link href="/settings" className="text-gray-400 text-sm">竊・險ｭ螳・/Link><p className="mt-4 text-gray-400">繝ｯ繝ｼ繧ｯ繝輔Ο繝ｼ縺後≠繧翫∪縺帙ｓ</p></div>;

  const filtTpls = templates.filter(t => t.channel === sCh);
  const addStep = () => {
    if (!sName.trim() || !sTpl) return;
    start(async () => {
      await createWorkflowStep({
        workflowId: wf.id, name: sName.trim(), daysAfter: sImmediate ? 0 : sDays,
        timeOfDay: sImmediate ? "00:00" : sTime, channel: sCh as any,
        templateId: sTpl, isImmediate: sImmediate,
      });
      setSName(""); setSDays(1); setSTime("10:00"); setSTpl(""); setSImmediate(false); setAdding(false); router.refresh();
    });
  };

  return (
    <div className="p-6 max-w-[700px]">
      <div className="flex items-center gap-2 mb-4">
        <Link href="/settings" className="text-gray-400 text-sm">竊・險ｭ螳・/Link>
        <h1 className="text-xl font-bold text-gray-900">繧ｷ繝翫Μ繧ｪ驟堺ｿ｡</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="font-bold text-base">{wf.name}</span>
            <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded ${wf.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
              {wf.isActive ? "譛牙柑" : "蛛懈ｭ｢荳ｭ"}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => start(async () => { await toggleWorkflow(wf.id, !wf.isActive); router.refresh(); })}
              className="text-sm px-3 py-1 rounded border" style={{ color: wf.isActive ? "#DC2626" : "#16a34a", borderColor: wf.isActive ? "#fca5a5" : "#86efac" }}>
              {wf.isActive ? "蛛懈ｭ｢" : "譛牙柑蛹・}
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-400 mb-3">{wf.steps?.length || 0}繧ｹ繝・ャ繝・/div>
        {wf.steps?.map((s: any, i: number) => (
          <div key={s.id} className="flex items-center gap-3 py-2 border-t border-gray-100">
            <span className="text-sm font-bold text-amber-600 w-5">{i + 1}</span>
            <span className="text-sm text-gray-500 w-24">
              {s.isImmediate ? <span className="text-red-500 font-semibold">蜊ｳ譎る∽ｻ・/span> : `${s.daysAfter}譌･蠕・${s.timeOfDay}`}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: CH_INFO[s.channel]?.c || "#333", background: `${CH_INFO[s.channel]?.c || "#333"}15` }}>
              {s.channel}
            </span>
            <span className="text-sm text-gray-600 flex-1 truncate">{s.name}</span>
            <button onClick={() => start(async () => { await deleteWorkflowStep(s.id); router.refresh(); })}
              className="text-xs text-red-400 hover:text-red-600">笨・/button>
          </div>
        ))}

        {adding ? (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
            <div className="flex gap-2">
              <input value={sName} onChange={e => setSName(e.target.value)} placeholder="繧ｹ繝・ャ繝怜錐"
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm outline-none" />
              <select value={sCh} onChange={e => { setSCh(e.target.value); setSTpl(""); }}
                className="border border-gray-300 rounded px-3 py-2 text-sm">
                {Object.entries(CH_INFO).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={sImmediate} onChange={e => setSImmediate(e.target.checked)}
                className="w-4 h-4 accent-amber-600 rounded" />
              <span className="text-sm text-gray-700 font-medium">繝ｯ繝ｼ繧ｯ繝輔Ο繝ｼ髢句ｧ句ｾ後☆縺舌↓螳溯｡後☆繧・/span>
            </label>

            {!sImmediate && (
              <div className="flex gap-2 items-center">
                <input type="number" min={0} value={sDays} onChange={e => setSDays(+e.target.value)}
                  className="w-16 border border-gray-300 rounded px-2 py-2 text-sm text-center" />
                <span className="text-sm text-gray-500">譌･蠕・/span>
                <select value={sTime} onChange={e => setSTime(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm">
                  {Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`).map(t =>
                    <option key={t} value={t}>{t}</option>
                  )}
                </select>
              </div>
            )}

            <select value={sTpl} onChange={e => setSTpl(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="">繝・Φ繝励Ξ繝ｼ繝医ｒ驕ｸ謚・/option>
              {filtTpls.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <div className="flex gap-2">
              <button onClick={addStep} disabled={isPending || !sName.trim() || !sTpl}
                className="px-4 py-2 text-sm font-semibold text-white rounded disabled:opacity-40"
                style={{ background: "#D97706" }}>
                {isPending ? "菫晏ｭ倅ｸｭ..." : "霑ｽ蜉"}
              </button>
              <button onClick={() => setAdding(false)} className="px-4 py-2 text-sm border border-gray-300 rounded text-gray-600">
                繧ｭ繝｣繝ｳ繧ｻ繝ｫ
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="mt-3 text-sm font-medium" style={{ color: "#D97706" }}>
            ・・繧ｹ繝・ャ繝励ｒ霑ｽ蜉縺吶ｋ
          </button>
        )}
      </div>
    </div>
  );
}