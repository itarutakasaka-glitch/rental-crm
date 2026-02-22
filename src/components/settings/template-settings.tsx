"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
} from "@/actions/templates";
import Link from "next/link";

const CH_OPTS = [
  { v: "EMAIL", l: "\u2709\uFE0F \u30E1\u30FC\u30EB", c: "#3b82f6" },
  { v: "LINE", l: "\uD83D\uDCAC LINE", c: "#06c755" },
  { v: "SMS", l: "\uD83D\uDCF1 SMS", c: "#d4a017" },
];

const VARS = [
  { label: "{{customer_name}}", desc: "\u9867\u5BA2\u540D" },
  { label: "{{customer_email}}", desc: "\u30E1\u30FC\u30EB" },
  { label: "{{customer_phone}}", desc: "\u96FB\u8A71" },
  { label: "{{staff_name}}", desc: "\u62C5\u5F53\u8005" },
  { label: "{{store_name}}", desc: "\u5E97\u8217\u540D" },
  { label: "{{store_address}}", desc: "\u4F4F\u6240" },
  { label: "{{store_phone}}", desc: "\u5E97\u8217\u96FB\u8A71" },
  { label: "{{property_name}}", desc: "\u7269\u4EF6\u540D" },
  { label: "{{line_url}}", desc: "LINE URL" },
  { label: "{{visit_url}}", desc: "\u4E88\u7D04URL" },
  { label: "{{license_number}}", desc: "\u514D\u8A31\u756A\u53F7" },
];

const URL_BUTTONS = [
  {
    id: "visit",
    label: "\uD83D\uDDD3 \u6765\u5E97\u4E88\u7D04",
    urlVar: "{{visit_url}}",
    text: "\u6765\u5E97\u30FB\u5185\u898B\u4E88\u7D04\u306F\u3053\u3061\u3089",
    color: "#0891b2",
  },
  {
    id: "line",
    label: "\uD83D\uDCAC LINE\u8FFD\u52A0",
    urlVar: "{{line_url}}",
    text: "LINE\u3067\u304A\u6C17\u8EFD\u306B\u3054\u9023\u7D61",
    color: "#06c755",
  },
];

export function TemplateSettings({
  categories,
  organizationId,
}: {
  categories: any[];
  organizationId: string;
}) {
  const allTemplates = categories.flatMap((c: any) =>
    c.templates.map((t: any) => ({ ...t, catName: c.name, categoryId: c.id }))
  );
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [ch, setCh] = useState("EMAIL");
  const [subj, setSubj] = useState("");
  const [body, setBody] = useState("");
  const [isPending, start] = useTransition();
  const [showUrlMenu, setShowUrlMenu] = useState<string | null>(null);
  const router = useRouter();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const edit = (t: any) => {
    setSel(t.id);
    setName(t.name);
    setCh(t.channel);
    setSubj(t.subject || "");
    setBody(t.body);
    setAdding(false);
  };

  const startAdd = () => {
    setAdding(true);
    setSel(null);
    setName("");
    setCh("EMAIL");
    setSubj("");
    setBody("");
  };

  const insertAtCursor = (text: string) => {
    const ta = bodyRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newBody = body.slice(0, start) + text + body.slice(end);
      setBody(newBody);
      setTimeout(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + text.length;
      }, 0);
    } else {
      setBody((b) => b + text);
    }
  };

  const insertUrlButton = (btn: typeof URL_BUTTONS[0]) => {
    const snippet = `\n\n\u25BC ${btn.text}\n${btn.urlVar}\n`;
    insertAtCursor(snippet);
    setShowUrlMenu(null);
  };

  const insertUrlHtmlButton = (btn: typeof URL_BUTTONS[0]) => {
    const snippet = `\n\n[\u25A0 ${btn.text}] ${btn.urlVar}\n`;
    insertAtCursor(snippet);
    setShowUrlMenu(null);
  };

  const save = () => {
    if (!name.trim() || !body.trim()) return;
    start(async () => {
      if (adding && categories[0]) {
        await createTemplate({
          organizationId,
          categoryId: categories[0].id,
          name: name.trim(),
          channel: ch as any,
          subject: subj,
          body,
        });
        setAdding(false);
      } else if (sel) {
        await updateTemplate(sel, {
          name: name.trim(),
          channel: ch as any,
          subject: subj,
          body,
        });
        setSel(null);
      }
      router.refresh();
    });
  };

  const isEditing = sel || adding;

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Link href="/settings" className="text-gray-400 text-sm">
          {"\u2190 \u8A2D\u5B9A"}
        </Link>
        <h1 className="text-lg font-bold">
          {"\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u8A2D\u5B9A"}
        </h1>
        <button
          onClick={startAdd}
          className="ml-auto px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold"
        >
          {"\uFF0B \u8FFD\u52A0"}
        </button>
      </div>

      <div className="flex gap-4">
        <div className={isEditing ? "w-[45%]" : "flex-1"}>
          <div className="bg-white rounded-xl border">
            {allTemplates.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">
                {"\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u304C\u3042\u308A\u307E\u305B\u3093"}
              </div>
            )}
            {allTemplates.map((t: any) => {
              const chC = CH_OPTS.find((c) => c.v === t.channel);
              const active = sel === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => edit(t)}
                  className={`flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 cursor-pointer ${
                    active
                      ? "bg-primary/5 border-l-2 border-l-primary"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background: (chC?.c || "#6b7280") + "15",
                      color: chC?.c,
                    }}
                  >
                    {chC?.l}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="text-[10px] text-gray-400">{t.catName}</div>
                  </div>
                  <div
                    className="flex gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() =>
                        start(async () => {
                          await duplicateTemplate(t.id);
                          router.refresh();
                        })
                      }
                      className="text-[10px] text-gray-300 hover:text-gray-500"
                    >
                      {"\uD83D\uDCCB"}
                    </button>
                    <button
                      onClick={() =>
                        start(async () => {
                          await deleteTemplate(t.id);
                          router.refresh();
                          if (sel === t.id) setSel(null);
                        })
                      }
                      className="text-[10px] text-gray-300 hover:text-red-400"
                    >
                      {"\uD83D\uDDD1"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isEditing && (
          <div className="w-[55%] bg-white rounded-xl border p-4 self-start sticky top-4">
            <div className="flex justify-between mb-3">
              <h3 className="text-sm font-bold">
                {adding
                  ? "\u65B0\u898F\u4F5C\u6210"
                  : "\u7DE8\u96C6"}
              </h3>
              <button
                onClick={() => {
                  setSel(null);
                  setAdding(false);
                }}
                className="text-xs text-gray-400"
              >
                {"\u2715"}
              </button>
            </div>

            <div className="space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={"\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u540D"}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />

              <div className="flex gap-1">
                {CH_OPTS.map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setCh(o.v)}
                    className={`px-2.5 py-1 rounded-md text-xs ${
                      ch === o.v ? "text-white font-semibold" : "text-gray-500"
                    }`}
                    style={{
                      background: ch === o.v ? o.c : "#f1f5f9",
                    }}
                  >
                    {o.l}
                  </button>
                ))}
              </div>

              {ch === "EMAIL" && (
                <input
                  value={subj}
                  onChange={(e) => setSubj(e.target.value)}
                  placeholder={"\u4EF6\u540D"}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              )}

              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={"\u672C\u6587"}
                rows={8}
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono resize-none"
              />

              {/* URL Button insertion */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
                <div className="text-[10px] text-blue-600 font-semibold mb-1.5">
                  {"\uD83D\uDD17 URL\u30DC\u30BF\u30F3\u3092\u633F\u5165"}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {URL_BUTTONS.map((btn) => (
                    <div key={btn.id} className="relative">
                      <button
                        onClick={() =>
                          setShowUrlMenu(showUrlMenu === btn.id ? null : btn.id)
                        }
                        className="px-2.5 py-1.5 rounded-md text-xs font-medium text-white"
                        style={{ background: btn.color }}
                      >
                        {btn.label}
                      </button>
                      {showUrlMenu === btn.id && (
                        <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[180px]">
                          <button
                            onClick={() => insertUrlButton(btn)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b"
                          >
                            {"\uD83D\uDD17 URL\u30EA\u30F3\u30AF\u3068\u3057\u3066\u633F\u5165"}
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {"\u25BC "}{btn.text}{"\n"}{btn.urlVar}
                            </div>
                          </button>
                          <button
                            onClick={() => insertUrlHtmlButton(btn)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                          >
                            {"\u25A0 \u30DC\u30BF\u30F3\u5F62\u5F0F\u3067\u633F\u5165"}
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {"[\u25A0 "}{btn.text}{"] "}{btn.urlVar}
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Variables */}
              <div>
                <div className="text-[10px] text-gray-400 mb-1">
                  {"\u5909\u6570"}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {VARS.map((v) => (
                    <button
                      key={v.label}
                      onClick={() => insertAtCursor(v.label)}
                      className="px-1.5 py-0.5 text-[10px] bg-gray-50 border rounded text-gray-500 hover:bg-gray-100"
                      title={v.desc}
                    >
                      {v.desc}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => {
                    setSel(null);
                    setAdding(false);
                  }}
                  className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs"
                >
                  {"\u30AD\u30E3\u30F3\u30BB\u30EB"}
                </button>
                <button
                  onClick={save}
                  disabled={!name.trim() || !body.trim() || isPending}
                  className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold disabled:opacity-40"
                >
                  {adding
                    ? "\u4F5C\u6210"
                    : "\u66F4\u65B0"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
