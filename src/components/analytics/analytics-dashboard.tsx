"use client";
import type { AnalyticsData } from "@/actions/analytics";

const CH_LABELS: Record<string, { label: string; color: string }> = {
  EMAIL: { label: "メール", color: "#3b82f6" }, LINE: { label: "LINE", color: "#06c755" },
  SMS: { label: "SMS", color: "#d4a017" }, CALL: { label: "架電", color: "#8b5cf6" }, NOTE: { label: "メモ", color: "#6b7280" },
};

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const maxSt = Math.max(...data.statusBreakdown.map(s => s.count), 1);
  const maxMo = Math.max(...data.monthlyTrend.map(m => m.count), 1);

  return (
    <div className="p-6 max-w-[1100px]">
      <h1 className="text-xl font-bold">分析ダッシュボード</h1>
      <p className="text-xs text-gray-400 mt-0.5 mb-5">営業状況をリアルタイムに把握</p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {[["全顧客", data.totalCustomers, "👥", "#4ECDC4"], ["要対応", data.needActionCount, "🔴", "#ef4444"], ["LINE連携", data.lineLinkedCount, "💬", "#06c755"],
          ["今月反響", data.monthInquiries, "📩", "#3b82f6"], ["今月来店", data.monthVisits, "🏢", "#8b5cf6"], ["今週予定", data.weekSchedules, "📅", "#d4a017"]
        ].map(([l, v, i, c]) => (
          <div key={l as string} className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-400 mb-1">{i} {l}</div>
            <div className="text-2xl font-extrabold" style={{ color: c as string }}>{v as number}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-bold mb-3">ステータス別顧客数</h3>
          <div className="space-y-2">{data.statusBreakdown.map(s => (
            <div key={s.name} className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-xs w-16 flex-shrink-0 text-gray-500">{s.name}</span>
              <div className="flex-1 h-4 bg-gray-50 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(s.count / maxSt) * 100}%`, backgroundColor: s.color + "cc", minWidth: s.count > 0 ? 3 : 0 }} /></div>
              <span className="text-sm font-bold w-6 text-right" style={{ color: s.color }}>{s.count}</span>
            </div>
          ))}</div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-bold mb-3">月別反響推移</h3>
          <div className="flex items-end gap-2 h-32">{data.monthlyTrend.map(m => (
            <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-xs font-bold text-primary mb-1">{m.count}</span>
              <div className="w-full rounded-t-md bg-gradient-to-b from-primary to-primary/70" style={{ height: `${Math.max((m.count / maxMo) * 100, 5)}%` }} />
              <span className="text-[10px] text-gray-400 mt-1">{m.month.split("/")[1]}月</span>
            </div>
          ))}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-bold mb-3">反響元別</h3>
          {data.portalBreakdown.map((p, i) => {
            const colors = ["#4ECDC4", "#3b82f6", "#d4a017", "#8b5cf6", "#ef4444"];
            return (<div key={p.portal} className="flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className="text-xs flex-1 text-gray-500">{p.portal}</span>
              <span className="text-xs text-gray-400">{data.totalCustomers > 0 ? Math.round(p.count / data.totalCustomers * 100) : 0}%</span>
              <span className="text-sm font-bold w-6 text-right">{p.count}</span>
            </div>);
          })}
        </div>
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-bold mb-3">チャネル別メッセージ</h3>
          {data.channelBreakdown.map(c => { const info = CH_LABELS[c.channel] || { label: c.channel, color: "#6b7280" }; const tot = c.outbound + c.inbound; return (
            <div key={c.channel} className="mb-2.5">
              <div className="flex justify-between mb-0.5"><span className="text-xs font-medium" style={{ color: info.color }}>{info.label}</span><span className="text-xs text-gray-400">{tot}件</span></div>
              <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-50">
                <div className="rounded-l-full" style={{ width: `${tot > 0 ? (c.outbound / tot) * 100 : 0}%`, backgroundColor: info.color }} />
                <div className="rounded-r-full" style={{ width: `${tot > 0 ? (c.inbound / tot) * 100 : 0}%`, backgroundColor: info.color + "45" }} />
              </div>
              <div className="flex justify-between mt-0.5"><span className="text-[10px] text-gray-400">↑送信 {c.outbound}</span><span className="text-[10px] text-gray-400">↓受信 {c.inbound}</span></div>
            </div>
          ); })}
        </div>
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-bold mb-3">ワークフロー状況</h3>
          {[["🔄 実行中", data.workflowStats.running, "#3b82f6", "bg-blue-50"], ["✅ 完了", data.workflowStats.completed, "#10b981", "bg-green-50"], ["⏹ 停止済", data.workflowStats.stopped, "#6b7280", "bg-gray-50"]].map(([l, v, c, bg]) => (
            <div key={l as string} className={`flex items-center justify-between p-2.5 ${bg} rounded-lg mb-2`}>
              <span className="text-xs" style={{ color: c as string }}>{l}</span><span className="text-lg font-bold" style={{ color: c as string }}>{v as number}</span>
            </div>
          ))}
          <div className="pt-2 border-t flex justify-between"><span className="text-xs text-gray-400">合計</span><span className="text-sm font-bold">{data.workflowStats.total}件</span></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h3 className="text-sm font-bold mb-3">担当者別パフォーマンス</h3>
        <table className="w-full text-sm"><thead><tr className="border-b">
          {["担当者", "担当顧客数", "要対応", "対応率"].map(h => <th key={h} className={`py-2 px-3 text-xs font-semibold text-gray-500 ${h === "担当者" || h === "対応率" ? "text-left" : "text-right"}`}>{h}</th>)}
        </tr></thead><tbody>{data.assigneeBreakdown.map(a => {
          const pct = a.total > 0 ? Math.round((a.total - a.needAction) / a.total * 100) : 0;
          return (<tr key={a.name} className="border-b border-gray-50">
            <td className="py-2 px-3 font-medium">{a.name}</td>
            <td className="py-2 px-3 text-right">{a.total}</td>
            <td className="py-2 px-3 text-right">{a.needAction > 0 ? <span className="text-red-500 font-semibold">{a.needAction}</span> : <span className="text-green-500">0</span>}</td>
            <td className="py-2 px-3"><div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct >= 80 ? "#10b981" : pct >= 50 ? "#d4a017" : "#ef4444" }} /></div><span className="text-xs text-gray-400 w-7 text-right">{pct}%</span></div></td>
          </tr>);
        })}</tbody></table>
      </div>
    </div>
  );
}
