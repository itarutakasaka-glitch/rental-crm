"use client";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendMessage } from "@/actions/send-message";
import type { AuthUser } from "@/lib/auth";
import { resolveTemplateVars } from "@/lib/template-vars";
import { StoreRoutingPanel } from "./store-routing-panel";

const CH: Record<string, { label: string; color: string }> = { EMAIL: { label: "Email", color: "#3b82f6" }, LINE: { label: "LINE", color: "#06c755" }, SMS: { label: "SMS", color: "#d4a017" }, CALL: { label: "Tel", color: "#8b5cf6" }, NOTE: { label: "Note", color: "#6b7280" } };
type Tpl = { id: string; name: string; channel: string; subject: string | null; body: string; category: { name: string } };

// SMS分割セグメント数(Intercomの「670字超えたら2通に分かれます」相当の事前警告)。
// 日本語(UCS-2)前提: 単一セグメント70字、複数セグメント時は67字/通(UDHヘッダー分を差し引き)。
function smsSegments(text: string): { count: number; perSegment: number } {
  const len = text.length;
  if (len === 0) return { count: 0, perSegment: 70 };
  if (len <= 70) return { count: 1, perSegment: 70 };
  return { count: Math.ceil(len / 67), perSegment: 67 };
}

// 反響対応playbookの知見:「また機会がありましたら」等の"引き"表現は非成立側に多い(最大-26pt)。
// 送信前に検出して警告する(統合コンポーザーの送信前チェック)。
const NG_PHRASES = ["また機会がありましたら", "またの機会に", "何かあればご連絡ください"];
function findNgPhrases(text: string): string[] {
  return NG_PHRASES.filter((p) => text.includes(p));
}

// Phase1(下書き承認方式): cron/agentがDRAFT_ONLY組織向けに作った下書き(status=PENDING)を
// 人間が確認・編集して承認送信 or 却下する。
function DraftApprovalBubble({ m, chInfo, onDone }: { m: any; chInfo: { label: string; color: string }; onDone: () => void }) {
  const [editBody, setEditBody] = useState(m.body);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [err, setErr] = useState("");

  const approve = async () => {
    setBusy("approve"); setErr("");
    try {
      const res = await fetch(`/api/messages/${m.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: editBody }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "送信に失敗しました");
      onDone();
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  };
  const reject = async () => {
    setBusy("reject"); setErr("");
    try {
      const res = await fetch(`/api/messages/${m.id}/approve`, { method: "DELETE" });
      if (!res.ok) throw new Error("却下に失敗しました");
      onDone();
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="max-w-[85%] w-full p-3 rounded-xl border-2 border-amber-300 bg-amber-50">
      <div className="text-[10px] font-bold text-amber-700 mb-1.5 flex items-center gap-1.5">
        <span className="inline-block px-1.5 py-0.5 rounded font-semibold text-white" style={{ background: chInfo.color }}>{chInfo.label}</span>
        承認待ちの下書き{m.subject && <span className="text-gray-500 font-normal">・{m.subject}</span>}
      </div>
      <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={5} className="w-full px-2 py-1.5 border rounded-lg text-sm resize-none bg-white" />
      {err && <div className="text-[11px] text-red-500 mt-1">{err}</div>}
      <div className="flex gap-2 mt-2">
        <button onClick={approve} disabled={!!busy} className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold disabled:opacity-40">{busy === "approve" ? "送信中..." : "承認して送信"}</button>
        <button onClick={reject} disabled={!!busy} className="px-3 py-1.5 bg-white border text-gray-500 rounded-lg text-xs font-semibold disabled:opacity-40">{busy === "reject" ? "..." : "却下"}</button>
      </div>
    </div>
  );
}

// implementation-spec-v1.md §1.3: 変数置換は lib/template-vars.ts に集約。
// この画面だけ従来 org.lineUrl 未設定時に既定の LINE URL を差し込んでいたため、
// 挙動を変えないよう useLegacyLineFallback を明示する（D-1 の会社別 LINE 設定で解消）。
function resolveVars(text: string, c: any, user: AuthUser, org: any) {
  return resolveTemplateVars(text, { customer: c, org, staffName: user.name, useLegacyLineFallback: true });
}

// implementation-spec-v1.md §4.3 タグ（F-4）。候補は会社の tagPresets ＋ 実際に使われているタグ。
// 候補に無い自由入力も許す（現場が先に使い始めたタグを後から候補に足せる）。
function TagEditor({ customerId, initial }: { customerId: string; initial: string[] }) {
  const [tags, setTags] = useState<string[]>(initial);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [choices, setChoices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const openPicker = async () => {
    setOpen(true); setErr("");
    try {
      const res = await fetch("/api/tags");
      if (res.ok) {
        const d = await res.json();
        setChoices(Array.from(new Set([...(d.presets || []), ...(d.inUse || [])])));
      }
    } catch {}
  };

  const add = async (name: string) => {
    const n = name.trim();
    if (!n || tags.includes(n) || busy) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/customers/${customerId}/tags`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n }),
      });
      if (res.ok) { setTags([...tags, n].sort()); setInput(""); }
      else setErr((await res.json().catch(() => ({})))?.error || "追加できませんでした");
    } catch { setErr("追加できませんでした"); }
    finally { setBusy(false); }
  };

  const remove = async (name: string) => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/customers/${customerId}/tags`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
      });
      if (res.ok) setTags(tags.filter((t) => t !== name));
      else setErr("削除できませんでした");
    } catch { setErr("削除できませんでした"); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] border border-amber-100">
          {t}
          <button onClick={() => remove(t)} disabled={busy} className="text-amber-400 hover:text-amber-700 disabled:opacity-40" title="タグを外す">×</button>
        </span>
      ))}
      <div className="relative">
        <button onClick={() => (open ? setOpen(false) : openPicker())}
          className="px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-[10px] text-gray-500 hover:bg-gray-50">＋タグ</button>
        {open && (
          <div className="absolute top-6 left-0 w-56 bg-white border rounded-xl shadow-xl z-50 p-2">
            <form onSubmit={(e) => { e.preventDefault(); add(input); }} className="flex gap-1 mb-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="タグ名"
                className="flex-1 px-2 py-1 border rounded text-xs" autoFocus />
              <button type="submit" disabled={busy || !input.trim()} className="px-2 py-1 bg-primary text-white rounded text-[10px] font-semibold disabled:opacity-40">追加</button>
            </form>
            {err && <div className="text-[10px] text-red-600 mb-1">{err}</div>}
            <div className="max-h-40 overflow-auto">
              {choices.filter((t) => !tags.includes(t)).map((t) => (
                <button key={t} onClick={() => add(t)} className="w-full text-left px-2 py-1 text-xs hover:bg-gray-50 rounded">{t}</button>
              ))}
              {choices.filter((t) => !tags.includes(t)).length === 0 && (
                <div className="text-[10px] text-gray-400 px-2 py-1">候補なし。上の欄に入力して追加できます</div>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="w-full mt-1 text-[10px] text-gray-400 hover:text-gray-600">閉じる</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CustomerDetail({ customer: c, statuses, templates: _t, currentUser }: { customer: any; statuses: any[]; templates: any[]; currentUser: AuthUser }) {
  const [body, setBody] = useState(""); const [subj, setSubj] = useState(""); const [ch, setCh] = useState("EMAIL");
  const [isPending, start] = useTransition(); const router = useRouter();
  const [lineCode, setLineCode] = useState(""); const [linkMsg, setLinkMsg] = useState("");
  const [wfs, setWfs] = useState<any[]>([]); const [wfMsg, setWfMsg] = useState(""); const [activeRun, setActiveRun] = useState<any>(null);
  const [tpls, setTpls] = useState<Tpl[]>([]); const [showTpl, setShowTpl] = useState(false); const [org, setOrg] = useState<any>(null);
  const [lockInfo, setLockInfo] = useState<{ locked: boolean; lockedBy: string | null }>({ locked: false, lockedBy: null });
  const st = statuses.find((s: any) => s.id === c.statusId);

  useEffect(() => { fetch("/api/templates").then(r => r.json()).then(d => setTpls(d.templates || [])); fetch("/api/organization").then(r => r.json()).then(d => setOrg(d)); fetch("/api/workflows").then(r => r.json()).then(d => setWfs(d.workflows || [])); fetch(`/api/workflow-run?customerId=${c.id}`).then(r => r.json()).then(d => setActiveRun(d.run || null)); }, []);

  // 二重対応防止ロック(architecture-v2.md §9): 画面を開いている間30秒おきにハートビートを送り、
  // 他オペが90秒以内に取得済みならバナー表示+送信ブロック。離脱時は自分のロックを解放する。
  useEffect(() => {
    let cancelled = false;
    const acquire = async () => {
      try {
        const res = await fetch(`/api/customers/${c.id}/lock`, { method: "POST" });
        const data = await res.json();
        if (!cancelled) setLockInfo({ locked: res.status === 409, lockedBy: data.lockedBy || null });
      } catch {}
    };
    acquire();
    const interval = setInterval(acquire, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      fetch(`/api/customers/${c.id}/lock`, { method: "DELETE", keepalive: true }).catch(() => {});
    };
  }, [c.id]);

  const send = () => { if (!body.trim()) return;
    start(async () => {
      await sendMessage({ customerId: c.id, senderId: currentUser.id, channel: ch as any, subject: ch === "EMAIL" ? subj : undefined, body });
      setBody(""); setSubj(""); router.refresh();
    });
  };

  const applyTpl = (t: Tpl) => {
    setCh(t.channel);
    setBody(resolveVars(t.body, c, currentUser, org));
    if (t.subject) setSubj(resolveVars(t.subject, c, currentUser, org));
    setShowTpl(false);
  };

  const linkLine = async () => {
    if (!lineCode.trim()) return;
    setLinkMsg("...");
    const res = await fetch("/api/line-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: c.id, code: lineCode.trim() }) });
    const data = await res.json();
    if (res.ok) { setLinkMsg(`LINE\u9023\u643A\u5B8C\u4E86: ${data.displayName || "OK"}`); setLineCode(""); router.refresh(); }
    else { setLinkMsg(`\u30A8\u30E9\u30FC: ${data.error}`); }
  };

  const filteredTpls = tpls.filter(t => t.channel === ch);
  const segments = smsSegments(body);
  const ngPhrases = findNgPhrases(body);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/customers")} className="text-gray-400">{"\u2190"}</button>
            <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">{c.name[0]}</div>
            <div>
              <div className="font-bold flex items-center gap-1.5">{c.name}
                <button onClick={async () => { const r = await fetch(`/api/customers/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isNeedAction: !c.isNeedAction }) }); if (r.ok) { window.location.reload(); } }} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold cursor-pointer transition ${c.isNeedAction ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}>{c.isNeedAction ? "\u8981\u5BFE\u5FDC" : "\u5BFE\u5FDC\u6E08"}</button>
                {c.lineUserId && <span className="w-5 h-5 rounded-full bg-[#06c755] flex items-center justify-center text-white text-[10px] font-bold ml-1">L</span>}
              </div>
              <div className="text-xs text-gray-400">{c.email} {"\u00B7"} {c.phone}</div>
              <TagEditor customerId={c.id} initial={(c.tags || []).map((t: any) => t.name)} />
            </div>
          </div>
          <span className="px-3 py-1 rounded-md text-xs font-semibold border-2" style={{ borderColor: st?.color, color: st?.color, background: st?.color + "10" }}>{st?.name}</span>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-slate-50/50 space-y-3">
          {c.messages.map((m: any) => {
            const chInfo = CH[m.channel as keyof typeof CH] || CH.NOTE;
            if (m.direction === "OUTBOUND" && m.status === "PENDING") {
              return (
                <div key={m.id} className="flex justify-end">
                  <DraftApprovalBubble m={m} chInfo={chInfo} onDone={() => router.refresh()} />
                </div>
              );
            }
            return (
              <div key={m.id} className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[70%]">
                  <div className="text-[10px] text-gray-400 mb-0.5" style={{ textAlign: m.direction === "OUTBOUND" ? "right" : "left" }}>
                    <span className={`inline-block px-1.5 py-0.5 rounded font-semibold text-white`} style={{ background: chInfo.color }}>{m.direction === "OUTBOUND" ? "\u9001\u4FE1" : "\u53D7\u4FE1"} {chInfo.label}</span> {m.subject && <span className="ml-1">{m.subject}</span>}
                  </div>
                  <div className={`p-3 rounded-xl text-sm whitespace-pre-wrap leading-relaxed ${m.direction === "OUTBOUND" ? "bg-indigo-50 border border-indigo-200 text-slate-700" : "bg-white border border-slate-200 text-slate-700"}`}>{m.body}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5" style={{ textAlign: m.direction === "OUTBOUND" ? "right" : "left" }}>
                    {new Date(m.createdAt).toLocaleString("ja-JP")} {"\u00B7"} {m.sender?.name || c.name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t bg-white p-3">
          <div className="flex gap-1 mb-2 items-center">
            {Object.entries(CH).filter(([k]) => k !== "LINE" || c.lineUserId).map(([k, v]) => (
              <button key={k} onClick={() => setCh(k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${ch === k ? "text-white" : "text-gray-500 bg-gray-100 hover:bg-gray-200"}`}
                style={ch === k ? { background: v.color, color: "white" } : {}}>{v.label}</button>
            ))}
            <div className="ml-auto relative">
              <button onClick={() => setShowTpl(!showTpl)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-600 hover:bg-purple-100">{"\u5B9A\u578B\u6587"}</button>
              {showTpl && (
                <div className="absolute bottom-10 right-0 w-64 bg-white border rounded-xl shadow-xl z-50 max-h-64 overflow-auto">
                  <div className="p-2 border-b text-xs font-semibold text-gray-500">{"\u5B9A\u578B\u6587\u3092\u9078\u629E"}</div>
                  {filteredTpls.length === 0 && <div className="p-3 text-xs text-gray-400">{"\u3053\u306E\u30C1\u30E3\u30CD\u30EB\u306E\u5B9A\u578B\u6587\u306F\u3042\u308A\u307E\u305B\u3093"}</div>}
                  {filteredTpls.map(t => (
                    <button key={t.id} onClick={() => applyTpl(t)} className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0">
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{t.body.slice(0, 50)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {ch === "EMAIL" && <input value={subj} onChange={e => setSubj(e.target.value)} placeholder={"\u4EF6\u540D"} className="w-full px-3 py-1.5 border rounded-lg text-sm mb-2" />}
          {ngPhrases.length > 0 && (
            <div className="mb-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700">
              \u26A0\uFE0F \u300C{ngPhrases[0]}\u300D\u306F\u6210\u7D04\u7387\u304C\u4E0B\u304C\u308A\u3084\u3059\u3044\u8868\u73FE\u3067\u3059\u3002\u5177\u4F53\u7684\u306A\u63D0\u6848\u306B\u7F6E\u304D\u63DB\u3048\u308B\u3053\u3068\u3092\u691C\u8A0E\u3057\u3066\u304F\u3060\u3055\u3044
            </div>
          )}
          {lockInfo.locked && (ch === "EMAIL" || ch === "LINE" || ch === "SMS") && (
            <div className="mb-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
              \u26A0\uFE0F {lockInfo.lockedBy || "\u4ED6\u306E\u30AA\u30DA\u30EC\u30FC\u30BF\u30FC"}\u304C\u5BFE\u5FDC\u4E2D\u3067\u3059\u3002\u4E8C\u91CD\u9001\u4FE1\u3092\u9632\u3050\u305F\u3081\u9001\u4FE1\u3092\u30D6\u30ED\u30C3\u30AF\u3057\u3066\u3044\u307E\u3059\u3002\u5FC5\u8981\u306A\u3089\u30DA\u30FC\u30B8\u3092\u518D\u8AAD\u307F\u8FBC\u307F\u3057\u3066\u304F\u3060\u3055\u3044
            </div>
          )}
          <div className="flex gap-2">
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder={"\u30E1\u30C3\u30BB\u30FC\u30B8..."} rows={3} className="flex-1 px-3 py-2 border rounded-lg text-sm resize-none" />
            <button onClick={send} disabled={!body.trim() || isPending || (lockInfo.locked && (ch === "EMAIL" || ch === "LINE" || ch === "SMS"))} className="self-end px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-40">{isPending ? "..." : "\u9001\u4FE1"}</button>
          </div>
          {ch === "SMS" && body.length > 0 && (
            <div className={`mt-1 text-[11px] ${segments.count > 1 ? "text-amber-600" : "text-gray-400"}`}>
              {body.length}\u5B57 / {segments.count}\u901A{segments.count > 1 ? `\uFF08${segments.perSegment}\u5B57\u3092\u8D85\u3048\u305F\u305F\u3081\u5206\u5272\u3055\u308C\u307E\u3059\uFF09` : ""}
            </div>
          )}
        </div>
      </div>
      <div className="w-72 flex-shrink-0 overflow-auto bg-white border-l p-4">
        <h3 className="text-sm font-bold mb-3">{"\u57FA\u672C\u60C5\u5831"}</h3>
        {[["\u6C0F\u540D", c.name], ["\u30E1\u30FC\u30EB", c.email], ["\u96FB\u8A71", c.phone], ["\u53CD\u97FF\u5143", c.sourcePortal], ["\u62C5\u5F53", c.assignee?.name], ["LINE", c.lineDisplayName || (c.lineUserId ? "\u9023\u643A\u6E08" : "\u672A\u9023\u643A")]].map(([l, v]) => (
          <div key={l as string} className="flex py-1 border-b border-gray-50 text-xs"><span className="w-14 text-gray-400 flex-shrink-0">{l}</span><span>{v || "\u2014"}</span></div>
        ))}
        {!c.lineUserId && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-xs font-semibold text-green-700 mb-2">LINE{"\u9023\u643A"}</div>
            <div className="text-[10px] text-green-600 mb-2">{"\u9867\u5BA2\u304C\u53CB\u3060\u3061\u8FFD\u52A0\u3059\u308B\u3068\u8A8D\u8A3C\u30B3\u30FC\u30C9\u304C\u9001\u3089\u308C\u307E\u3059\u3002\u305D\u306E\u30B3\u30FC\u30C9\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}</div>
            <div className="flex gap-1">
              <input value={lineCode} onChange={e => setLineCode(e.target.value)} placeholder={"4\u6841\u30B3\u30FC\u30C9"} maxLength={4} className="flex-1 px-2 py-1.5 border rounded text-sm text-center tracking-widest font-mono" />
              <button onClick={linkLine} className="px-3 py-1.5 bg-[#06c755] text-white rounded text-xs font-semibold">{"\u9023\u643A"}</button>
            </div>
            {linkMsg && <div className="text-[10px] mt-1.5 text-green-700">{linkMsg}</div>}
          </div>
        )}
        {c.properties?.[0] && (
          <div className="mt-4">
            <h3 className="text-sm font-bold mb-2">{"\u7269\u4EF6\u60C5\u5831"}</h3>
            <div className="p-2.5 border rounded-lg text-xs">
              <div className="font-semibold mb-1">{c.properties[0].name}</div>
              {c.properties[0].address && <div className="text-gray-500">{c.properties[0].address}</div>}
              {c.properties[0].rent && <div className="text-gray-500">{c.properties[0].rent.toLocaleString()}{"\u5186"}</div>}
            </div>
          </div>
        )}
        {(wfs.length > 0 || activeRun) && (
          <div className="mt-4">
            <h3 className="text-sm font-bold mb-2">{"\u30B7\u30CA\u30EA\u30AA\u914D\u4FE1"}</h3>
            {activeRun && activeRun.status === "RUNNING" ? (
              <div className="p-2.5 border-2 border-blue-200 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-blue-700">{activeRun.workflow?.name}</div>
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded font-semibold">{"\u5B9F\u884C\u4E2D"}</span>
                </div>
                <div className="text-[10px] text-blue-600 mt-1">{"\u30B9\u30C6\u30C3\u30D7"} {activeRun.currentStepIndex + 1} / {activeRun.workflow?.steps?.length || "?"}</div>
                {activeRun.nextRunAt && <div className="text-[10px] text-blue-500 mt-0.5">{"\u6B21\u56DE\u914D\u4FE1"}: {new Date(activeRun.nextRunAt).toLocaleString("ja-JP")}</div>}
                <button onClick={async () => { await fetch("/api/workflow-run", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId: activeRun.id }) }); setActiveRun(null); setWfMsg("\u505C\u6B62\u3057\u307E\u3057\u305F"); setTimeout(() => setWfMsg(""), 3000); }}
                  className="mt-2 w-full text-center py-1 text-[11px] text-red-500 border border-red-200 rounded hover:bg-red-50">{"\u25A0 \u30B7\u30CA\u30EA\u30AA\u505C\u6B62"}</button>
              </div>
            ) : (
              <div>
                <select id="wfSelect" className="w-full px-2 py-1.5 border rounded-lg text-xs mb-1.5">
                  <option value="">{"\u30B7\u30CA\u30EA\u30AA\u3092\u9078\u629E"}</option>
                  {wfs.filter((w: any) => w.isActive).map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}({w.steps.length}{"\u30B9\u30C6\u30C3\u30D7"})</option>
                  ))}
                </select>
                <button onClick={async () => {
                  const sel = (document.getElementById("wfSelect") as HTMLSelectElement)?.value;
                  if (!sel) return;
                  setWfMsg("...");
                  const r = await fetch("/api/workflow-run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: c.id, workflowId: sel }) });
                  const d = await r.json();
                  if (r.ok) { setActiveRun({ ...d, workflow: wfs.find((w: any) => w.id === sel) }); setWfMsg("\u958B\u59CB\u3057\u307E\u3057\u305F"); } else { setWfMsg("\u30A8\u30E9\u30FC"); }
                  setTimeout(() => setWfMsg(""), 3000);
                }} className="w-full py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">{"\u30B7\u30CA\u30EA\u30AA\u958B\u59CB"}</button>
              </div>
            )}
            {wfMsg && <div className="text-xs text-green-600 mt-1">{wfMsg}</div>}
          </div>
        )}
        {c.tags?.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-3">{c.tags.map((t: any) => <span key={t.id} className="px-2 py-0.5 bg-indigo-50 text-primary rounded-full text-[10px] font-semibold">{t.name}</span>)}</div>
        )}
        <StoreRoutingPanel customerId={c.id} customerName={c.name} />
      </div>
    </div>
  );
}
