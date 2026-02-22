"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface VisitData {
  setting: {
    closedDays: string;
    availableTimeStart: string;
    availableTimeEnd: string;
    visitMethods: string;
    storeNotice: string;
  };
  organization: {
    id: string;
    name: string;
    storeName: string;
    storeAddress: string;
    storePhone: string;
    storeHours: string;
  };
}

export default function PublicVisitPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [data, setData] = useState<VisitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [visitMethod, setVisitMethod] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/public/visit/${orgId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("\u4e88\u7d04\u30da\u30fc\u30b8\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093"))
      .finally(() => setLoading(false));
  }, [orgId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !visitDate || !visitTime) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/store-visit-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          name,
          email,
          phone,
          visitDate,
          visitTime,
          visitMethod,
          memo,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError("\u9001\u4fe1\u306b\u5931\u6557\u3057\u307e\u3057\u305f");
      }
    } catch {
      setError("\u9001\u4fe1\u306b\u5931\u6557\u3057\u307e\u3057\u305f");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">{"\u8aad\u307f\u8fbc\u307f\u4e2d..."}</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md text-center">
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md text-center">
          <div className="text-4xl mb-4">{"\u2705"}</div>
          <h2 className="text-xl font-bold mb-2">{"\u3054\u4e88\u7d04\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059"}</h2>
          <p className="text-gray-600 text-sm">
            {"\u78ba\u8a8d\u30e1\u30fc\u30eb\u3092\u304a\u9001\u308a\u3057\u307e\u3057\u305f\u3002\u62c5\u5f53\u8005\u3088\u308a\u6539\u3081\u3066\u3054\u9023\u7d61\u3044\u305f\u3057\u307e\u3059\u3002"}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { setting, organization } = data;
  const methods = setting.visitMethods.split(",").map((m) => m.trim()).filter(Boolean);

  const today = new Date();
  const minDate = today.toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-xl font-bold text-center mb-1">
            {organization.storeName || organization.name}
          </h1>
          <p className="text-center text-gray-500 text-sm mb-4">
            {"\u6765\u5e97\u30fb\u5185\u898b\u4e88\u7d04\u30d5\u30a9\u30fc\u30e0"}
          </p>

          {organization.storeAddress && (
            <p className="text-xs text-gray-500 text-center mb-1">
              {"\u{1f4cd} "}{organization.storeAddress}
            </p>
          )}
          {organization.storePhone && (
            <p className="text-xs text-gray-500 text-center mb-1">
              {"\u{1f4de} "}{organization.storePhone}
            </p>
          )}
          {setting.closedDays && (
            <p className="text-xs text-gray-500 text-center mb-1">
              {"\u5b9a\u4f11\u65e5: "}{setting.closedDays}
            </p>
          )}
          {setting.storeNotice && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-3">
              <p className="text-xs text-amber-800 whitespace-pre-wrap">{setting.storeNotice}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-bold mb-4">{"\u4e88\u7d04\u60c5\u5831\u3092\u5165\u529b"}</h2>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {"\u304a\u540d\u524d"} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {"\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9"} <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {"\u96fb\u8a71\u756a\u53f7"}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {"\u5e0c\u671b\u65e5"} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                min={minDate}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {"\u5e0c\u671b\u6642\u9593"} <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                min={setting.availableTimeStart}
                max={setting.availableTimeEnd}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                {"\u53d7\u4ed8\u6642\u9593: "}{setting.availableTimeStart}{" \u301c "}{setting.availableTimeEnd}
              </p>
            </div>

            {methods.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {"\u6765\u5e97\u65b9\u6cd5"}
                </label>
                <select
                  value={visitMethod}
                  onChange={(e) => setVisitMethod(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">{"\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044"}</option>
                  {methods.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {"\u5099\u8003\u30fb\u3054\u8981\u671b"}
              </label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder={"\u305d\u306e\u4ed6\u3054\u8981\u671b\u304c\u3042\u308c\u3070\u3054\u8a18\u5165\u304f\u3060\u3055\u3044"}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !name || !email || !visitDate || !visitTime}
              className="w-full py-3 bg-[#0891b2] text-white rounded-lg font-medium hover:bg-[#0e7490] disabled:opacity-50"
            >
              {submitting ? "\u9001\u4fe1\u4e2d..." : "\u4e88\u7d04\u3059\u308b"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
