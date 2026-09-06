import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, validatePassword, PASSWORD_MIN_LENGTH } from "./password";

test("ハッシュ化したパスワードを検証できる", async () => {
  const hash = await hashPassword("correct-horse-battery");
  assert.equal(await verifyPassword("correct-horse-battery", hash), true);
  assert.equal(await verifyPassword("correct-horse-batterX", hash), false);
});

test("同じパスワードでも毎回違うハッシュになる（ソルトが効いている）", async () => {
  const a = await hashPassword("same-password-1234");
  const b = await hashPassword("same-password-1234");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("same-password-1234", a), true);
  assert.equal(await verifyPassword("same-password-1234", b), true);
});

test("保存形式にパラメータが含まれる（後で強度を上げても既存を検証できる）", async () => {
  const hash = await hashPassword("param-check-1234");
  const parts = hash.split("$");
  assert.equal(parts[0], "scrypt");
  assert.equal(parts.length, 6);
});

test("未設定・壊れた値は必ず false（例外を投げない）", async () => {
  assert.equal(await verifyPassword("x", null), false);
  assert.equal(await verifyPassword("x", undefined), false);
  assert.equal(await verifyPassword("x", ""), false);
  assert.equal(await verifyPassword("x", "not-a-hash"), false);
  assert.equal(await verifyPassword("x", "scrypt$a$b$c$d$e"), false);
  assert.equal(await verifyPassword("x", "bcrypt$1$2$3$4$5"), false);
});

test("全角・半角の表記ゆれを正規化して扱う", async () => {
  const hash = await hashPassword("ｐａｓｓｗｏｒｄ１２３");
  assert.equal(await verifyPassword("password123", hash), true);
});

test("パスワードの強度チェック", () => {
  assert.equal(validatePassword("a".repeat(PASSWORD_MIN_LENGTH)), null);
  assert.match(String(validatePassword("short")), /文字以上/);
  assert.match(String(validatePassword("a".repeat(200))), /文字以内/);
  assert.match(String(validatePassword(" leading-space-pw")), /空白/);
  assert.match(String(validatePassword(undefined)), /入力/);
  assert.match(String(validatePassword(12345678901 as any)), /入力/);
});
