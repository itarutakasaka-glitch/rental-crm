import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifySvixSignature } from "./svix-verify";

const SECRET_RAW = Buffer.from("test-signing-key-for-unit-tests!!").toString("base64");
const SECRET = `whsec_${SECRET_RAW}`;

function sign(id: string, ts: string, body: string, secret = SECRET_RAW) {
  return createHmac("sha256", Buffer.from(secret, "base64")).update(`${id}.${ts}.${body}`).digest("base64");
}

const NOW = 1_760_000_000;
const BODY = JSON.stringify({ type: "email.received", data: { email_id: "e1" } });

test("正しい署名は通る", () => {
  const id = "msg_1", ts = String(NOW);
  const r = verifySvixSignature({
    secret: SECRET, rawBody: BODY, nowSec: NOW,
    headers: { id, timestamp: ts, signature: `v1,${sign(id, ts, BODY)}` },
  });
  assert.equal(r.ok, true);
});

test("鍵ローテーション中の複数署名でもどれか一致すれば通る", () => {
  const id = "msg_2", ts = String(NOW);
  const r = verifySvixSignature({
    secret: SECRET, rawBody: BODY, nowSec: NOW,
    headers: { id, timestamp: ts, signature: `v1,aW52YWxpZA== v1,${sign(id, ts, BODY)}` },
  });
  assert.equal(r.ok, true);
});

test("本文を書き換えたら落ちる", () => {
  const id = "msg_3", ts = String(NOW);
  const sig = `v1,${sign(id, ts, BODY)}`;
  const r = verifySvixSignature({
    secret: SECRET, rawBody: BODY + " ", nowSec: NOW, headers: { id, timestamp: ts, signature: sig },
  });
  assert.equal(r.ok, false);
});

test("5分を超えて古い/新しい署名は落ちる（リプレイ防止）", () => {
  const id = "msg_4", ts = String(NOW - 400);
  const r = verifySvixSignature({
    secret: SECRET, rawBody: BODY, nowSec: NOW,
    headers: { id, timestamp: ts, signature: `v1,${sign(id, ts, BODY)}` },
  });
  assert.equal(r.ok, false);
  assert.match(String(r.reason), /tolerance/);
});

test("ヘッダが欠けていたら落ちる", () => {
  const r = verifySvixSignature({ secret: SECRET, rawBody: BODY, nowSec: NOW, headers: { id: null, timestamp: null, signature: null } });
  assert.equal(r.ok, false);
});

test("別の鍵で署名されていたら落ちる", () => {
  const id = "msg_5", ts = String(NOW);
  const other = Buffer.from("another-key-that-is-not-the-real1").toString("base64");
  const r = verifySvixSignature({
    secret: SECRET, rawBody: BODY, nowSec: NOW,
    headers: { id, timestamp: ts, signature: `v1,${sign(id, ts, BODY, other)}` },
  });
  assert.equal(r.ok, false);
});

test("whsec_ プレフィックスの有無どちらでも同じ結果", () => {
  const id = "msg_6", ts = String(NOW);
  const headers = { id, timestamp: ts, signature: `v1,${sign(id, ts, BODY)}` };
  assert.equal(verifySvixSignature({ secret: SECRET_RAW, rawBody: BODY, nowSec: NOW, headers }).ok, true);
  assert.equal(verifySvixSignature({ secret: SECRET, rawBody: BODY, nowSec: NOW, headers }).ok, true);
});
