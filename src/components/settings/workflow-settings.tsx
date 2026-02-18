"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkflowStep, deleteWorkflowStep, toggleWorkflow } from "@/actions/workflows";
import Link from "next/link";

const CH_INFO: Record<string, { l: string; c: string }> = { EMAIL: { l: "✉️ メール", c: "#3b82f6" }, LINE: { l: "💬 LINE", c: "#06c755" }, SMS: { l: "📱 SMS", c: "#f59e0b" } };

export function WorkflowSettings({ workflows, templates }: { workflows: any[]; templates: any[] }) {
  const wf = workflows[0]; // Show first workflow
  const [adding, setAdding] = useState(false);
  const [sName, setSName] = useState(""); const [sDays, setSDays] = useState(1); const [sTime, setSTime] = useState("10:00");
  const [sCh, setSCh] = useState("EMAIL"); const [sTpl, setSTpl] = useState("");
  const [isPending, start] = useTransition(); const router = useRouter();

  if (!wf) return <div className="p-6"><Link href="/settings" className="text-gray-400 text-sm">← 設定</Link><p className="mt-4 text-gray-400">ワークフローがありません</p></div>;

  const filtTpls = templates.filter(t => t.channel === sCh);
  const addStep = () => {
    if (!sName.trim() || !sTpl) return;
    start(async () => { await createWorkflowStep({ workflowId: wf.id, name: sName.trim(), daysAfter: sDays, timeOfDay: sDays === 0 ? "即時" : sTime, channel: sCh as any, templateId: sTpl }); setAdding(false); setSName(""); router.refresh(); });
  };

  return (
    <div className="p-6 max-w-[700px]">
      <div className="flex items-center gap-2 mb-4">
        <Link href="/settings" className="text-gray-400 text-sm">← 設定</Link>
        <h1 className="text-lg font-bold">ワークフロー設定</h1>
      </div>
      <div className="bg-white rounded-xl border p-4 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-bold">{wf.name}</h2>
          {wf.isDefault && <span className="text-[10px] px-2 py-0.5 bg-green-50 text-green-600 rounded font-semibold">デフォルト</span>}
          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${wf.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>{wf.isActive ? "✅有効" : "⏸無効"}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => start(async () => { await toggleWorkflow(wf.id); router.refresh(); })} className="text-xs px-3 py-1 border rounded-lg text-gray-500">{wf.isActive ? "無効化" : "有効化"}</button>
          <button onClick={() => { setAdding(true); setSName(""); setSDays(1); setSTime("10:00"); setSCh("EMAIL"); setSTpl(""); }} className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold">＋ ステップ追加</button>
        </div>
      </div>
      <div className="bg-white rounded-xl border p-4">
        <h3 className="text-sm font-bold mb-3">ステップタイムライン</h3>
        {wf.steps.length === 0 && <div className="py-8 text-center text-gray-300 text-xs">ステップがありません</div>}
        {wf.steps.map((step: any, i: number) => {
          const ci = CH_INFO[step.channel] || CH_INFO.EMAIL;
          return (
            <div key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center w-7">
                <div className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: ci.c }}>{i + 1}</div>
                {i < wf.steps.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 my-1" />}
              </div>
              <div className="flex-1 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm flex items-center gap-1.5">{step.name}<span className="text-[10px] px-1.5 py-0.5 rounded font-normal" style={{ background: ci.c + "15", color: ci.c }}>{ci.l}</span></div>
                    <div className="text-xs text-gray-400 mt-0.5">{step.daysAfter === 0 ? "即時" : `${step.daysAfter}日後 ${step.timeOfDay}`} · テンプレート: {step.template?.name || "不明"}</div>
                  </div>
                  <button onClick={() => start(async () => { await deleteWorkflowStep(step.id); router.refresh(); })} className="text-[10px] text-gray-300">🗑</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 bg-white rounded-xl border p-4">
        <h3 className="text-sm font-bold mb-2">自動停止条件</h3>
        <div className="grid grid-cols-2 gap-2">
          {[["📩", "顧客から返信"], ["💬", "LINE友達追加"], ["🏢", "来店完了"], ["📞", "架電対応"], ["✋", "手動停止"], ["✅", "全ステップ完了"]].map(([i, l]) =>
            <div key={l} className="flex gap-2 p-2 bg-gray-50 rounded-lg"><span>{i}</span><span className="text-xs">{l}</span></div>
          )}
        </div>
      </div>
      {adding && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setAdding(false)}>
          <div className="bg-white rounded-2xl p-5 w-[400px] shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3">ステップを追加</h3>
            <div className="space-y-2">
              <input value={sName} onChange={e => setSName(e.target.value)} placeholder="ステップ名" className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="flex gap-2"><input type="number" value={sDays} onChange={e => setSDays(parseInt(e.target.value) || 0)} min={0} className="w-16 px-3 py-2 border rounded-lg text-sm text-center" /><span className="self-center text-xs text-gray-500">日後</span><input type="time" value={sTime} onChange={e => setSTime(e.target.value)} className="w-24 px-3 py-2 border rounded-lg text-sm" /></div>
              <div className="flex gap-1">{Object.entries(CH_INFO).map(([k, v]) => <button key={k} onClick={() => { setSCh(k); setSTpl(""); }} className={`px-2.5 py-1 rounded-md text-xs ${sCh === k ? "text-white font-semibold" : "text-gray-500"}`} style={{ background: sCh === k ? v.c : "#f1f5f9" }}>{v.l}</button>)}</div>
              <select value={sTpl} onChange={e => setSTpl(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="">テンプレートを選択</option>{filtTpls.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              <div className="flex gap-2 justify-end pt-1"><button onClick={() => setAdding(false)} className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs">キャンセル</button><button onClick={addStep} disabled={!sName.trim() || !sTpl || isPending} className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold disabled:opacity-40">追加</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
