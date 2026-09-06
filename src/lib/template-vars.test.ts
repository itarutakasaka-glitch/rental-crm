import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTemplateVars, buildVisitUrl, lineInviteUrl, listTemplateVarNames } from "./template-vars";

const org = {
  id: "org_1", name: "テスト不動産", storeName: "本店", storeAddress: "京都市", storePhone: "075-000-0000",
  storeHours: "10:00-19:00", lineUrl: "", licenseNumber: "京都(1)第1号",
};
const customer = {
  id: "cus_1", organizationId: "org_1", name: "山田太郎", email: "y@example.com", phone: "090-0000-0000",
  assignee: { name: "担当A" }, properties: [{ name: "テストマンション", url: "https://example.com/p" }],
};

test("主要な変数が置換される", () => {
  const out = resolveTemplateVars(
    "{{customer_name}}様 {{company_name}}/{{store_name}} {{store_phone}} {{property_name}} {{staff_name}}",
    { customer, org }
  );
  assert.equal(out, "山田太郎様 テスト不動産/本店 075-000-0000 テストマンション 担当A");
});

test("staffName を明示すると担当者名より優先される", () => {
  assert.equal(resolveTemplateVars("{{staff_name}}", { customer, org, staffName: "送信者B" }), "送信者B");
  assert.equal(resolveTemplateVars("{{staff_name}}", { customer, org }), "担当A");
});

test("visit_url は組織IDから作る（実在しない既定値を混ぜない）", () => {
  const out = resolveTemplateVars("{{visit_url}}", { customer, org });
  assert.ok(out.endsWith("/visit/org_1?c=cus_1"), out);
  // 組織IDが取れない場合は空にする（壊れたURLを送らない）
  assert.equal(resolveTemplateVars("{{visit_url}}", { customer: { id: "x" }, org: {} }), "");
});

test("line_url は既定で空、明示した呼び出し元だけ暫定既定値", () => {
  assert.equal(resolveTemplateVars("{{line_url}}", { customer, org }), "");
  assert.ok(resolveTemplateVars("{{line_url}}", { customer, org, useLegacyLineFallback: true }).includes("line.me"));
  // 会社に設定があればそれが最優先
  assert.equal(
    resolveTemplateVars("{{line_url}}", { customer, org: { ...org, lineUrl: "https://line.me/own" }, useLegacyLineFallback: true }),
    "https://line.me/own"
  );
});

test("extra で画面固有の変数を足せる", () => {
  const out = resolveTemplateVars("{{visit_date}} {{visit_time}} {{num_guests}}", {
    customer, org, extra: { visit_date: "2026-09-10", visit_time: "14:00", num_guests: 2 },
  });
  assert.equal(out, "2026-09-10 14:00 2");
});

test("未知の変数はそのまま残す（黙って消さない）", () => {
  assert.equal(resolveTemplateVars("{{unknown_var}}", { customer, org }), "{{unknown_var}}");
});

test("置換した値の中の {{...}} を二重展開しない", () => {
  const out = resolveTemplateVars("{{customer_name}}", { customer: { ...customer, name: "{{store_name}}" }, org });
  assert.equal(out, "{{store_name}}");
});

test("null/空文字の入力は空文字を返す", () => {
  assert.equal(resolveTemplateVars(null, { customer, org }), "");
  assert.equal(resolveTemplateVars("", { customer, org }), "");
});

test("buildVisitUrl / lineInviteUrl / listTemplateVarNames", () => {
  assert.equal(buildVisitUrl(""), "");
  assert.ok(buildVisitUrl("org_9").endsWith("/visit/org_9"));
  assert.ok(lineInviteUrl({}).includes("line.me"));
  assert.equal(lineInviteUrl({ lineUrl: "https://x" }), "https://x");
  const names = listTemplateVarNames();
  for (const key of ["customer_name", "store_name", "visit_url", "line_url"]) assert.ok(names.includes(key), key);
});
