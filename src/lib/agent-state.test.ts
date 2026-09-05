import { test } from "node:test";
import assert from "node:assert/strict";
import { nextStateOnInbound, inferStateFromLegacyMemo, stripLegacyMarkers, AGENT_ACTIVE_STATES } from "./agent-state";

// implementation-spec-v1.md §2.2 の遷移表をそのまま検査する
test("受信時の遷移: A層→CONFIRM_PENDING、待ち/B/C→CLASSIFY_PENDING、他は不変", () => {
  assert.equal(nextStateOnInbound("CLASSIFIED_A"), "CONFIRM_PENDING");
  assert.equal(nextStateOnInbound("WAITING_REPLY"), "CLASSIFY_PENDING");
  assert.equal(nextStateOnInbound("FIRST_MAIL_DRAFTED"), "CLASSIFY_PENDING");
  assert.equal(nextStateOnInbound("CLASSIFIED_B"), "CLASSIFY_PENDING");
  assert.equal(nextStateOnInbound("CLASSIFIED_C"), "CLASSIFY_PENDING");
  assert.equal(nextStateOnInbound("CONFIRM_PENDING"), "CLASSIFY_PENDING");
  for (const s of ["NONE", "FIRST_MAIL_PENDING", "BOOKING_DRAFTED", "BOOKED", "MANUAL"] as const) {
    assert.equal(nextStateOnInbound(s), s, s);
  }
});

test("cron が拾う状態は3つだけ", () => {
  assert.deepEqual(AGENT_ACTIVE_STATES, ["FIRST_MAIL_PENDING", "CLASSIFY_PENDING", "CONFIRM_PENDING"]);
});

test("旧 memo マーカーからの推定(進んだ状態を優先)と除去", () => {
  assert.equal(inferStateFromLegacyMemo("[AGENT_PENDING]"), "FIRST_MAIL_PENDING");
  assert.equal(inferStateFromLegacyMemo("[AGENT_DRAFT_READY]"), "FIRST_MAIL_DRAFTED");
  assert.equal(inferStateFromLegacyMemo("[AGENT_DONE]"), "WAITING_REPLY");
  assert.equal(inferStateFromLegacyMemo("[AI分類:A層] 見学したい [CONFIRM_PENDING]"), "CONFIRM_PENDING");
  assert.equal(inferStateFromLegacyMemo("[AI分類:B層] 検討中"), "CLASSIFIED_B");
  assert.equal(inferStateFromLegacyMemo("[アポ確定] 9/10 14:00 090"), "BOOKED");
  assert.equal(inferStateFromLegacyMemo("[アポ確定・下書き] 9/10 14:00"), "BOOKING_DRAFTED");
  assert.equal(inferStateFromLegacyMemo("ただのメモ"), null);
  assert.equal(stripLegacyMarkers("[AGENT_DONE] 電話済み [CLASSIFY_PENDING]"), "電話済み");
  assert.equal(stripLegacyMarkers("[AI分類:A層] 見学したいとのこと"), "見学したいとのこと");
  assert.equal(stripLegacyMarkers(null), "");
});
