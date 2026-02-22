"use client";

import { useState, useEffect } from "react";

interface Setting {
  id: string;
  enabled: boolean;
  closedDays: string;
  availableTimeStart: string;
  availableTimeEnd: string;
  visitMethods: string;
  storeNotice: string;
  autoReplySubject: string;
  autoReplyBody: string;
}

export default function StoreVisitSettingPage() {
  const [setting, setSetting] = useState<Setting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [orgId, setOrgId] = useState("");

  useEffect(() => {
    fetchSetting();
    fetchOrgId();
  }, []);

  async function fetchOrgId() {
    try {
      const res = await fetch("/api/organization");
      const data = await res.json();
      if (data.id) setOrgId(data.id);
    } catch {}
  }

  async function fetchSetting() {
    try {
      const res = await fetch("/api/store-visit-settings");
      const data = await res.json();
      setSetting(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!setting) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/store-visit-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setting),
      });
      if (res.ok) {
        setMessage("\u4fdd\u5b58\u3057\u307e\u3057\u305f");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (e) {
      setMessage("\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f");
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof Setting>(key: K, value: Setting[K]) {
    setSetting((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse text-gray-400">{"\u8aad\u307f\u8fbc\u307f\u4e2d..."}</div>
      </div>
    );
  }

  if (!setting) {
    return (
      <div className="p-8">
        <p className="text-red-500">{"\u8a2d\u5b9a\u306e\u8aad\u307f\u8fbc\u307f\u306b\u5931\u6557\u3057\u307e\u3057\u305f"}</p>
      </div>
    );
  }

  const bookingUrl = orgId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/visit/${orgId}`
    : "";

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <a href="/settings/status" className="text-gray-500 hover:text-gray-700">{"\u2190 \u8a2d\u5b9a"}</a>
        <h1 className="text-2xl font-bold">{"\u6765\u5e97\u4e88\u7d04"}</h1>
      </div>

      <div className="bg-white border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700">{"\u6765\u5e97\u4e88\u7d04\u3092\u53ef\u80fd\u306b\u3059\u308b"}</span>
          <button
            onClick={() => updateField("enabled", !setting.enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              setting.enabled ? "bg-[#0891b2]" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                setting.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {setting.enabled && bookingUrl && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-amber-800 mb-1">{"\u4e88\u7d04\u30d5\u30a9\u30fc\u30e0URL"}</p>
          <div className="flex items-center gap-2">
            <code className="text-sm bg-white px-3 py-1 rounded border flex-1 truncate">{bookingUrl}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(bookingUrl);
                setMessage("URL\u3092\u30b3\u30d4\u30fc\u3057\u307e\u3057\u305f");
                setTimeout(() => setMessage(""), 2000);
              }}
              className="px-3 py-1 text-sm bg-[#0891b2] text-white rounded hover:bg-[#0e7490]"
            >
              {"\u30b3\u30d4\u30fc"}
            </button>
          </div>
          <p className="text-xs text-amber-600 mt-1">{"\u3053\u306eURL\u3092\u30e1\u30fc\u30eb\u3084LINE\u306b\u8cbc\u308a\u4ed8\u3051\u3066\u304a\u5ba2\u69d8\u306b\u5171\u6709\u3057\u3066\u304f\u3060\u3055\u3044"}</p>
        </div>
      )}

      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-bold mb-4">{"\u304a\u5ba2\u69d8\u306b\u8868\u793a\u3059\u308b\u60c5\u5831"}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{"\u5b9a\u4f11\u65e5"}</label>
            <input
              type="text"
              value={setting.closedDays}
              onChange={(e) => updateField("closedDays", e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder={"\u4f8b: \u706b\u66dc\u65e5\u3001\u6c34\u66dc\u65e5"}
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-600 mb-1">{"\u6765\u5e97\u4e88\u7d04\u53ef\u80fd\u6642\u9593\uff08\u958b\u59cb\uff09"}</label>
              <input
                type="time"
                value={setting.availableTimeStart}
                onChange={(e) => updateField("availableTimeStart", e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-600 mb-1">{"\u6765\u5e97\u4e88\u7d04\u53ef\u80fd\u6642\u9593\uff08\u7d42\u4e86\uff09"}</label>
              <input
                type="time"
                value={setting.availableTimeEnd}
                onChange={(e) => updateField("availableTimeEnd", e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{"\u6765\u5e97\u65b9\u6cd5\uff08\u30ab\u30f3\u30de\u533a\u5207\u308a\uff09"}</label>
            <input
              type="text"
              value={setting.visitMethods}
              onChange={(e) => updateField("visitMethods", e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder={"\u4f8b: \u5e97\u8217\u3078\u6765\u5e97,\u30d3\u30c7\u30aa\u901a\u8a71\u3067\u306e\u76f8\u8ac7,\u5185\u898b,\u305d\u306e\u4ed6"}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{"\u5e97\u8217\u304b\u3089\u306e\u304a\u77e5\u3089\u305b"}</label>
            <textarea
              value={setting.storeNotice}
              onChange={(e) => updateField("storeNotice", e.target.value)}
              rows={4}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder={"\u304a\u5ba2\u69d8\u306b\u8868\u793a\u3059\u308b\u304a\u77e5\u3089\u305b\u3092\u5165\u529b"}
            />
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-bold mb-4">{"\u6765\u5e97\u4e88\u7d04\u5f8c\u306e\u81ea\u52d5\u8fd4\u4fe1\u8a2d\u5b9a"}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{"\u4ef6\u540d"}</label>
            <input
              type="text"
              value={setting.autoReplySubject}
              onChange={(e) => updateField("autoReplySubject", e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{"\u672c\u6587"}</label>
            <textarea
              value={setting.autoReplyBody}
              onChange={(e) => updateField("autoReplyBody", e.target.value)}
              rows={10}
              className="w-full border rounded px-3 py-2 text-sm font-mono"
            />
          </div>

          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs font-medium text-gray-500 mb-1">{"\u5229\u7528\u53ef\u80fd\u306a\u5909\u6570:"}</p>
            <p className="text-xs text-gray-400">
              {"{{customer_name}} {{store_name}} {{store_address}} {{store_phone}} {{visit_date}} {{visit_time}} {{visit_method}}"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-[#d4a017] text-white rounded font-medium hover:bg-[#b8860b] disabled:opacity-50"
        >
          {saving ? "\u4fdd\u5b58\u4e2d..." : "\u4fdd\u5b58"}
        </button>
        {message && (
          <span className="text-sm text-green-600">{message}</span>
        )}
      </div>
    </div>
  );
}
