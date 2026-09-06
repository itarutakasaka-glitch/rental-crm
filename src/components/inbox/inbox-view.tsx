"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@/lib/auth";

type Status = { id: string; name: string; color: string; order: number };
type Message = { id: string; direction: string; channel: string; subject: string | null; body: string; createdAt: string; status?: string };
type Customer = {
  id: string; name: string; nameKana: string | null; email: string | null; phone: string | null;
  sourcePortal: string | null; isNeedAction: boolean; createdAt: string; updatedAt: string;
  lineUserId: string | null; lineDisplayName: string | null;
  status: Status; assignee: { name: string } | null; messages: Message[];
  tags?: { name: string }[];
  organization?: { name: string } | null; store?: { name: string } | null;
};

export function InboxView({
  customers, statuses, statusCounts, needActionCount, currentUser, crossOrg, staffOrgs, stores, tags,
  selectedOrgId, selectedStoreId, selectedStatusId, selectedTag, query, needOnly,
  page, pageSize, totalCount,
}: {
  customers: Customer[]; statuses: Status[]; statusCounts?: Record<string, number>; needActionCount?: number;
  currentUser: AuthUser;
  crossOrg?: boolean; staffOrgs?: { id: string; name: string }[];
  stores?: { id: string; name: string }[]; tags?: string[];
  selectedOrgId?: string; selectedStoreId?: string; selectedStatusId?: string; selectedTag?: string;
  query?: string; needOnly?: boolean;
  page?: number; pageSize?: number; totalCount?: number;
}) {
  const router = useRouter();
  const [q, setQ] = useState(query || "");

  const formatDate = (d: string) => {
    const date = new Date(d);
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h";
    return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
  };

  // implementation-spec-v1.md §4: 絞り込みはすべてURL（＝サーバー側）で行う。
  // ページングしているので、クライアントで絞ると件数も結果も嘘になる。
  const go = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const current: Record<string, string | undefined> = {
      org: selectedOrgId, store: selectedStoreId, status: selectedStatusId,
      tag: selectedTag, q: query, need: needOnly ? "1" : undefined,
    };
    const next = { ...current, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    // 絞り込みを変えたら1ページ目に戻す（page は patch で明示されたときだけ載せる）
    if (patch.page) params.set("page", patch.page);
    router.push(`/inbox${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const curPage = page || 1;
  const size = pageSize || 200;
  const total = totalCount ?? customers.length;
  const totalPages = Math.max(1, Math.ceil(total / size));

  const sideBtn = (active: boolean) =>
    `w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm mb-1 ${
      active ? "bg-gray-100 font-semibold" : "text-gray-600 hover:bg-gray-50"
    }`;

  const heading = needOnly
    ? "要対応"
    : selectedStatusId
    ? statuses.find((s) => s.id === selectedStatusId)?.name || "ステータス"
    : selectedTag
    ? `タグ: ${selectedTag}`
    : "すべて";

  return (
    <div className="flex h-full">
      <div className="w-[220px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-lg font-bold">受信トレイ</h1>
          <p className="text-xs text-gray-400 mt-0.5">{total}件</p>
        </div>

        {crossOrg && staffOrgs && staffOrgs.length > 0 && (
          <div className="p-3 border-b border-gray-100">
            <div className="text-[10px] text-gray-400 font-semibold mb-1">会社</div>
            <select
              value={selectedOrgId || ""}
              onChange={(e) => go({ org: e.target.value || undefined, store: undefined, status: undefined })}
              className="w-full text-xs px-2 py-1.5 border rounded-lg"
            >
              <option value="">すべて（{staffOrgs.length}社）</option>
              {staffOrgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* F-1/F-2: 全社 → 会社 → 店舗 の3段階ドリルダウンの3段目 */}
        {stores && stores.length > 0 && (
          <div className="p-3 border-b border-gray-100">
            <div className="text-[10px] text-gray-400 font-semibold mb-1">店舗</div>
            <select
              value={selectedStoreId || ""}
              onChange={(e) => go({ store: e.target.value || undefined })}
              className="w-full text-xs px-2 py-1.5 border rounded-lg"
            >
              <option value="">すべて（{stores.length}店舗）</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="p-2 flex-1 overflow-auto">
          <button
            onClick={() => go({ need: needOnly ? undefined : "1", status: undefined })}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm mb-1 ${
              needOnly ? "bg-red-50 text-red-700 font-semibold" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" />要対応</span>
            <span className="text-xs font-semibold">{needActionCount ?? 0}</span>
          </button>
          <button
            onClick={() => go({ need: undefined, status: undefined, tag: undefined })}
            className={sideBtn(!needOnly && !selectedStatusId && !selectedTag)}
          >
            <span>すべて</span>
          </button>

          {statuses.length > 0 && (
            <>
              <div className="border-t border-gray-100 my-2" />
              <div className="text-[10px] text-gray-400 font-semibold px-3 mb-1">ステータス</div>
              {statuses.map((s) => (
                <button key={s.id} onClick={() => go({ status: s.id, need: undefined })} className={sideBtn(selectedStatusId === s.id)}>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="text-xs font-semibold flex-shrink-0">{statusCounts?.[s.id] ?? 0}</span>
                </button>
              ))}
            </>
          )}

          {/* F-4: タグで絞る */}
          {tags && tags.length > 0 && (
            <>
              <div className="border-t border-gray-100 my-2" />
              <div className="text-[10px] text-gray-400 font-semibold px-3 mb-1">タグ</div>
              <div className="flex flex-wrap gap-1 px-2">
                {tags.map((t) => (
                  <button
                    key={t}
                    onClick={() => go({ tag: selectedTag === t ? undefined : t })}
                    className={`px-2 py-0.5 rounded-full text-[11px] border ${
                      selectedTag === t
                        ? "bg-primary text-white border-primary font-semibold"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-gray-700 flex-shrink-0">
              {heading}
              <span className="text-gray-400 font-normal ml-2">{total}件</span>
            </h2>
            {/* F-17: 氏名・電話・メール・物件名の横断検索 */}
            <form
              onSubmit={(e) => { e.preventDefault(); go({ q: q.trim() || undefined }); }}
              className="flex items-center gap-2 flex-1 max-w-md"
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="氏名・電話・メール・物件名で検索"
                className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
              />
              <button type="submit" className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold">検索</button>
              {query && (
                <button type="button" onClick={() => { setQ(""); go({ q: undefined }); }}
                  className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-800">クリア</button>
              )}
            </form>
          </div>
        </div>

        {customers.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">該当なし</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {customers.map((c) => {
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
                      <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                        {crossOrg && c.organization && (
                          <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-semibold">
                            {c.organization.name}{c.store ? ` / ${c.store.name}` : ""}
                          </span>
                        )}
                        {!crossOrg && c.store && (
                          <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-semibold">{c.store.name}</span>
                        )}
                        {c.sourcePortal && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{c.sourcePortal}</span>}
                        {c.email && <span>{c.email}</span>}
                      </div>
                      {c.tags && c.tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {c.tags.slice(0, 3).map((t) => (
                            <span key={t.name} className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] border border-amber-100">{t.name}</span>
                          ))}
                          {c.tags.length > 3 && <span className="text-[10px] text-gray-400">+{c.tags.length - 3}</span>}
                        </div>
                      )}
                      {lastMsg && <div className="text-xs text-gray-400 mt-1 truncate">{lastMsg.direction === "OUTBOUND" ? "↗ " : "↙ "}{lastMsg.subject || lastMsg.body?.slice(0, 60)}</div>}
                      {lastMsg && lastMsg.direction === "OUTBOUND" && lastMsg.status === "PENDING" && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">下書き承認待ち</span>
                      )}
                    </div>
                    {c.assignee && <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">{c.assignee.name[0]}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 py-4 text-xs text-gray-500">
            <button onClick={() => go({ page: String(curPage - 1) })} disabled={curPage <= 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50">前へ</button>
            <span>{curPage} / {totalPages}（全{total}件）</span>
            <button onClick={() => go({ page: String(curPage + 1) })} disabled={curPage >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50">次へ</button>
          </div>
        )}
      </div>
    </div>
  );
}
