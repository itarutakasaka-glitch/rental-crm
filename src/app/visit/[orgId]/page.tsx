"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

interface VisitData {
  setting: {
    closedDays: string;
    availableTimeStart: string;
    availableTimeEnd: string;
    visitMethods: string;
    storeNotice: string;
  };
  organization: { id: string; name: string; storeName: string; storeAddress: string; storePhone: string; storeHours: string };
  customer?: { id: string; name: string };
}

const DOW = ["\u65E5","\u6708","\u706B","\u6C34","\u6728","\u91D1","\u571F"];

function timeSlots(start: string, end: string) {
  const s: string[] = [];
  let [h,m] = start.split(":").map(Number);
  const [eh,em] = end.split(":").map(Number);
  while (h < eh || (h===eh && m<=em)) {
    s.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
    m+=30; if(m>=60){h++;m=0;}
  }
  return s;
}

function monthDays(y: number, mo: number) {
  const dow = new Date(y,mo,1).getDay();
  const last = new Date(y,mo+1,0).getDate();
  const d: (number|null)[] = [];
  for(let i=0;i<dow;i++) d.push(null);
  for(let i=1;i<=last;i++) d.push(i);
  return d;
}

export default function PublicVisitPage() {
  const params = useParams();
  const sp = useSearchParams();
  const orgId = params.orgId as string;
  const cid = sp.get("c") || "";

  const [data, setData] = useState<VisitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const [calY, setCalY] = useState(today.getFullYear());
  const [calM, setCalM] = useState(today.getMonth());
  const [selDate, setSelDate] = useState("");
  const [selTime, setSelTime] = useState("");
  const [method, setMethod] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!orgId) return;
    const u = cid ? `/api/public/visit/${orgId}?c=${cid}` : `/api/public/visit/${orgId}`;
    fetch(u).then(r => { if(!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError("\u4E88\u7D04\u30DA\u30FC\u30B8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"))
      .finally(() => setLoading(false));
  }, [orgId, cid]);

  const closedDowSet = new Set(
    (data?.setting.closedDays || "").split(",").map(s => s.trim()).filter(Boolean)
  );

  function isDayDisabled(day: number) {
    const d = new Date(calY, calM, day);
    const ds = `${calY}-${String(calM+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    if (ds < todayStr) return true;
    if (closedDowSet.has(DOW[d.getDay()])) return true;
    return false;
  }

  function prevMonth() {
    if (calM === 0) { setCalY(calY-1); setCalM(11); }
    else setCalM(calM-1);
  }
  function nextMonth() {
    if (calM === 11) { setCalY(calY+1); setCalM(0); }
    else setCalM(calM+1);
  }

  async function handleSubmit() {
    if (!selDate || !selTime) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/store-visit-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          customerId: cid || undefined,
          name: data?.customer?.name || "",
          email: "",
          phone: "",
          visitDate: selDate,
          visitTime: selTime,
          visitMethod: method,
          memo,
        }),
      });
      if (res.ok) setSubmitted(true);
      else setError("\u9001\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    } catch { setError("\u9001\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F"); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="p-8 text-center text-gray-400">{"\u8AAD\u307F\u8FBC\u307F\u4E2D..."}</div>;
  if (error && !data) return <div className="p-8 text-center text-gray-500">{error}</div>;
  if (submitted) return (
    <div className="p-8 text-center">
      <div className="text-4xl mb-3">{"\u2705"}</div>
      <h2 className="text-lg font-bold mb-2">{"\u3054\u4E88\u7D04\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059"}</h2>
      <p className="text-gray-500 text-sm">{"\u62C5\u5F53\u8005\u3088\u308A\u6539\u3081\u3066\u3054\u9023\u7D61\u3044\u305F\u3057\u307E\u3059\u3002"}</p>
    </div>
  );
  if (!data) return null;

  const { setting, organization } = data;
  const slots = timeSlots(setting.availableTimeStart, setting.availableTimeEnd);
  const methods = setting.visitMethods.split(",").map(s=>s.trim()).filter(Boolean);
  const days = monthDays(calY, calM);
  const canSubmit = selDate && selTime && !submitting;

  return (
    <div className="bg-gray-50 pb-8" style={{ minHeight: "100dvh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 text-center sticky top-0 z-10">
        <h1 className="text-base font-bold">{organization.storeName || organization.name}</h1>
        <p className="text-xs text-gray-500 mt-0.5">{"\u6765\u5E97\u30FB\u5185\u898B\u4E88\u7D04"}</p>
      </div>

      <div className="px-4 pt-4">
        {setting.storeNotice && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-amber-800 whitespace-pre-wrap">{setting.storeNotice}</p>
          </div>
        )}

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600">{"\u25C0"}</button>
            <span className="font-bold text-sm">{calY}{"\u5E74"}{calM+1}{"\u6708"}</span>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600">{"\u25B6"}</button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs mb-1">
            {DOW.map((d,i) => <div key={i} className={`py-1 font-medium ${i===0?"text-red-400":i===6?"text-blue-400":"text-gray-500"}`}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 text-center text-sm gap-y-1">
            {days.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />;
              const ds = `${calY}-${String(calM+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const disabled = isDayDisabled(day);
              const selected = ds === selDate;
              const isToday = ds === todayStr;
              return (
                <button key={i} disabled={disabled} onClick={() => { setSelDate(ds); setSelTime(""); }}
                  className={`w-9 h-9 mx-auto rounded-full flex items-center justify-center transition-colors
                    ${disabled ? "text-gray-300 cursor-not-allowed" : "hover:bg-gray-100 cursor-pointer"}
                    ${selected ? "!bg-[#0891b2] !text-white" : ""}
                    ${isToday && !selected ? "border border-[#0891b2] text-[#0891b2]" : ""}`}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Slots */}
        {selDate && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h3 className="text-sm font-bold mb-3">{"\u6642\u9593\u3092\u9078\u629E"}</h3>
            <div className="grid grid-cols-4 gap-2">
              {slots.map(t => (
                <button key={t} onClick={() => setSelTime(t)}
                  className={`py-2 rounded-lg text-sm border transition-colors
                    ${selTime===t ? "bg-[#0891b2] text-white border-[#0891b2]" : "border-gray-200 hover:border-[#0891b2] hover:text-[#0891b2]"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Visit Method */}
        {methods.length > 0 && selDate && selTime && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h3 className="text-sm font-bold mb-3">{"\u65B9\u6CD5\u3092\u9078\u629E"}</h3>
            <div className="flex flex-wrap gap-2">
              {methods.map(m => (
                <button key={m} onClick={() => setMethod(method===m?"":m)}
                  className={`px-4 py-2 rounded-lg text-sm border transition-colors
                    ${method===m ? "bg-[#0891b2] text-white border-[#0891b2]" : "border-gray-200 hover:border-[#0891b2]"}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Memo */}
        {selDate && selTime && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h3 className="text-sm font-bold mb-2">{"\u5099\u8003\u30FB\u3054\u8981\u671B"}</h3>
            <textarea value={memo} onChange={e=>setMemo(e.target.value)} rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={"\u305D\u306E\u4ED6\u3054\u8981\u671B\u304C\u3042\u308C\u3070\u3054\u8A18\u5165\u304F\u3060\u3055\u3044"} />
          </div>
        )}

        {/* Submit */}
        {selDate && selTime && (
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="w-full py-3 bg-[#0891b2] text-white rounded-lg font-bold text-sm disabled:opacity-50 mb-4">
            {submitting ? "\u9001\u4FE1\u4E2D..." : `${selDate.replace(/-/g,"/")} ${selTime} \u3067\u4E88\u7D04\u3059\u308B`}
          </button>
        )}

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
      </div>
    </div>
  );
}
