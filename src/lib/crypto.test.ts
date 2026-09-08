import { test, describe } from "node:test";
import assert from "node:assert";

import { encryptSecret, decryptSecret, maskSecret, isEncryptionConfigured } from "./crypto";

// 鍵は呼び出しのたびに process.env から読むので、import の順序に関係なくここで設定すればよい
process.env.CHANNEL_SECRET_KEY = "test-key-for-unit-test";

describe("crypto (会社ごとの秘密情報の暗号化)", () => {
  test("暗号化した値は元に戻せる", () => {
    const plain = "channel-access-token-abcdef1234567890";
    const enc = encryptSecret(plain);
    assert.notStrictEqual(enc, plain, "暗号文が平文と同じになっている");
    assert.strictEqual(decryptSecret(enc), plain);
  });

  test("同じ平文でも毎回違う暗号文になる（IVがランダム）", () => {
    assert.notStrictEqual(encryptSecret("same"), encryptSecret("same"));
  });

  test("改ざんされた値は復号できず null を返す（平文として通さない）", () => {
    const enc = encryptSecret("secret-value");
    const parts = enc.split(".");
    // 暗号文の1文字を書き換える
    parts[3] = parts[3].slice(0, -1) + (parts[3].slice(-1) === "A" ? "B" : "A");
    assert.strictEqual(decryptSecret(parts.join(".")), null);
  });

  test("鍵が変わったら復号できず null を返す", () => {
    const enc = encryptSecret("secret-value");
    const orig = process.env.CHANNEL_SECRET_KEY;
    process.env.CHANNEL_SECRET_KEY = "different-key";
    const got = decryptSecret(enc);
    process.env.CHANNEL_SECRET_KEY = orig;
    assert.strictEqual(got, null);
  });

  test("形式が違う文字列・null は null", () => {
    assert.strictEqual(decryptSecret(null), null);
    assert.strictEqual(decryptSecret(""), null);
    assert.strictEqual(decryptSecret("plaintext-token"), null);
    assert.strictEqual(decryptSecret("v2.a.b.c"), null);
  });

  test("マスク表示に平文の中身が漏れない", () => {
    const plain = "1234567890abcdefghij";
    const masked = maskSecret(encryptSecret(plain))!;
    assert.ok(!masked.includes("567890abcdefgh"), "中身が見えている: " + masked);
    assert.ok(masked.startsWith("1234"));
    assert.ok(masked.endsWith("ghij"));
  });

  test("短い値は完全にマスクする", () => {
    assert.strictEqual(maskSecret(encryptSecret("short")), "********");
  });

  test("復号できない値はマスクではなく再入力を促す", () => {
    assert.strictEqual(maskSecret("v1.broken.broken.broken"), "（復号できません。再入力してください）");
  });

  test("鍵の有無を判定できる", () => {
    assert.strictEqual(isEncryptionConfigured(), true);
    const orig = process.env.CHANNEL_SECRET_KEY;
    delete process.env.CHANNEL_SECRET_KEY;
    assert.strictEqual(isEncryptionConfigured(), false);
    process.env.CHANNEL_SECRET_KEY = orig;
  });
});
