"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSchedule, updateSchedule, deleteSchedule } from "@/actions/schedules";
import type { AuthUser } from "@/lib/auth";

const SCH_TYPES: Record<string, { l: string; i: string; c: string }> = {
  VISIT: { l: "\u6765\u5e97", i: "\ud83c\udfe2", c: "#8b5cf6" },
  VIEWING: { l: "\u5185\u898b", i: "\ud83c\udfe0", c: "#3b82f6" },
  CALL: { l: "\u67b6\u96fb", i: "\ud83d\udcde", c: "#f59e0b" },
  FOLLOW_UP: { l: "\u30d5\u30a9\u30ed\u30fc", i: "\ud83d\udce7", c: "#10b981" },
  CONTRACT: { l: "\u5951\u7d04", i: "\ud83d\udcdd", c: "#ef4444" },
  OTHER: { l: "\u305d\u306e\u4ed6", i: "\ud83d\udccc", c: "#6b7280" },
};
const DAYS = ["\u65e5", "\u6708", "\u706b", "\u6c34", "\u6728", "\u91d1", "\u571f"];

function fmt(d: string) {
  return new Date(d).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}
function fmtRange(s: string, e: string | null) {
  const st = fmt(s);
  if (!e) return st;
  return st + " - " + fmt(e);
}

export function CalendarView({ schedules: initSchedules, customers, currentUser, initialYear, initialMonth }: {
  schedules: any[]; customers: { id: string; name: string }[];
  currentUser: AuthUser; initialYear: number; initialMonth: number;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selDate, setSelDate] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<any[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fTitle, setFTitle] = useState("");
  const [fType, setFType] = useState("VISIT");
  const [fDate, setFDate] = useState("");
  const [fTimeStart, setFTimeStart] = useState("10:00");
  const [fTimeEnd, setFTimeEnd] = useState("11:00");
  const [fCust, setFCust] = useState("");
  const [fLoc, setFLoc] = useState("");
  const [fStaff, setFStaff] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [isPending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/staff").then(r => r.ok ? r.json() : []).then(setStaffList).catch(() => {});
  }, []);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < startDow; i++) cells.push({ date: new Date(year, month - 1, -startDow + i + 1), inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month - 1, d), inMonth: true });
  const rem = 7 - (cells.length % 7);
  if (rem < 7) for (let i = 1; i <= rem; i++) cells.push({ date: new Date(year, month, i), inMonth: false });

  const byDate: Record<string, any[]> = {};
  initSchedules.forEach(s => {
    const dk = new Date(s.startAt).toISOString().split("T")[0];
    if (!byDate[dk]) byDate[dk] = [];
    byDate[dk].push(s);
  });

  const prev = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); };
  const next = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); };

  const openAdd = () => {
    setEditId(null);
    setFTitle(""); setFType("VISIT"); setFDate(selDate || todayStr);
    setFTimeStart("10:00"); setFTimeEnd("11:00");
    setFCust(""); setFLoc(""); setFStaff(currentUser.id); setFDesc("");
    setShowModal(true);
  };

  const openEdit = (ev: any) => {
    setEditId(ev.id);
    setFTitle(ev.title || "");
    setFType(ev.type || "OTHER");
    const sd = new Date(ev.startAt);
    setFDate(`${sd.getFullYear()}-${String(sd.getMonth()+1).padStart(2,"0")}-${String(sd.getDate()).padStart(2,"0")}`);
    setFTimeStart(`${String(sd.getHours()).padStart(2,"0")}:${String(sd.getMinutes()).padStart(2,"0")}`);
    if (ev.endAt) {
      const ed = new Date(ev.endAt);
      setFTimeEnd(`${String(ed.getHours()).padStart(2,"0")}:${String(ed.getMinutes()).padStart(2,"0")}`);
    } else {
      setFTimeEnd(`${String(sd.getHours()+1).padStart(2,"0")}:${String(sd.getMinutes()).padStart(2,"0")}`);
    }
    setFCust(ev.customerId || "");
    setFLoc(ev.location || "");
    setFStaff(ev.userId || "");
    setFDesc(ev.description || "");
    setShowModal(true);
  };

  const handleSave = () => {
    if (!fTitle.trim() || !fDate) return;
    const [sh, sm] = fTimeStart.split(":").map(Number);
    const [eh, em] = fTimeEnd.split(":").map(Number);
    const startAt = new Date(fDate + "T00:00:00"); startAt.setHours(sh, sm, 0, 0);
    const endAt = new Date(fDate + "T00:00:00"); endAt.setHours(eh, em, 0, 0);

    start(async () => {
      if (editId) {
        await updateSchedule(editId, {
          title: fTitle, type: fType as any, startAt, endAt,
          location: fLoc || undefined, userId: fStaff || null,
          customerId: fCust || null, description: fDesc || undefined,
          color: SCH_TYPES[fType]?.c,
        });
      } else {
        await createSchedule({
          organizationId: currentUser.organizationId,
          userId: fStaff || currentUser.id,
          customerId: fCust || undefined,
          title: fTitle, type: fType as any, startAt, endAt,
          location: fLoc || undefined, description: fDesc || undefined,
          color: SCH_TYPES[fType]?.c,
        });
      }
      setShowModal(false);
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("\u3053\u306e\u4e88\u5b9a\u3092\u524a\u9664\u3057\u307e\u3059\u304b\uff1f")) return;
    start(async () => { await deleteSchedule(id); router.refresh(); });
  };

  const selEvents = selDate ? (byDate[selDate] || []) : [];

  return (
    <div className="p-6 flex gap-5 h-full">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-extrabold">{year}{"\u5e74"}{month}{"\u6708"}</h1>
            <button onClick={prev} className="px-2 py-1 bg-gray-100 rounded text-xs">{"\u25c0"}</button>
            <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); }} className="px-3 py-1 bg-gray-100 rounded text-xs">{"\u4eca\u65e5"}</button>
            <button onClick={next} className="px-2 py-1 bg-gray-100 rounded text-xs">{"\u25b6"}</button>
          </div>
          <button onClick={openAdd} className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold">{"\uff0b \u4e88\u5b9a\u8ffd\u52a0"}</button>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden flex-1">
          <div className="grid grid-cols-7 border-b">
            {DAYS.map((d, i) => <div key={d} className={`py-1.5 text-center text-xs font-semibold ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"}`}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => {
              const dk = `${cell.date.getFullYear()}-${String(cell.date.getMonth()+1).padStart(2,"0")}-${String(cell.date.getDate()).padStart(2,"0")}`;
              const evts = byDate[dk] || [];
              const isToday = dk === todayStr;
              const isSel = dk === selDate;
              const dow = cell.date.getDay();
              return (
                <div key={idx} onClick={() => setSelDate(dk)}
                  className={`min-h-[72px] border-b border-r p-1 cursor-pointer transition ${!cell.inMonth ? "bg-gray-50/50" : isSel ? "bg-primary/5" : "hover:bg-gray-50"}`}>
                  <div className={`text-xs text-right mb-0.5 ${!cell.inMonth ? "text-gray-300" : dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : "text-gray-500"}`}>
                    {isToday ? <span className="inline-flex w-5 h-5 bg-primary text-white rounded-full items-center justify-center text-[10px] font-bold">{cell.date.getDate()}</span> : cell.date.getDate()}
                  </div>
                  {evts.slice(0, 2).map((ev: any) => {
                    const t = SCH_TYPES[ev.type] || SCH_TYPES.OTHER;
                    return (
                      <div key={ev.id} className="text-[10px] px-1 py-0.5 rounded mb-0.5 truncate" style={{ background: (ev.color || t.c) + "15", color: ev.color || t.c }}>
                        {t.i} {fmt(ev.startAt)} {ev.title}
                      </div>
                    );
                  })}
                  {evts.length > 2 && <div className="text-[9px] text-gray-400 pl-1">+{evts.length - 2}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Day panel */}
      <div className="w-[280px] flex-shrink-0">
        {selDate ? (
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-bold mb-2">
              {new Date(selDate + "T00:00:00").toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}
            </h3>
            {selEvents.length === 0 ? (
              <div className="py-8 text-center text-gray-300 text-xs">{"\u4e88\u5b9a\u306a\u3057"}</div>
            ) : selEvents.map((ev: any) => {
              const t = SCH_TYPES[ev.type] || SCH_TYPES.OTHER;
              return (
                <div key={ev.id} className="p-2.5 rounded-lg border-l-[3px] border mb-2 cursor-pointer hover:bg-gray-50 transition"
                  style={{ borderLeftColor: ev.color || t.c }}
                  onClick={() => openEdit(ev)}>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-semibold">{t.i} {ev.title}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(ev.id); }} className="text-[10px] text-gray-300 hover:text-red-400">{"\ud83d\uddd1"}</button>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{fmtRange(ev.startAt, ev.endAt)}</div>
                  {ev.user && <div className="text-xs text-gray-500 mt-0.5">{"\ud83d\udc64"} {ev.user.name}</div>}
                  {ev.customer && <div className="text-xs mt-0.5" style={{ color: "#D97706" }}>{"\ud83d\udc65"} {ev.customer.name}</div>}
                  {ev.location && <div className="text-xs text-gray-400">{"\ud83d\udccd"} {ev.location}</div>}
                  <div className="text-[10px] text-gray-300 mt-1">{"\u30af\u30ea\u30c3\u30af\u3067\u7de8\u96c6"}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-10 text-center text-gray-300 text-sm">{"\u65e5\u4ed8\u3092\u30af\u30ea\u30c3\u30af"}</div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-5 w-[420px] shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3">{editId ? "\u4e88\u5b9a\u3092\u7de8\u96c6" : "\u4e88\u5b9a\u3092\u8ffd\u52a0"}</h3>
            <div className="space-y-2">
              <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder={"\u30bf\u30a4\u30c8\u30eb"} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="flex gap-1 flex-wrap">
                {Object.entries(SCH_TYPES).map(([k, v]) => (
                  <button key={k} onClick={() => setFType(k)}
                    className={`px-2.5 py-1 rounded-full text-xs border ${fType === k ? "font-semibold text-white" : "text-gray-500"}`}
                    style={{ background: fType === k ? v.c : "white", borderColor: fType === k ? v.c : "#e2e8f0" }}>
                    {v.i} {v.l}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-0.5 block">{"\u65e5\u4ed8"}</label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[11px] text-gray-500 mb-0.5 block">{"\u958b\u59cb\u6642\u523b"}</label>
                  <input type="time" value={fTimeStart} onChange={e => setFTimeStart(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-gray-500 mb-0.5 block">{"\u7d42\u4e86\u6642\u523b"}</label>
                  <input type="time" value={fTimeEnd} onChange={e => setFTimeEnd(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-0.5 block">{"\u62c5\u5f53\u8005"}</label>
                <select value={fStaff} onChange={e => setFStaff(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">{"\u672a\u8a2d\u5b9a"}</option>
                  {staffList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-0.5 block">{"\u9867\u5ba2"}</label>
                <select value={fCust} onChange={e => setFCust(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">{"\u9867\u5ba2\u306a\u3057"}</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <input value={fLoc} onChange={e => setFLoc(e.target.value)} placeholder={"\u5834\u6240\uff08\u4efb\u610f\uff09"} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder={"\u30e1\u30e2\uff08\u4efb\u610f\uff09"} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm resize-none" />
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setShowModal(false)} className="px-4 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-600">{"\u30ad\u30e3\u30f3\u30bb\u30eb"}</button>
                <button onClick={handleSave} disabled={!fTitle.trim() || isPending}
                  className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-40">
                  {isPending ? "\u4fdd\u5b58\u4e2d..." : editId ? "\u66f4\u65b0" : "\u4f5c\u6210"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}