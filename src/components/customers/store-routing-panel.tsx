"use client";
import { useState } from "react";

// inquiry-agent(対応店舗判断エージェント)のCRM組み込み版パネル。
// 元の拡張と同じ「ガイド方式」: 推奨・下書きを出すだけで、送信・タグ付けは人間が手動で行う。
// 現状はフラットエージェンシー固有ロジックのみ(store-hierarchy-design.md参照)。

type DraftResult = {
  recommendation: { action: string; store: string | null; route: string; 理由: string; hint?: string | null };
  必要な操作: string[];
  drafts: { comment?: string; lineMention?: string; mail?: { 言語: string; 本文: string } };
};

function CopyField({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-gray-500">{label}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-[10px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold"
        >
          {copied ? "コピーしました" : "コピー"}
        </button>
      </div>
      <div className="p-2 border rounded-lg text-xs whitespace-pre-wrap bg-gray-50">{text}</div>
    </div>
  );
}

export function StoreRoutingPanel({ customerName }: { customerName: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState({
    対応不要物件: false,
    短期: false,
    テナント: false,
    受験生: "" as "" | "京都大学" | "京都工芸繊維大学",
    対応言語: "日本語",
    元付京都駅前店: false,
    物件あり: false,
    反響店舗: "",
  });
  const [result, setResult] = useState<DraftResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/agent/store-routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          反響: {
            対応不要物件: input.対応不要物件,
            短期: input.短期,
            テナント: input.テナント,
            受験生: input.受験生 || null,
            対応言語: input.対応言語,
            元付京都駅前店: input.元付京都駅前店,
            物件あり: input.物件あり,
            反響店舗: input.反響店舗 || null,
          },
          customer: { name: customerName },
          dateStr: new Date().toISOString().slice(0, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "判定に失敗しました");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <button onClick={() => setOpen(!open)} className="w-full text-left text-sm font-bold mb-2 flex items-center justify-between">
        <span>店舗振り分け（推奨・下書き）</span>
        <span className="text-gray-400 text-xs">{open ? "閉じる" : "開く"}</span>
      </button>
      {open && (
        <div className="p-3 border rounded-lg bg-slate-50 text-xs space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={input.対応不要物件} onChange={(e) => setInput({ ...input, 対応不要物件: e.target.checked })} />
            対応不要物件
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={input.短期} onChange={(e) => setInput({ ...input, 短期: e.target.checked })} />
            マンスリー/短期
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={input.テナント} onChange={(e) => setInput({ ...input, テナント: e.target.checked })} />
            テナント/事務所利用
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={input.元付京都駅前店} onChange={(e) => setInput({ ...input, 元付京都駅前店: e.target.checked })} />
            元付が京都駅前店
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={input.物件あり} onChange={(e) => setInput({ ...input, 物件あり: e.target.checked })} />
            物件指定あり
          </label>
          <div>
            <span className="block mb-1 text-gray-500">受験生</span>
            <select value={input.受験生} onChange={(e) => setInput({ ...input, 受験生: e.target.value as any })} className="w-full px-2 py-1 border rounded">
              <option value="">なし</option>
              <option value="京都大学">京都大学</option>
              <option value="京都工芸繊維大学">京都工芸繊維大学</option>
            </select>
          </div>
          <div>
            <span className="block mb-1 text-gray-500">対応言語</span>
            <select value={input.対応言語} onChange={(e) => setInput({ ...input, 対応言語: e.target.value })} className="w-full px-2 py-1 border rounded">
              <option value="日本語">日本語</option>
              <option value="英語">英語</option>
              <option value="中国語">中国語</option>
              <option value="韓国語">韓国語</option>
            </select>
          </div>
          <div>
            <span className="block mb-1 text-gray-500">反響本文に店舗名の記載</span>
            <select value={input.反響店舗} onChange={(e) => setInput({ ...input, 反響店舗: e.target.value })} className="w-full px-2 py-1 border rounded">
              <option value="">記載なし</option>
              <option value="左京店">左京店</option>
              <option value="本店">本店</option>
              <option value="産大前店">産大前店</option>
            </select>
          </div>

          <button onClick={run} disabled={loading} className="w-full py-1.5 bg-primary text-white rounded-lg font-semibold disabled:opacity-40">
            {loading ? "判定中..." : "判定して下書きを作る"}
          </button>

          {error && <div className="text-red-500">{error}</div>}

          {result && (
            <div className="mt-2 pt-2 border-t">
              <div className="font-semibold mb-1">
                推奨: {result.recommendation.store || "（店舗指定なし）"}
                <span className="ml-1 text-gray-400 font-normal">({result.recommendation.route})</span>
              </div>
              <div className="text-gray-500 mb-2">{result.recommendation.理由}</div>
              <div className="text-gray-500 mb-2">
                必要な操作: {result.必要な操作.join(" / ")}
              </div>
              {result.drafts.mail && <CopyField label={`初回メール(${result.drafts.mail.言語})`} text={result.drafts.mail.本文} />}
              {result.drafts.lineMention && <CopyField label="グループLINE投稿文" text={result.drafts.lineMention} />}
              {result.drafts.comment && <CopyField label="社内向けコメント" text={result.drafts.comment} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
