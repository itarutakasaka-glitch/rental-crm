import { test, describe } from "node:test";
import assert from "node:assert";
import { decideEmail, decideLine, decideSms, lineInviteUrlFrom, type ChannelRow } from "./channel-decision";

// implementation-spec-v1.md §6 の一番危ない部分を固定する:
//   「会社が止めているのに、ヘヤクレス既定の名義で送ってしまう」ことが起きないこと。

function row(over: Partial<ChannelRow> = {}): ChannelRow {
  return {
    isActive: true,
    fromName: null,
    fromAddress: null,
    lineChannelId: null,
    lineBasicId: null,
    smsFromNumber: null,
    secretEnc: null,
    webhookSecretEnc: null,
    ...over,
  };
}
const asIs = (v: string | null) => v;

describe("channel-decision: メール", () => {
  test("設定が無ければシステム既定を使う（移行期間）", () => {
    assert.strictEqual(decideEmail(null).kind, "default");
  });

  test("無効化されていたら既定に落とさずブロックする", () => {
    const d = decideEmail(row({ isActive: false, fromAddress: "a@example.com" }));
    assert.strictEqual(d.kind, "blocked");
  });

  test("有効でも差出人アドレスが空ならブロックする（既定で送らない）", () => {
    assert.strictEqual(decideEmail(row({ isActive: true, fromAddress: null })).kind, "blocked");
    assert.strictEqual(decideEmail(row({ isActive: true, fromAddress: "" })).kind, "blocked");
  });

  test("有効かつアドレスがあればその設定で送る", () => {
    const d = decideEmail(row({ fromName: "○○不動産", fromAddress: "info@example.com" }));
    assert.strictEqual(d.kind, "use");
    if (d.kind === "use") {
      assert.strictEqual(d.value.fromAddress, "info@example.com");
      assert.strictEqual(d.value.fromName, "○○不動産");
    }
  });
});

describe("channel-decision: LINE", () => {
  test("設定が無ければ既定", () => {
    assert.strictEqual(decideLine(null, asIs).kind, "default");
  });

  test("無効化されていたらブロック", () => {
    assert.strictEqual(decideLine(row({ isActive: false, secretEnc: "tok" }), asIs).kind, "blocked");
  });

  test("トークンが復号できないときはブロック（他社トークンや空で送らない）", () => {
    const d = decideLine(row({ secretEnc: "broken" }), () => null);
    assert.strictEqual(d.kind, "blocked");
  });

  test("復号できたトークンで送る", () => {
    const d = decideLine(row({ secretEnc: "enc-token", webhookSecretEnc: "enc-secret", lineBasicId: "@abc" }), (v) =>
      v ? v.replace("enc-", "") : null
    );
    assert.strictEqual(d.kind, "use");
    if (d.kind === "use") {
      assert.strictEqual(d.value.accessToken, "token");
      assert.strictEqual(d.value.channelSecret, "secret");
      assert.strictEqual(d.value.lineBasicId, "@abc");
    }
  });
});

describe("channel-decision: SMS", () => {
  test("設定が無ければ既定", () => {
    assert.strictEqual(decideSms(null, asIs).kind, "default");
  });

  test("無効化・番号なし・トークン復号不可はいずれもブロック", () => {
    assert.strictEqual(decideSms(row({ isActive: false, smsFromNumber: "+815012345678", secretEnc: "t" }), asIs).kind, "blocked");
    assert.strictEqual(decideSms(row({ smsFromNumber: null, secretEnc: "t" }), asIs).kind, "blocked");
    assert.strictEqual(decideSms(row({ smsFromNumber: "+815012345678", secretEnc: "t" }), () => null).kind, "blocked");
  });

  test("揃っていれば送る（fromName 列は Account SID）", () => {
    const d = decideSms(row({ smsFromNumber: "+815012345678", secretEnc: "t", fromName: "ACxxx" }), asIs);
    assert.strictEqual(d.kind, "use");
    if (d.kind === "use") {
      assert.strictEqual(d.value.accountSid, "ACxxx");
      assert.strictEqual(d.value.authToken, "t");
    }
  });
});

describe("channel-decision: 友だち追加URL", () => {
  test("ベーシックIDから作る（@ の有無を吸収）", () => {
    assert.strictEqual(lineInviteUrlFrom("@abc123"), "https://line.me/R/ti/p/@abc123");
    assert.strictEqual(lineInviteUrlFrom("abc123"), "https://line.me/R/ti/p/@abc123");
  });

  test("ベーシックIDが無ければ会社に登録されたURL", () => {
    assert.strictEqual(lineInviteUrlFrom(null, "https://lin.ee/xxxx"), "https://lin.ee/xxxx");
  });

  test("どちらも無ければ空（暫定の共通URLに勝手に落とさない）", () => {
    assert.strictEqual(lineInviteUrlFrom(null, null), "");
  });
});
