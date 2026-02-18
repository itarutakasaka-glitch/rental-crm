"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCustomerStatus, toggleNeedAction } from "@/actions/customers";
import { sendMessageAction } from "@/actions/messages";
import type { AuthUser } from "@/lib/auth";

const CH = { EMAIL: { icon: "✉️", color: "#3b82f6" }, LINE: { icon: "💬", color: "#06c755" }, SMS: { icon: "📱", color: "#f59e0b" }, CALL: { icon: "📞", color: "#8b5cf6" }, NOTE: { icon: "📝", color: "#6b7280" } };

export function CustomerDetail({ customer: c, statuses, templates, currentUser }: { customer: any; statuses: any[]; templates: any[]; currentUser: AuthUser }) {
  const [body, setBody] = useState(""); const [subj, setSubj] = useState(""); const [ch, setCh] = useState("EMAIL");
  const [isPending, start] = useTransition(); const router = useRouter();

  const st = statuses.find((s: any) => s.id === c.statusId);

  const send = () => { if (!body.trim()) return;
    start(async () => {
      await sendMessageAction({ customerId: c.id, senderId: currentUser.id, channel: ch, subject: ch === "EMAIL" ? subj : undefined, body });
      setBody(""); setSubj(""); router.refresh();
    });
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/customers")} className="text-gray-400">←</button>
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{c.name[0]}</div>
            <div>
              <div className="font-bold flex items-center gap-1.5">{c.name}
                {c.isNeedAction && <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-500 rounded font-semibold">要対応</span>}
              </div>
              <div className="text-xs text-gray-400">{c.email} · {c.phone}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 rounded-md text-xs font-semibold border-2" style={{ borderColor: st?.color, color: st?.color, background: st?.color + "10" }}>{st?.name}</span>
            <button onClick={() => start(() => { toggleNeedAction(c.id); router.refresh(); })} className="text-xs px-2 py-1 border rounded-md text-gray-500">
              {c.isNeedAction ? "🔴 要対応" : "対応不要"}
            </button>
          </div>
        </div>
        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50/50 space-y-3">
          {c.messages.map((m: any) => {
            const chInfo = CH[m.channel as keyof typeof CH] || CH.NOTE;
            return (
              <div key={m.id} className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[70%]">
                  <div className="text-[10px] text-gray-400 mb-0.5" style={{ textAlign: m.direction === "OUTBOUND" ? "right" : "left" }}>
                    <span style={{ color: chInfo.color }}>{chInfo.icon}</span> {m.subject && `📩 ${m.subject}`}
                  </div>
                  <div className={`p-3 rounded-xl text-sm whitespace-pre-wrap leading-relaxed ${m.direction === "OUTBOUND" ? "bg-blue-50 border border-blue-100" : "bg-white border"}`}>{m.body}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5" style={{ textAlign: m.direction === "OUTBOUND" ? "right" : "left" }}>
                    {new Date(m.createdAt).toLocaleString("ja-JP")} · {m.sender?.name || c.name}
                    {m.direction === "OUTBOUND" && m.channel === "EMAIL" && (
                      m.openedAt ? <span className="text-blue-500 ml-1 font-semibold">✓✓ 既読 ({m.openCount}回)</span> : <span className="ml-1">✓ 未開封</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Input */}
        <div className="border-t bg-white p-3">
          <div className="flex gap-1 mb-2">
            {Object.entries(CH).map(([k, v]) => (
              <button key={k} onClick={() => setCh(k)} className={`px-2.5 py-1 rounded-full text-xs ${ch === k ? "font-semibold" : ""}`}
                style={{ background: ch === k ? v.color + "15" : "#f1f5f9", color: ch === k ? v.color : "#64748b" }}>{v.icon}</button>
            ))}
          </div>
          {ch === "EMAIL" && <input value={subj} onChange={e => setSubj(e.target.value)} placeholder="件名" className="w-full px-3 py-1.5 border rounded-lg text-sm mb-2" />}
          <div className="flex gap-2">
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="メッセージ..." rows={3} className="flex-1 px-3 py-2 border rounded-lg text-sm resize-none" />
            <button onClick={send} disabled={!body.trim() || isPending} className="self-end px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-40">{isPending ? "..." : "送信"}</button>
          </div>
        </div>
      </div>
      {/* Right panel */}
      <div className="w-72 flex-shrink-0 overflow-auto bg-white border-l p-4">
        <h3 className="text-sm font-bold mb-3">基本情報</h3>
        {[["氏名", c.name], ["メール", c.email], ["電話", c.phone], ["反響元", c.sourcePortal], ["担当", c.assignee?.name]].map(([l, v]) => (
          <div key={l as string} className="flex py-1 border-b border-gray-50 text-xs"><span className="w-14 text-gray-400 flex-shrink-0">{l}</span><span>{v || "—"}</span></div>
        ))}
        {c.properties?.[0] && (
          <div className="mt-4">
            <h3 className="text-sm font-bold mb-2">物件情報</h3>
            <div className="p-2.5 border rounded-lg text-xs">
              <div className="font-semibold mb-1">{c.properties[0].name}</div>
              {c.properties[0].address && <div className="text-gray-500">📍 {c.properties[0].address}</div>}
              {c.properties[0].rent && <div className="text-gray-500">💰 {c.properties[0].rent.toLocaleString()}円</div>}
            </div>
          </div>
        )}
        {c.tags?.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-3">{c.tags.map((t: any) => <span key={t.id} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-semibold">{t.name}</span>)}</div>
        )}
      </div>
    </div>
  );
}
