"use client";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendMessage } from "@/actions/send-message";
import type { AuthUser } from "@/lib/auth";

const CH: Record<string, { label: string; color: string }> = { EMAIL: { label: "Email", color: "#3b82f6" }, LINE: { label: "LINE", color: "#06c755" }, SMS: { label: "SMS", color: "#f59e0b" }, CALL: { label: "Tel", color: "#8b5cf6" }, NOTE: { label: "Note", color: "#6b7280" } };
type Tpl = { id: string; name: string; channel: string; subject: string | null; body: string; category: { name: string } };

function resolveVars(text: string, c: any, user: AuthUser, org: any) {
  return text
    .replace(/\{\{customer_name\}\}/g, c.name || "")
    .replace(/\{\{customer_email\}\}/g, c.email || "")
    .replace(/\{\{customer_phone\}\}/g, c.phone || "")
    .replace(/\{\{staff_name\}\}/g, user.name || c.assignee?.name || "")
    .replace(/\{\{property_name\}\}/g, c.properties?.[0]?.name || "")
    .replace(/\{\{property_url\}\}/g, c.properties?.[0]?.url || "")
    .replace(/\{\{company_name\}\}/g, org?.name || "")
    .replace(/\{\{store_name\}\}/g, org?.storeName || org?.name || "")
    .replace(/\{\{store_address\}\}/g, org?.storeAddress || org?.address || "")
    .replace(/\{\{store_phone\}\}/g, org?.storePhone || org?.phone || "")
    .replace(/\{\{store_hours\}\}/g, org?.storeHours || "")
    .replace(/\{\{line_url\}\}/g, org?.lineUrl || "https://line.me/R/ti/p/@331fxngy")
    .replace(/\{\{license_number\}\}/g, org?.licenseNumber || "");
}

export function CustomerDetail({ customer: c, statuses, templates: _t, currentUser }: { customer: any; statuses: any[]; templates: any[]; currentUser: AuthUser }) {
  const [body, setBody] = useState(""); const [subj, setSubj] = useState(""); const [ch, setCh] = useState("EMAIL");
  const [isPending, start] = useTransition(); const router = useRouter();
  const [lineCode, setLineCode] = useState(""); const [linkMsg, setLinkMsg] = useState("");
  const [wfs, setWfs] = useState<any[]>([]); const [wfMsg, setWfMsg] = useState("");
  const [tpls, setTpls] = useState<Tpl[]>([]); const [showTpl, setShowTpl] = useState(false); const [org, setOrg] = useState<any>(null);
  const st = statuses.find((s: any) => s.id === c.statusId);

  useEffect(() => { fetch("/api/templates").then(r => r.json()).then(d => setTpls(d.templates || [])); fetch("/api/organization").then(r => r.json()).then(d => setOrg(d)); fetch("/api/workflows").then(r => r.json()).then(d => setWfs(d.workflows || [])); }, []);

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

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/customers")} className="text-gray-400">{"\u2190"}</button>
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{c.name[0]}</div>
            <div>
              <div className="font-bold flex items-center gap-1.5">{c.name}
                {c.isNeedAction && <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-500 rounded font-semibold">{"\u8981\u5BFE\u5FDC"}</span>}
                {c.lineUserId && <span className="w-5 h-5 rounded-full bg-[#06c755] flex items-center justify-center text-white text-[10px] font-bold ml-1">L</span>}
              </div>
              <div className="text-xs text-gray-400">{c.email} {"\u00B7"} {c.phone}</div>
            </div>
          </div>
          <span className="px-3 py-1 rounded-md text-xs font-semibold border-2" style={{ borderColor: st?.color, color: st?.color, background: st?.color + "10" }}>{st?.name}</span>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-gray-50/50 space-y-3">
          {c.messages.map((m: any) => {
            const chInfo = CH[m.channel as keyof typeof CH] || CH.NOTE;
            return (
              <div key={m.id} className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[70%]">
                  <div className="text-[10px] text-gray-400 mb-0.5" style={{ textAlign: m.direction === "OUTBOUND" ? "right" : "left" }}>
                    <span className="font-semibold" style={{ color: chInfo.color }}>{chInfo.label}</span> {m.subject && `- ${m.subject}`}
                  </div>
                  <div className={`p-3 rounded-xl text-sm whitespace-pre-wrap leading-relaxed ${m.direction === "OUTBOUND" ? "bg-blue-50 border border-blue-100" : "bg-white border"}`}>{m.body}</div>
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
          <div className="flex gap-2">
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder={"\u30E1\u30C3\u30BB\u30FC\u30B8..."} rows={3} className="flex-1 px-3 py-2 border rounded-lg text-sm resize-none" />
            <button onClick={send} disabled={!body.trim() || isPending} className="self-end px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-40">{isPending ? "..." : "\u9001\u4FE1"}</button>
          </div>
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
        {wfs.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-bold mb-2">{"\u30B7\u30CA\u30EA\u30AA\u914D\u4FE1"}</h3>
            {wfs.filter((w: any) => w.isActive).map((w: any) => (
              <button key={w.id} onClick={async () => { setWfMsg("..."); const r = await fetch("/api/workflow-run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: c.id, workflowId: w.id }) }); setWfMsg(r.ok ? `${w.name} \u958B\u59CB` : "\u30A8\u30E9\u30FC"); setTimeout(() => setWfMsg(""), 3000); }}
                className="w-full text-left p-2 border rounded-lg text-xs mb-1 hover:bg-blue-50">
                <div className="font-semibold">{w.name}</div>
                <div className="text-gray-400">{w.steps.length}{"\u30B9\u30C6\u30C3\u30D7"}</div>
              </button>
            ))}
            {wfMsg && <div className="text-xs text-green-600 mt-1">{wfMsg}</div>}
          </div>
        )}
        {c.tags?.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-3">{c.tags.map((t: any) => <span key={t.id} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-semibold">{t.name}</span>)}</div>
        )}
      </div>
    </div>
  );
}
