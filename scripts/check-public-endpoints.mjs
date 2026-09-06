#!/usr/bin/env node
// implementation-spec-v1.md §8.1b（前半）: 未ログインで保護 route を叩き、
// 401 か 307（ログイン画面へのリダイレクト）で必ず弾かれることを本番に対して確認する。
// 実アカウントが要らないのでそのまま CI / 手元から回せる。
// 3ユーザー（A社・B社・staff）での総当たりは Supabase のテストアカウントが要るため §8.1b の後半で行う。
//
// 使い方:
//   node scripts/check-public-endpoints.mjs [baseUrl]
//   BASE=https://tama-fudosan-crm-2026.vercel.app node scripts/check-public-endpoints.mjs

const BASE = process.argv[2] || process.env.BASE || "https://tama-fudosan-crm-2026.vercel.app";

/** 未ログインで弾かれるべき route（メソッドと期待ステータス） */
const PROTECTED = [
  ["GET", "/api/customers"],
  ["GET", "/api/customers/__nonexistent__"],
  ["GET", "/api/customers/__nonexistent__/records"],
  ["GET", "/api/customers/__nonexistent__/preference"],
  ["GET", "/api/customers/__nonexistent__/schedules"],
  ["GET", "/api/customers/__nonexistent__/duplicates"],
  ["GET", "/api/customers/preference?customerId=__nonexistent__"],
  ["GET", "/api/organization"],
  ["GET", "/api/templates"],
  ["GET", "/api/workflows"],
  ["GET", "/api/statuses"],
  ["GET", "/api/staff"],
  ["GET", "/api/reminders"],
  ["GET", "/api/store-visit-settings"],
  ["GET", "/api/settings/hankyo"],
  ["GET", "/api/agent/cost-rules"],
  ["GET", "/api/agent/snippets"],
  ["GET", "/api/agent/templates"],
  ["POST", "/api/line-link"],
  ["POST", "/api/send-message"],
  ["POST", "/api/broadcast"],
  ["POST", "/api/customers/merge"],
];

/** 共有秘密鍵が要る route（鍵なしで 401 になること） */
const SECRET_REQUIRED = [
  ["GET", "/api/cron/agent"],
  ["GET", "/api/cron/workflow"],
  ["GET", "/api/cron/timeout-check"],
  ["GET", "/api/agent/context/__nonexistent__"],
  ["POST", "/api/agent/send"],
  ["POST", "/api/agent/notify"],
  ["GET", "/api/agent/queue"],
  ["POST", "/api/agent/grant-staff"],
  ["POST", "/api/agent/seed-test-orgs"],
  ["POST", "/api/agent/migrate-agent-state"],
];

/** クエリで秘密鍵を渡しても通ってはいけない（A-5: cron はヘッダのみ） */
const QUERY_SECRET_MUST_FAIL = [["GET", "/api/cron/timeout-check?secret=wrong"]];

async function hit(method, path) {
  const res = await fetch(BASE + path, {
    method,
    redirect: "manual",
    headers: method === "POST" ? { "Content-Type": "application/json" } : {},
    body: method === "POST" ? "{}" : undefined,
  });
  return res.status;
}

const failures = [];
let checked = 0;

async function expectOneOf(method, path, allowed, label) {
  const status = await hit(method, path);
  checked++;
  const ok = allowed.includes(status);
  console.log(`${ok ? "OK " : "NG "} ${label} ${method} ${path} -> ${status} (期待 ${allowed.join("/")})`);
  if (!ok) failures.push(`${label} ${method} ${path} -> ${status}`);
}

const run = async () => {
  console.log(`base: ${BASE}\n`);
  for (const [m, p] of PROTECTED) await expectOneOf(m, p, [401, 307, 302], "[未ログイン]");
  for (const [m, p] of SECRET_REQUIRED) await expectOneOf(m, p, [401], "[鍵なし]");
  for (const [m, p] of QUERY_SECRET_MUST_FAIL) await expectOneOf(m, p, [401], "[クエリ鍵]");

  console.log(`\n${checked - failures.length}/${checked} 件が期待どおり`);
  if (failures.length) {
    console.error(`\n失敗:\n${failures.join("\n")}`);
    process.exit(1);
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
