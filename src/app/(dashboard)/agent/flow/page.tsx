"use client";
import { useState, useCallback } from "react";

// ── Templates DB ──
const TEMPLATES: Record<string, { title: string; text: string }> = {
  tpl_1st: { title: "1stメール生成", text: "■ お問い合わせいただいた物件\n・{{property_name}}\n{{property_url}}\n\n⇒ご紹介可能なお部屋です。\n正確な見学可能日時に関しては確認が必要…\n\n{VISIT_PROPOSAL}はご都合いかがでしょうか？" },
  tpl_tent_a: { title: "【未確定a】入居中（見れない）", text: "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\nお問い合わせ物件は現在は入居中となっており、まだ内見のできないお部屋ですので、\n街並み・外観・共用部のご案内やエリア情報の紹介、似ている物件のご紹介ができればと思います。\n\nまた、ぜひ一度店頭で詳しいお話を伺った上で、\nこの他にもお部屋のご紹介ができればと思います。\n\n上記のご案内でよろしければ、\n{visit_proposal}に下記の店舗にてご予約できればと思うのですが、\n【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}" },
  tpl_tent_b: { title: "【未確定b】募集終了", text: "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\nお問い合わせ物件は現在は募集が終了しておりますので、\nぜひ一度店頭で詳しいお話を伺った上で、\nこの他にもお部屋のご紹介ができればと思います。\n\n上記のご案内でよろしければ、\n{visit_proposal}に下記の店舗にてご予約できればと思うのですが、\n【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}" },
  tpl_tent_c: { title: "【未確定c】見れる（募集中）", text: "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\n当日は一度店頭で詳しいお話を伺った上で、いくつか物件を紹介いたします。\nお問い合わせの物件に加えて、候補物件を洗い出した上で、\n一気に回る流れでご案内できればと思います。\n\nそれでは{visit_proposal}に下記の店舗にてご予約できればと思うのですが、\n【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}" },
  tpl_tent_d: { title: "【未確定d】建築中（見れない）", text: "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\nお問い合わせ物件は現在は建築中となっており、まだ内見のできないお部屋ですので、\n街並み・現状の外観のご案内やエリア情報の紹介、似ている物件のご紹介ができればと思います。\n\n上記のご案内でよろしければ、\n{visit_proposal}に下記の店舗にてご予約できればと思うのですが、\n【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}" },
  tpl_confirm: { title: "【確定】アポ確定メール", text: "{{customer_name}}様\n\nご予約を確定いたしました。ありがとうございます。\n\n================================================\n【ご予約内容】\n日時：{appointment_datetime}\n場所：{appointment_location}\n================================================\n\n当日は以下をお持ちいただけますとスムーズです。\n・顔写真付きの身分証\n・印鑑（認印で可）" },
  tpl_b_time: { title: "B層: 引越し時期確認", text: "お引越しの時期はいつ頃をご予定されていますか？\n\n時期に合わせて最適なお部屋探しの進め方をご案内いたします。" },
  tpl_b_push: { title: "B層: 来店すべきと言い切る", text: "ご入居が2ヶ月以内ということであれば、\n物件の動きが非常に早い時期ですので、\nぜひ一度ご来店いただき、最新の物件情報を\nご確認いただくことを強くおすすめいたします。" },
  tpl_fu1: { title: "追客①当日", text: "人気エリアは物件の動きが非常に早く、数日で埋まるケースがございます。\nお早めにご来店いただき、最新の物件情報をご確認くださいませ。" },
  tpl_fu2: { title: "追客②翌日", text: "ご希望のエリアや沿線、家賃の上限、間取り、こだわり条件があればお教えくださいませ。" },
  tpl_fu3: { title: "追客③2日後", text: "人気物件は公開から数日で申込が入ってしまうケースが増えております。最新の空室状況をご確認ください。" },
  tpl_fu4: { title: "追客④5日後", text: "新着物件やネット非掲載の物件もございますので、ぜひ一度ご来店くださいませ。" },
  tpl_fu5: { title: "追客⑤10日後", text: "お引越し時期はいつ頃をご予定されていますか？\nいつでもお気軽にご連絡くださいませ。" },
  tpl_slot: { title: "日程提示", text: "以下の日程でご都合の良いお時間をお選びください。\n\n①3/29(土) 10:00〜\n②3/29(土) 13:00〜\n③3/30(日) 10:00〜\n\n番号でお返事いただけますと幸いです。" },
};

// ── Styles ──
const S = {
  page: { padding: "20px 24px", maxWidth: 920, margin: "0 auto", fontFamily: "'Rajdhani', 'Noto Sans JP', sans-serif" } as const,
  h1: { fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#1a1a1a" } as const,
  sub: { fontSize: 11, color: "#888", marginBottom: 20 } as const,
  phaseHdr: { display: "flex", alignItems: "center", gap: 10, margin: "28px 0 12px" } as const,
  badge: (c: string) => ({ fontSize: 10, fontWeight: 700, color: "#fff", background: c, padding: "3px 10px", borderRadius: 4 }) as const,
  phTitle: { fontSize: 16, fontWeight: 700 } as const,
  flow: (c: string) => ({ position: "relative" as const, paddingLeft: 28, borderLeft: `3px dashed ${c}30`, marginLeft: 16, marginBottom: 8 }),
  node: (active: boolean) => ({
    position: "relative" as const, marginBottom: 12, background: "#fff", border: `1px solid ${active ? "#0891b2" : "#e5e7eb"}`,
    borderRadius: 10, padding: "12px 14px", cursor: "default", transition: ".15s",
    boxShadow: active ? "0 2px 12px rgba(8,145,178,.15)" : "none",
  }),
  clickable: { cursor: "pointer" } as const,
  bnum: {
    position: "absolute" as const, left: -42, top: 10, fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9, fontWeight: 700, color: "#fff", background: "#1a1a1a", padding: "2px 6px", borderRadius: 10,
  } as const,
  agentTag: (c: string) => ({ fontSize: 9, fontWeight: 700, color: "#fff", background: c, padding: "1px 7px", borderRadius: 4, marginRight: 6 }),
  label: { fontSize: 13, fontWeight: 700 } as const,
  desc: { fontSize: 11, color: "#666", lineHeight: 1.5, marginTop: 2 } as const,
  arrow: { textAlign: "center" as const, color: "#bbb", fontSize: 16, margin: "6px 0" } as const,
  splitGrid: (cols: number) => ({ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, marginBottom: 12 }),
  splitItem: (c: string, active: boolean) => ({
    background: "#fff", border: `1px solid ${active ? c : "#e5e7eb"}`, borderLeft: `3px solid ${c}`,
    borderRadius: 8, padding: "10px 12px", cursor: "pointer", position: "relative" as const,
    boxShadow: active ? `0 2px 8px ${c}20` : "none", transition: ".15s",
  }),
  splitNum: { position: "absolute" as const, top: 5, right: 5, fontFamily: "'JetBrains Mono'", fontSize: 8, fontWeight: 700, color: "#fff", background: "#333", padding: "1px 5px", borderRadius: 8 } as const,
  splitTag: (bg: string, fg: string) => ({ fontSize: 9, fontWeight: 700, background: bg, color: fg, padding: "1px 6px", borderRadius: 3, display: "inline-block", marginBottom: 3 }),
  splitTitle: { fontSize: 12, fontWeight: 700, marginBottom: 2 } as const,
  splitDesc: { fontSize: 10, color: "#888", lineHeight: 1.4 } as const,
};

// ── Sub-components ──
function Badge({ color, text }: { color: string; text: string }) {
  return <span style={S.badge(color)}>{text}</span>;
}
function Arrow({ text }: { text?: string }) {
  return <div style={S.arrow}>{text || "▼"}</div>;
}
function Num({ n }: { n: string }) {
  return n ? <span style={S.bnum}>{n}</span> : null;
}

function FlowNode({ num, label, desc, color, tplKey, onEdit, editing }: {
  num: string; label: string; desc: string; color?: string; tplKey?: string;
  onEdit: (k: string) => void; editing: boolean;
}) {
  return (
    <div
      style={{ ...S.node(editing), ...(tplKey ? S.clickable : {}) }}
      onClick={() => tplKey && onEdit(tplKey)}
      onMouseEnter={e => tplKey && ((e.currentTarget as HTMLDivElement).style.borderColor = "#0891b2")}
      onMouseLeave={e => !editing && tplKey && ((e.currentTarget as HTMLDivElement).style.borderColor = "#e5e7eb")}
    >
      <Num n={num} />
      <div style={{ display: "flex", alignItems: "center" }}>
        {color && <span style={S.agentTag(color)}>Agent</span>}
        <span style={S.label}>{label}</span>
        {tplKey && <span style={{ marginLeft: "auto", fontSize: 10, color: "#aaa" }}>✏️</span>}
      </div>
      {desc && <div style={S.desc}>{desc}</div>}
    </div>
  );
}

function SplitCard({ num, label, desc, color, tagBg, tagFg, tagText, tplKey, onEdit, editing }: {
  num: string; label: string; desc: string; color: string;
  tagBg: string; tagFg: string; tagText: string;
  tplKey?: string; onEdit: (k: string) => void; editing: boolean;
}) {
  return (
    <div style={S.splitItem(color, editing)} onClick={() => tplKey && onEdit(tplKey)}>
      <span style={S.splitNum}>{num}</span>
      <span style={S.splitTag(tagBg, tagFg)}>{tagText}</span>
      <div style={S.splitTitle}>{label}</div>
      <div style={S.splitDesc}>{desc}</div>
    </div>
  );
}

function EditPanel({ tplKey, onClose, templates, onChange }: {
  tplKey: string; onClose: () => void;
  templates: Record<string, { title: string; text: string }>;
  onChange: (key: string, text: string) => void;
}) {
  const t = templates[tplKey];
  if (!t) return null;
  return (
    <div style={{ background: "#111", borderRadius: 10, padding: 16, margin: "12px 0", color: "#eee" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>✏️ {t.title}</span>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #444", color: "#999", borderRadius: 6, padding: "3px 12px", fontSize: 10, cursor: "pointer" }}>閉じる ×</button>
      </div>
      <textarea
        value={t.text}
        onChange={e => onChange(tplKey, e.target.value)}
        style={{ width: "100%", minHeight: 180, background: "#0a0a0a", color: "#ddd", border: "1px solid #333", borderRadius: 8, padding: 10, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box" }}
        onFocus={e => (e.target.style.borderColor = "#0891b2")}
        onBlur={e => (e.target.style.borderColor = "#333")}
      />
      <div style={{ fontSize: 9, color: "#555", marginTop: 4 }}>
        {"変数: {{customer_name}} {{store_name}} {{staff_name}} {{visit_url}} {{line_url}} {visit_proposal} {store_access}"}
      </div>
    </div>
  );
}

// ── Main Page ──
export default function AgentFlowPage() {
  const [editing, setEditing] = useState<string | null>(null);
  const [tpls, setTpls] = useState(TEMPLATES);
  const edit = useCallback((k: string) => setEditing(prev => prev === k ? null : k), []);
  const changeTpl = useCallback((k: string, text: string) => {
    setTpls(prev => ({ ...prev, [k]: { ...prev[k], text } }));
  }, []);

  const E = (k: string) => editing === k;

  return (
    <div style={S.page}>
      <h1 style={S.h1}>🤖 AIエージェント 会話フロー</h1>
      <div style={S.sub}>ノードをクリックでテンプレートを編集 · 分岐番号 <span style={{ fontFamily: "'JetBrains Mono'", color: "#555" }}>X-Y</span></div>

      {/* ── PHASE 1 ── */}
      <div style={S.phaseHdr}><Badge color="#0891b2" text="PHASE 1" /><span style={S.phTitle}>反響取り込み</span></div>
      <div style={S.flow("#0891b2")}>
        <FlowNode num="1-1" label="📩 ポータル反響受信" desc="SUUMO / APAMANSHOP / HOME'S → Webhook → パーサー → 顧客レコード作成" onEdit={edit} editing={false} />
      </div>
      <Arrow />

      {/* ── PHASE 2 ── */}
      <div style={S.phaseHdr}><Badge color="#a855f7" text="PHASE 2" /><span style={S.phTitle}>AI初回返信 — PropertyCheckAgent</span></div>
      <div style={S.flow("#a855f7")}>
        <FlowNode num="2-1" label="🔍 空室状況判定（8パターン）" desc="A:見学可能 / B:入居中(他部屋ナシ) / C:入居中(他部屋アリ) / D:建築中 / E:相談(不明) / F:募集終了(他部屋ナシ) / G:募集終了(他部屋アリ) / H:予約" color="#a855f7" onEdit={edit} editing={false} />
        <Arrow />
        <FlowNode num="2-2" label="📧 1stメール生成・送信" desc="プレヘッダー + 挨拶 + LINE誘導 + 空室定型文 + コメント回答 + 来店CTA + 署名" tplKey="tpl_1st" onEdit={edit} editing={E("tpl_1st")} />
        {editing === "tpl_1st" && <EditPanel tplKey="tpl_1st" onClose={() => setEditing(null)} templates={tpls} onChange={changeTpl} />}
      </div>
      <Arrow />

      {/* ── PHASE 3: ABC分類 ── */}
      <div style={S.phaseHdr}><Badge color="#d4a017" text="PHASE 3" /><span style={S.phTitle}>顧客返信 → ABC層分類 — ClassifyAgent</span></div>
      <div style={S.flow("#d4a017")}>
        <FlowNode num="3-1" label="🏷️ 返信内容からABC層を判定" desc="反響研究所のABC層分類法に準拠" color="#d4a017" onEdit={edit} editing={false} />
        <Arrow />
        <div style={S.splitGrid(3)}>
          <SplitCard num="3-2" label="アポ方向" desc="「●日に見学したい」等 → 【未確定】テンプレート" color="#22c55e" tagBg="#dcfce7" tagFg="#166534" tagText="A層" onEdit={edit} editing={false} />
          <SplitCard num="3-3" label="非アポ方向" desc="「検討します」「費用は？」等 → ソムリエ理論で誘導" color="#eab308" tagBg="#fef9c3" tagFg="#854d0e" tagText="B層" onEdit={edit} editing={false} />
          <SplitCard num="3-4" label="返信なし" desc="1stメールへの無反応 → FollowUpAgent（追客5回）" color="#ef4444" tagBg="#fee2e2" tagFg="#991b1b" tagText="C層" onEdit={edit} editing={false} />
        </div>
      </div>

      {/* ── A層 詳細 ── */}
      <div style={S.phaseHdr}><Badge color="#22c55e" text="A層" /><span style={S.phTitle}>アポ組みフロー — 【未確定】→ 了承 →【確定】</span></div>
      <div style={S.flow("#22c55e")}>
        <FlowNode num="3-2-1" label="📋 【未確定】パターン選択" desc="空室状況に応じて4パターン。リスク説明 + 日時提案 + 電話番号要求" onEdit={edit} editing={false} />
        <Arrow />
        <div style={S.splitGrid(2)}>
          <SplitCard num="3-2-2a" label="a. 入居中（見れない）" desc="外観・共用部・エリア案内 + 他物件紹介" color="#34d399" tagBg="#e0f2fe" tagFg="#075985" tagText="未確定a" tplKey="tpl_tent_a" onEdit={edit} editing={E("tpl_tent_a")} />
          <SplitCard num="3-2-2b" label="b. 募集終了" desc="他物件紹介で来店誘導" color="#34d399" tagBg="#e0f2fe" tagFg="#075985" tagText="未確定b" tplKey="tpl_tent_b" onEdit={edit} editing={E("tpl_tent_b")} />
          <SplitCard num="3-2-2c" label="c. 見れる（募集中）" desc="店頭ヒアリング → 候補洗い出し → 一気に回る" color="#34d399" tagBg="#e0f2fe" tagFg="#075985" tagText="未確定c" tplKey="tpl_tent_c" onEdit={edit} editing={E("tpl_tent_c")} />
          <SplitCard num="3-2-2d" label="d. 建築中（見れない）" desc="外観・現状案内 + 他物件紹介" color="#34d399" tagBg="#e0f2fe" tagFg="#075985" tagText="未確定d" tplKey="tpl_tent_d" onEdit={edit} editing={E("tpl_tent_d")} />
        </div>
        {(["tpl_tent_a","tpl_tent_b","tpl_tent_c","tpl_tent_d"] as const).map(k => editing === k && <EditPanel key={k} tplKey={k} onClose={() => setEditing(null)} templates={tpls} onChange={changeTpl} />)}
        <Arrow text="▼ 顧客了承返信" />
        <FlowNode num="4-1" label="✅ ConfirmAgent — アポ確定" desc="顧客了承 → 【確定】メール送信 ＋ ここで初めて担当者に通知" color="#14b8a6" tplKey="tpl_confirm" onEdit={edit} editing={E("tpl_confirm")} />
        {editing === "tpl_confirm" && <EditPanel tplKey="tpl_confirm" onClose={() => setEditing(null)} templates={tpls} onChange={changeTpl} />}
        <Arrow />
        <FlowNode num="4-2" label="🔔 担当者に通知" desc="日時・場所・電話番号・物件情報を担当者へ連携" onEdit={edit} editing={false} />
      </div>

      {/* ── B層 詳細 ── */}
      <div style={S.phaseHdr}><Badge color="#eab308" text="B層" /><span style={S.phTitle}>ソムリエ理論で来店誘導</span></div>
      <div style={S.flow("#eab308")}>
        <FlowNode num="3-3-1" label="🗓 引越し時期を聞く" desc="ソムリエ理論の起点: まず引越し時期を確認" tplKey="tpl_b_time" onEdit={edit} editing={E("tpl_b_time")} />
        {editing === "tpl_b_time" && <EditPanel tplKey="tpl_b_time" onClose={() => setEditing(null)} templates={tpls} onChange={changeTpl} />}
        <Arrow />
        <div style={S.splitGrid(2)}>
          <SplitCard num="3-3-2" label="2ヶ月以内" desc="「来店すべき」と言い切る → アポOK→SchedulingAgent / アポNG→オンライン提案 / それもNG→FollowUpか終了" color="#eab308" tagBg="#fef9c3" tagFg="#854d0e" tagText="2ヶ月以内" tplKey="tpl_b_push" onEdit={edit} editing={E("tpl_b_push")} />
          <SplitCard num="3-3-3" label="2ヶ月より先" desc="「時期を早められる？」→ 可能なら2ヶ月以内フローへ / 不可→FollowUpAgent" color="#f97316" tagBg="#fff7ed" tagFg="#c2410c" tagText="2ヶ月より先" onEdit={edit} editing={false} />
        </div>
        {editing === "tpl_b_push" && <EditPanel tplKey="tpl_b_push" onClose={() => setEditing(null)} templates={tpls} onChange={changeTpl} />}
      </div>

      {/* ── C層 詳細 ── */}
      <div style={S.phaseHdr}><Badge color="#ef4444" text="C層" /><span style={S.phTitle}>追客5回 — FollowUpAgent</span></div>
      <div style={S.flow("#ef4444")}>
        {([
          { num: "3-4-1", label: "① 当日: 空室リマインド", desc: "空室確認リマインド + 来店誘導", k: "tpl_fu1" },
          { num: "3-4-2", label: "② 翌日: 条件ヒアリング", desc: "希望エリア・家賃・間取り等を質問", k: "tpl_fu2" },
          { num: "3-4-3", label: "③ 2日後: 緊急性演出", desc: "人気物件は数日で終了する旨を伝える", k: "tpl_fu3" },
          { num: "3-4-4", label: "④ 5日後: 別角度アプローチ", desc: "新着物件・ネット非掲載物件の案内", k: "tpl_fu4" },
          { num: "3-4-5", label: "⑤ 10日後: 最終フォロー", desc: "引越し時期確認 + 長期顧客化", k: "tpl_fu5" },
        ] as const).map((item, i) => (
          <div key={item.k}>
            {i > 0 && <Arrow />}
            <FlowNode num={item.num} label={item.label} desc={item.desc} tplKey={item.k} onEdit={edit} editing={E(item.k)} />
            {editing === item.k && <EditPanel tplKey={item.k} onClose={() => setEditing(null)} templates={tpls} onChange={changeTpl} />}
          </div>
        ))}
        <Arrow />
        <FlowNode num="3-4-6" label="📦 ロングフォロー or 終了" desc="復活率2%以下 — 5回で追客終了。条件合致物件があれば自動送信でキープ" onEdit={edit} editing={false} />
      </div>

      {/* ── PHASE 4: 日程調整 ── */}
      <div style={S.phaseHdr}><Badge color="#0891b2" text="PHASE 4" /><span style={S.phTitle}>日程調整 — SchedulingAgent</span></div>
      <div style={S.flow("#0891b2")}>
        <FlowNode num="4-3" label="📅 カレンダーから空き枠取得" desc="Google/サイボウズ/Timetree/CRM連携。3h枠 / 優先10・13・16時 / 定休日除外" color="#0891b2" onEdit={edit} editing={false} />
        <Arrow />
        <FlowNode num="4-4" label="📅 候補日時を選択肢で提示" desc="例:「①3/29(土)10:00〜 ②3/29(土)13:00〜 ③3/30(日)10:00〜」→ 番号で選択" tplKey="tpl_slot" onEdit={edit} editing={E("tpl_slot")} />
        {editing === "tpl_slot" && <EditPanel tplKey="tpl_slot" onClose={() => setEditing(null)} templates={tpls} onChange={changeTpl} />}
        <Arrow />
        <div style={S.splitGrid(3)}>
          <SplitCard num="4-5a" label="🏪 来店（優先）" desc="" color="#0891b2" tagBg="#e0f2fe" tagFg="#075985" tagText="来店" onEdit={edit} editing={false} />
          <SplitCard num="4-5b" label="📍 現地待ち合わせ" desc="" color="#0891b2" tagBg="#e0f2fe" tagFg="#075985" tagText="現地" onEdit={edit} editing={false} />
          <SplitCard num="4-5c" label="💻 オンライン" desc="" color="#0891b2" tagBg="#e0f2fe" tagFg="#075985" tagText="オンライン" onEdit={edit} editing={false} />
        </div>
      </div>
      <Arrow />

      {/* ── PHASE 5: アポ確定 ── */}
      <div style={S.phaseHdr}><Badge color="#14b8a6" text="PHASE 5" /><span style={S.phTitle}>アポ確定 — ConfirmAgent</span></div>
      <div style={S.flow("#14b8a6")}>
        <FlowNode num="5-1" label="📅 カレンダーに予定作成" desc="API経由で自動登録" color="#14b8a6" onEdit={edit} editing={false} />
        <Arrow />
        <FlowNode num="5-2" label="📧 確認メール送信" desc="顧客へ予約確認メール" tplKey="tpl_confirm" onEdit={edit} editing={E("tpl_confirm")} />
        <Arrow />
        <FlowNode num="5-3" label="🔔 担当者に引き継ぎ" desc="LINE/Slack等で報告 → ステータス「アポ組」→ 担当者変更" onEdit={edit} editing={false} />
      </div>

      {/* ── Legend ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", margin: "28px 0 12px", padding: 10, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
        {[
          { c: "#a855f7", l: "PropertyCheckAgent" }, { c: "#d4a017", l: "ClassifyAgent" },
          { c: "#22c55e", l: "A層 (アポ組み)" }, { c: "#eab308", l: "B層 (ソムリエ)" },
          { c: "#ef4444", l: "C層 (追客)" }, { c: "#0891b2", l: "SchedulingAgent" }, { c: "#14b8a6", l: "ConfirmAgent" },
        ].map(i => (
          <span key={i.l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#666" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: i.c, display: "inline-block" }} />{i.l}
          </span>
        ))}
      </div>
    </div>
  );
}
