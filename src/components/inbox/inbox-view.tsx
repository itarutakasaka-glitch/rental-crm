"use client";
import { useState } from "react";
import Link from "next/link";
import type { AuthUser } from "@/lib/auth";

type Status = { id: string; name: string; color: string; order: number };
type Message = { id: string; direction: string; channel: string; subject: string | null; body: string; createdAt: string };
type Customer = {
  id: string; name: string; nameKana: string | null; email: string | null; phone: string | null;
  sourcePortal: string | null; isNeedAction: boolean; createdAt: string; updatedAt: string;
  lineUserId: string | null; lineDisplayName: string | null;
  status: Status; assignee: { name: string } | null; messages: Message[];
};

export function InboxView({ customers, statuses, currentUser }: { customers: Customer[]; statuses: Status[]; currentUser: AuthUser }) {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showNeedAction, setShowNeedAction] = useState(false);
  const filtered = customers.filter(c => {
    if (selectedStatus !== "all" && c.status.id !== selectedStatus) return false;
    if (showNeedAction && !c.isNeedAction) return false;
    return true;
  });
  const statusCounts = statuses.map(s => ({ ...s, count: customers.filter(c => c.status.id === s.id).length }));
  const needActionCount = customers.filter(c => c.isNeedAction).length;
  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h";
    return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
  };
  return (
    <div className="flex h-full">
      <div className="w-[220px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-lg font-bold">{"\u53D7\u4FE1\u30C8\u30EC\u30A4"}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{customers.length}{"\u4EF6"}</p>
        </div>
        <div className="p-2 flex-1 overflow-auto">
          <button onClick={() => { setShowNeedAction(!showNeedAction); setSelectedStatus("all"); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm mb-1 ${showNeedAction ? "bg-red-50 text-red-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" />{"\u8981\u5BFE\u5FDC"}</span>
            <span className="text-xs font-semibold">{needActionCount}</span>
          </button>
          <button onClick={() => { setSelectedStatus("all"); setShowNeedAction(false); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm mb-1 ${selectedStatus === "all" && !showNeedAction ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"}`}>
            <span>{"\u3059\u3079\u3066"}</span><span className="text-xs font-semibold">{customers.length}</span>
          </button>
          <div className="border-t border-gray-100 my-2" />
          <div className="text-[10px] text-gray-400 font-semibold px-3 mb-1">{"\u30B9\u30C6\u30FC\u30BF\u30B9"}</div>
          {statusCounts.map(s => (
            <button key={s.id} onClick={() => { setSelectedStatus(s.id); setShowNeedAction(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm mb-0.5 ${selectedStatus === s.id ? "bg-gray-100 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}>
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</span>
              <span className="text-xs font-semibold">{s.count}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
          <h2 className="text-sm font-semibold text-gray-700">
            {showNeedAction ? "\u8981\u5BFE\u5FDC" : selectedStatus === "all" ? "\u3059\u3079\u3066" : statuses.find(s => s.id === selectedStatus)?.name}
            <span className="text-gray-400 font-normal ml-2">{filtered.length}{"\u4EF6"}</span>
          </h2>
        </div>
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">{"\u8A72\u5F53\u306A\u3057"}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(c => {
              const lastMsg = c.messages[0];
              return (
                <Link key={c.id} href={`/customers/${c.id}`} className="block hover:bg-blue-50/50">
                  <div className="px-4 py-3 flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">{c.name[0]}</span>
                      {c.isNeedAction && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${c.isNeedAction ? "font-bold" : "font-semibold"}`}>{c.name}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: c.status.color + "15", color: c.status.color }}>{c.status.name}</span>
                          {c.lineUserId && <span className="w-5 h-5 rounded-full bg-[#06c755] flex items-center justify-center text-white text-[10px] font-bold" title={`LINE: ${c.lineDisplayName || ""}`}>L</span>}
                        </div>
                        <span className="text-[11px] text-gray-400">{lastMsg ? formatDate(lastMsg.createdAt) : formatDate(c.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {c.sourcePortal && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{c.sourcePortal}</span>}
                        {c.email && <span>{c.email}</span>}
                      </div>
                      {lastMsg && <div className="text-xs text-gray-400 mt-1 truncate">{lastMsg.direction === "OUTBOUND" ? "\u2197 " : "\u2199 "}{lastMsg.subject || lastMsg.body?.slice(0, 60)}</div>}
                    </div>
                    {c.assignee && <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">{c.assignee.name[0]}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
