import { test, describe } from "node:test";
import assert from "node:assert";
import { parsePortalInquiry, parseRentYen } from "./portal-inquiry";

// implementation-spec-v1.md §4 F-5。
// 本文は 2026-09-15 にカナリーで確認した実際の反響メール（個人情報はマスク）。
// 「動くはず」で書いた正規表現が実データに当たらない、を繰り返さないための固定。

const APAMAN = [
  "********************************************************************",
  "■アパマンショップホームページ",
  "お客様より物件のお問い合わせです。至急ご対応をお願いします。",
  "********************************************************************",
  "現時点で、この予約申込は確定しておりません。",
  "お客様へのご連絡をもって確定となりますので、至急ご対応をお願いします。",
  "【名前】テスト 太郎",
  "【メールアドレス】 test@example.com",
  "【電話番号】 07095012345",
  "【お問い合わせ内容】",
  "内見を希望します。今週末は空いていますか。",
  "〔物 件 名〕ハタノコーポ横川",
].join("\n");

const HOMES_PHONE = [
  "アパマンショップ八王子駅前店株式会社エスエストラスト様",
  "◆◇━━━━━━━━━━━━━━━━━━━━━━",
  "お客様より下記物件へ電話問合せがありました。",
  "通話不成立のため、かけ直し用電話番号の発行をいたします。",
  "ご確認の上、ご連絡をお願いいたします。",
  "2026/09/1519:24:33",
  "━━━━━━━━━━━━━━━━━━━━━━◇◆",
  "■物件情報",
  "下記URLをクリックすると問合せ物件の詳細を見ることができます。",
  "https://www.homes.co.jp/chintai/b-00000000/",
  "物件種別:賃貸マンション",
  "賃料:3万円",
  "所在地:東京都八王子市八木町",
  "交通:JR中央本線 八王子駅 徒歩10分",
  "問合せ番号:12345678",
].join("\n");

const CANARY = [
  "株式会社エスエストラスト アパマンショップ八王子駅前店 様",
  "━━━━━━━━━━━━━━━━━━━━━━━━",
  "お問合せ物件情報",
  "━━━━━━━━━━━━━━━━━━━━━━━━",
  "",
  "物件名:ウィルモア・ラフォーレ",
  "部屋番号:101",
  "階層:1階/2階建",
  "所在地:東京都八王子市横川町460-10",
  "賃料:93000円",
  "間取り:2LDK(55.43m²)",
  "自社管理番号:20260913004432",
  "路線:中央本線",
  "駅:八王子駅",
  "物件URL:https://example.com/p/1",
  "Canary問合せID:abc123",
].join("\n");

describe("賃料を円に直す", () => {
  test("「3万円」を 30000 にする（3円にしない）", () => {
    assert.strictEqual(parseRentYen("3万円"), 30000);
  });
  test("小数の万表記", () => {
    assert.strictEqual(parseRentYen("9.3万円"), 93000);
    assert.strictEqual(parseRentYen("8.55万円"), 85500);
  });
  test("円表記・カンマ入り", () => {
    assert.strictEqual(parseRentYen("93000円"), 93000);
    assert.strictEqual(parseRentYen("93,000円"), 93000);
  });
  test("読めないものは undefined", () => {
    assert.strictEqual(parseRentYen(""), undefined);
    assert.strictEqual(parseRentYen(null), undefined);
    assert.strictEqual(parseRentYen("応相談"), undefined);
  });
});

describe("アパマンショップの反響（実データ）", () => {
  const r = parsePortalInquiry("お問い合わせがありました", APAMAN)!;
  test("ポータルを判別する", () => assert.strictEqual(r.source, "アパマンショップ"));
  test("氏名・メール・電話を拾う（【名前】形式）", () => {
    assert.strictEqual(r.name, "テスト 太郎");
    assert.strictEqual(r.email, "test@example.com");
    assert.strictEqual(r.phone, "07095012345");
  });
  test("物件名を拾う（〔物 件 名〕の空白込み）", () => {
    assert.strictEqual(r.propertyName, "ハタノコーポ横川");
  });
  test("問い合わせ内容を拾う", () => {
    assert.ok(r.inquiryContent.includes("内見を希望"), r.inquiryContent);
  });
});

describe("HOME'S の電話問合せ通知（実データ）", () => {
  const r = parsePortalInquiry("", HOMES_PHONE);
  test("氏名もメールも無いが、捨てずに取り込む", () => {
    assert.ok(r, "null になってしまうと反響が丸ごと消える");
  });
  test("ポータルを判別する", () => assert.strictEqual(r!.source, "HOME'S"));
  test("賃料「3万円」を 30000円 として読む", () => {
    assert.strictEqual(r!.propertyRent, "3万円");
    assert.strictEqual(r!.rentYen, 30000);
  });
  test("所在地・交通・問合せ番号を拾う", () => {
    assert.strictEqual(r!.propertyAddress, "東京都八王子市八木町");
    assert.ok(r!.propertyStation!.includes("八王子駅"));
    assert.strictEqual(r!.propertyCode, "12345678");
  });
});

describe("カナリーの反響（実データ）", () => {
  const r = parsePortalInquiry("", CANARY)!;
  test("ポータルを判別する", () => assert.strictEqual(r.source, "カナリー"));
  test("物件の各項目を拾う", () => {
    assert.strictEqual(r.propertyName, "ウィルモア・ラフォーレ");
    assert.strictEqual(r.propertyRoomNo, "101");
    assert.strictEqual(r.propertyAddress, "東京都八王子市横川町460-10");
    assert.strictEqual(r.rentYen, 93000);
    assert.strictEqual(r.propertyCode, "20260913004432");
  });
  test("間取りと面積を分ける（2LDK(55.43m²)）", () => {
    assert.strictEqual(r.propertyLayout, "2LDK");
    assert.strictEqual(r.propertyArea, "55.43m²");
  });
});

describe("誤検出しない", () => {
  test("ポータルと無関係なメールは null", () => {
    assert.strictEqual(parsePortalInquiry("お世話になります", "先日はありがとうございました。"), null);
  });
  test("ポータル名が出てくるだけで中身が無いものは null", () => {
    assert.strictEqual(parsePortalInquiry("SUUMOについて", "SUUMOって使ってますか？"), null);
  });
});
