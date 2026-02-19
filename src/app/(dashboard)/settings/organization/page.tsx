"use client";
import { useState, useEffect } from "react";

type Org = { name: string; phone: string; email: string; address: string; website: string; storeName: string; storeAddress: string; storePhone: string; storeHours: string; storeAccess: string; logoUrl: string; lineUrl: string; licenseNumber: string };
const FIELDS: { key: keyof Org; label: string; group: string }[] = [
  { key: "name", label: "\u4F1A\u793E\u540D", group: "\u4F1A\u793E\u60C5\u5831" },
  { key: "phone", label: "\u4F1A\u793E\u96FB\u8A71\u756A\u53F7", group: "\u4F1A\u793E\u60C5\u5831" },
  { key: "email", label: "\u4F1A\u793E\u30E1\u30FC\u30EB", group: "\u4F1A\u793E\u60C5\u5831" },
  { key: "address", label: "\u4F1A\u793E\u4F4F\u6240", group: "\u4F1A\u793E\u60C5\u5831" },
  { key: "website", label: "\u30A6\u30A7\u30D6\u30B5\u30A4\u30C8", group: "\u4F1A\u793E\u60C5\u5831" },
  { key: "licenseNumber", label: "\u5B85\u5EFA\u696D\u514D\u8A31\u756A\u53F7", group: "\u4F1A\u793E\u60C5\u5831" },
  { key: "storeName", label: "\u5E97\u8217\u540D", group: "\u5E97\u8217\u60C5\u5831" },
  { key: "storeAddress", label: "\u5E97\u8217\u4F4F\u6240", group: "\u5E97\u8217\u60C5\u5831" },
  { key: "storePhone", label: "\u5E97\u8217\u96FB\u8A71\u756A\u53F7", group: "\u5E97\u8217\u60C5\u5831" },
  { key: "storeHours", label: "\u55B6\u696D\u6642\u9593", group: "\u5E97\u8217\u60C5\u5831" },
  { key: "storeAccess", label: "\u30A2\u30AF\u30BB\u30B9", group: "\u5E97\u8217\u60C5\u5831" },
  { key: "lineUrl", label: "LINE\u53CB\u3060\u3061\u8FFD\u52A0URL", group: "\u305D\u306E\u4ED6" },
  { key: "logoUrl", label: "\u30ED\u30B4URL", group: "\u305D\u306E\u4ED6" },
];
const GROUPS = ["\u4F1A\u793E\u60C5\u5831", "\u5E97\u8217\u60C5\u5831", "\u305D\u306E\u4ED6"];

export default function OrganizationPage() {
  const [form, setForm] = useState<Org>({ name: "", phone: "", email: "", address: "", website: "", storeName: "", storeAddress: "", storePhone: "", storeHours: "", storeAccess: "", logoUrl: "", lineUrl: "", licenseNumber: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => { fetch("/api/organization").then(r => r.json()).then(d => { if (d) { const f = {} as any; FIELDS.forEach(({ key }) => f[key] = d[key] || ""); setForm(f); } }); }, []);

  const save = async () => {
    setMsg("...");
    const res = await fetch("/api/organization", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setMsg(res.ok ? "\u4FDD\u5B58\u3057\u307E\u3057\u305F" : "\u30A8\u30E9\u30FC");
    setTimeout(() => setMsg(""), 2000);
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{"\u4F1A\u793E\u30FB\u5E97\u8217\u60C5\u5831"}</h1>
        <div className="flex items-center gap-2">
          {msg && <span className="text-sm text-green-600">{msg}</span>}
          <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">{"\u4FDD\u5B58"}</button>
        </div>
      </div>
      {GROUPS.map(g => (
        <div key={g} className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">{g}</h2>
          <div className="bg-white border rounded-xl p-4 space-y-3">
            {FIELDS.filter(f => f.group === g).map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                <input value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="w-full px-3 py-1.5 border rounded-lg text-sm" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
