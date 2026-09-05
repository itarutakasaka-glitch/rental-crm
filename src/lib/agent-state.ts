import type { AgentState } from "@prisma/client";

// implementation-spec-v1.md §2.2 エージェント処理状態の遷移。
// 以前は Customer.memo の文字列マーカー([AGENT_PENDING] 等)で管理していた。
// 人が編集できる自由記述に業務状態を混ぜず、遷移はこのファイル以外に書かない。

/** cron/agent が拾う状態 */
export const AGENT_ACTIVE_STATES: AgentState[] = ["FIRST_MAIL_PENDING", "CLASSIFY_PENDING", "CONFIRM_PENDING"];

/** 顧客からの受信(メール/LINE/SMS)があった時の遷移 */
export function nextStateOnInbound(state: AgentState): AgentState {
  switch (state) {
    case "CLASSIFIED_A":
      return "CONFIRM_PENDING"; // A層の次の返信はアポ確定へ
    case "WAITING_REPLY":
    case "FIRST_MAIL_DRAFTED":
    case "CLASSIFIED_B":
    case "CLASSIFIED_C":
    case "CLASSIFY_PENDING":
    case "CONFIRM_PENDING":
      return "CLASSIFY_PENDING"; // 再分類(CONFIRM中の返信は新しい返信で判定し直す)
    default:
      return state; // NONE / FIRST_MAIL_PENDING / BOOKING_DRAFTED / BOOKED / MANUAL は変えない
  }
}

/** 旧 memo マーカー → agentState(移行スクリプト用) */
export const LEGACY_MARKER_TO_STATE: { marker: string | RegExp; state: AgentState }[] = [
  { marker: "[CONFIRM_PENDING]", state: "CONFIRM_PENDING" },
  { marker: "[CLASSIFY_PENDING]", state: "CLASSIFY_PENDING" },
  { marker: "[AGENT_PENDING]", state: "FIRST_MAIL_PENDING" },
  { marker: "[AGENT_DRAFT_READY]", state: "FIRST_MAIL_DRAFTED" },
  { marker: "[アポ確定・下書き]", state: "BOOKING_DRAFTED" },
  { marker: "[アポ確定]", state: "BOOKED" },
  { marker: "[AI分類:A層]", state: "CLASSIFIED_A" },
  { marker: "[AI分類:B層]", state: "CLASSIFIED_B" },
  { marker: "[AI分類:C層]", state: "CLASSIFIED_C" },
  { marker: "[AGENT_DONE]", state: "WAITING_REPLY" },
];

const STRIP_RE = /\[(AGENT_PENDING|AGENT_DRAFT_READY|AGENT_DONE|CLASSIFY_PENDING|CONFIRM_PENDING|AI分類:[ABC]層|アポ確定・下書き|アポ確定)\]/g;

/** memo から旧マーカーを取り除く(AI分類の理由文などの平文は残す) */
export function stripLegacyMarkers(memo: string | null | undefined): string {
  return (memo || "").replace(STRIP_RE, "").replace(/[ \t]{2,}/g, " ").trim();
}

/** memo の旧マーカーから agentState を決める。優先順は上の配列順(進んだ状態を優先)。 */
export function inferStateFromLegacyMemo(memo: string | null | undefined): AgentState | null {
  const m = memo || "";
  for (const { marker, state } of LEGACY_MARKER_TO_STATE) {
    if (typeof marker === "string" ? m.includes(marker) : marker.test(m)) return state;
  }
  return null;
}
