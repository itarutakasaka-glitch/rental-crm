// 移植元(heyacules-ai/inquiry-agent/router.test.js)の代表的なケースを移植した回帰テスト。
import { test } from "node:test";
import assert from "node:assert";
import { recommendStore, 受験生ルール有効 } from "./flat-agency-router";

test("1 対応不要物件 → 対応不要・terminal", () => {
  const r = recommendStore({ 対応不要物件: true }, "2026-06-02");
  assert.strictEqual(r.action, "対応不要");
  assert.strictEqual(r.terminal, true);
});

test("1 対応不要物件は短期より先に評価される", () => {
  assert.strictEqual(recommendStore({ 対応不要物件: true, 短期: true }, "2026-06-02").action, "対応不要");
});

test("2 短期 → LINE投稿（本店・左京）", () => {
  const r = recommendStore({ 短期: true }, "2026-06-02");
  assert.strictEqual(r.action, "LINE投稿");
  assert.deepStrictEqual(r.lineTargets, ["本店", "左京店"]);
});

test("3 テナント → LINE投稿（本店・左京）", () => {
  const r = recommendStore({ テナント: true }, "2026-06-02");
  assert.strictEqual(r.action, "LINE投稿");
  assert.deepStrictEqual(r.lineTargets, ["本店", "左京店"]);
});

test("3 短期はテナントより先（両方trueなら短期route）", () => {
  assert.strictEqual(recommendStore({ 短期: true, テナント: true }, "2026-06-02").route, "マンスリー短期");
});

test("4 京大受験生（8/4）→ 左京固定", () => {
  const r = recommendStore({ 受験生: "京都大学", 対応言語: "日本語" }, "2026-08-04");
  assert.strictEqual(r.store, "左京店");
  assert.strictEqual(r.固定, true);
});

test("4 受験生は6月はOFF → ルール無効（全店LINEに落ちる）", () => {
  const r = recommendStore({ 受験生: "京都大学", 対応言語: "日本語" }, "2026-06-02");
  assert.notStrictEqual(r.route, "受験生");
  assert.strictEqual(r.action, "LINE投稿");
});

test("受験生ルール有効: 8月ON / 6月OFF", () => {
  assert.strictEqual(受験生ルール有効("2026-08-01"), true);
  assert.strictEqual(受験生ルール有効("2026-06-30"), false);
});

test("5 英語 → 左京固定", () => {
  const r = recommendStore({ 対応言語: "英語" }, "2026-06-07");
  assert.strictEqual(r.store, "左京店");
  assert.strictEqual(r.固定, true);
});

test("5 中国語（水曜でも）→ 左京固定", () => {
  assert.strictEqual(recommendStore({ 対応言語: "中国語" }, "2026-06-03").store, "左京店");
});

test("5 韓国語 → 要確認フラグ", () => {
  assert.strictEqual(recommendStore({ 対応言語: "韓国語" }, "2026-06-07").要確認, true);
});

test("6 元付京都駅前店 → 本店", () => {
  assert.strictEqual(recommendStore({ 元付京都駅前店: true, 対応言語: "日本語" }, "2026-06-02").store, "本店");
});

test("7 物件あり → いい生活", () => {
  assert.strictEqual(recommendStore({ 物件あり: true, 対応言語: "日本語" }, "2026-06-02").action, "いい生活");
});

test("8 反響店舗記載 → その店舗", () => {
  assert.strictEqual(recommendStore({ 反響店舗: "本店", 対応言語: "日本語" }, "2026-06-02").store, "本店");
});

test("8 店舗名なし・水曜(全店休) → 翌営業日", () => {
  assert.strictEqual(recommendStore({ 対応言語: "日本語" }, "2026-06-03").投稿タイミング, "翌営業日");
});

test("8 店舗名なし・火曜(営業日) → 本日", () => {
  assert.strictEqual(recommendStore({ 対応言語: "日本語" }, "2026-06-02").投稿タイミング, "本日");
});
