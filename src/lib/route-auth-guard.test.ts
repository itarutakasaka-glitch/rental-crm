import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// implementation-spec-v1.md §3 / §8.1b:
// 「新しい API route を認証なしで追加してしまう」を機械的に止める。
// S-1（他社の顧客を読み書きできた）は、routeごとに手で所属チェックを書く運用だったために起きた。
// 3ユーザーでの総当たり（§8.1b）は実アカウントが要るので別途。ここは実アカウント無しで
// CI で毎回回せる静的チェックに絞る。

const API_ROOT = join(process.cwd(), "src/app/api");

// 認証・認可として認めるマーカー
const AUTH_MARKERS = [
  "requireCustomerAccess(",
  "requireAdminUser(",
  "requireUser(",
  "getAuthUserForAction(",
  "getCurrentUser(",
  "verifySharedSecret(",
  "verifyLineSignature(",
  "verifySvixSignature(",
];

// 意図的に公開している route（理由を必ず書く）。ここに足すときは仕様書 §3 の表も更新する。
const PUBLIC_ALLOWLIST: Record<string, string> = {
  "public/visit/[orgId]/route.ts": "来店セルフ予約ページの公開情報（営業時間・来店方法）",
  "store-visit-bookings/route.ts": "顧客本人が入れる来店予約リクエスト（レート制限あり）",
  "track/open/[messageId]/route.ts": "メール開封ピクセル。openedAt/openCount のみ更新",
  "auth/callback/route.ts": "Supabase ログインのコールバック",
};

// 顧客IDを受け取る route は requireCustomerAccess を通す（他の手段で所属判定しない）
const CUSTOMER_SCOPED_EXEMPT: Record<string, string> = {
  "customers/route.ts": "一覧・新規作成。顧客IDを受け取らない",
  "customers/duplicates/route.ts": "自組織全体の重複検出。顧客IDを受け取らない",
  "customers/merge/route.ts": "2顧客の統合。canAccessOrg で両者の所属を確認している",
  "agent/context/[customerId]/route.ts": "外部エージェント用。共有秘密鍵で保護（人のセッションではない）",
  "agent/send/route.ts": "外部エージェント用。共有秘密鍵で保護",
  "agent/notify/route.ts": "外部エージェント用。共有秘密鍵で保護",
  "agent/queue/route.ts": "外部エージェント用。共有秘密鍵で保護",
  "agent/migrate-agent-state/route.ts": "一回限りの管理用。共有秘密鍵で保護",
  "agent/seed-test-orgs/route.ts": "テスト組織の作成・削除。共有秘密鍵で保護",
  "agent/store-routing/apply/route.ts": "canAccessOrg で顧客の所属を確認している",
  "send-message/route.ts": "canAccessOrg で顧客の所属を確認している（エージェント経路もあるため）",
  "messages/[id]/approve/route.ts": "canAccessOrg でメッセージの顧客の所属を確認している",
  "broadcast/route.ts": "customerIds を受けるが、organizationId で絞った顧客だけを対象にしている",
  "cron/agent/route.ts": "cron。共有秘密鍵で保護し、顧客ごとに所属組織の設定を使う",
  "cron/workflow/route.ts": "cron。共有秘密鍵で保護し、顧客ごとに所属組織の設定を使う",
  "webhook/email/route.ts": "受信webhook。宛先から解決した1組織の中だけで顧客を扱う",
  "webhook/line/route.ts": "受信webhook。LINE 署名で検証し、lineUserId から顧客を引く",
  "store-visit-bookings/route.ts": "公開route。organizationId と一致する顧客だけを対象にしている",
  "public/visit/[orgId]/route.ts": "公開route。URL の組織の公開情報のみ",
  "track/open/[messageId]/route.ts": "公開route。開封記録のみ",
};

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === "route.ts" || name === "route.tsx") out.push(p);
  }
  return out;
}

function relKey(file: string) {
  return relative(API_ROOT, file).split(sep).join("/");
}

test("すべての API route が認証マーカーを持つ（公開routeは allowlist に理由付きで登録）", () => {
  const offenders: string[] = [];
  for (const file of walk(API_ROOT)) {
    const key = relKey(file);
    if (key in PUBLIC_ALLOWLIST) continue;
    const src = readFileSync(file, "utf8");
    if (!AUTH_MARKERS.some((m) => src.includes(m))) offenders.push(key);
  }
  assert.deepEqual(
    offenders, [],
    `認証マーカーの無い route:\n${offenders.join("\n")}\n` +
    `公開が意図なら PUBLIC_ALLOWLIST に理由付きで追加し、仕様書 §3 の表も更新すること`
  );
});

test("顧客IDを扱う route は requireCustomerAccess を通す", () => {
  const offenders: string[] = [];
  for (const file of walk(API_ROOT)) {
    const key = relKey(file);
    if (key in CUSTOMER_SCOPED_EXEMPT) continue;
    const src = readFileSync(file, "utf8");
    const takesCustomerId = key.includes("customers/[id]") || /\bcustomerId\b/.test(src);
    if (!takesCustomerId) continue;
    if (!src.includes("requireCustomerAccess(")) offenders.push(key);
  }
  assert.deepEqual(
    offenders, [],
    `顧客IDを扱うのに requireCustomerAccess を通していない route:\n${offenders.join("\n")}\n` +
    `別の方法で所属を確認しているなら CUSTOMER_SCOPED_EXEMPT に理由付きで追加すること`
  );
});

test("共有秘密鍵の独自比較を書かない（verifySharedSecret に統一）", () => {
  const offenders: string[] = [];
  for (const file of walk(API_ROOT)) {
    const src = readFileSync(file, "utf8");
    for (const [i, line] of src.split(/\r?\n/).entries()) {
      const code = line.replace(/\/\/.*$/, "");
      // process.env.CRON_SECRET を直接比較している箇所を検出する
      if (/CRON_SECRET/.test(code) && /[!=]==?/.test(code)) offenders.push(`${relKey(file)}:${i + 1}`);
    }
  }
  assert.deepEqual(offenders, [], `CRON_SECRET の独自比較:\n${offenders.join("\n")}`);
});
