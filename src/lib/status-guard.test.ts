import { test, describe } from "node:test";
import assert from "node:assert";
import { hasNoNewStatus, deleteWouldRemoveLastNew, categoryChangeWouldRemoveLastNew } from "./status-guard";

// implementation-spec-v1.md §4 F-3。会社から「新規」カテゴリが消えると、
// その会社の新規反響が受信トレイの未対応にも横断集計にも出なくなる。

const statuses = [
  { id: "s1", systemCategory: "NEW", isDefault: true },
  { id: "s2", systemCategory: "IN_PROGRESS" },
  { id: "s3", systemCategory: null },
];

describe("NEW ステータスの保護", () => {
  test("NEW があるかを判定できる", () => {
    assert.strictEqual(hasNoNewStatus(statuses), false);
    assert.strictEqual(hasNoNewStatus([{ id: "a", systemCategory: "DONE" }]), true);
    assert.strictEqual(hasNoNewStatus([]), true);
  });

  test("最後の NEW の削除は止める", () => {
    assert.strictEqual(deleteWouldRemoveLastNew(statuses, "s1"), true);
  });

  test("NEW が2つあるうちの1つは消せる", () => {
    const two = [...statuses, { id: "s4", systemCategory: "NEW" }];
    assert.strictEqual(deleteWouldRemoveLastNew(two, "s1"), false);
  });

  test("NEW 以外の削除は止めない", () => {
    assert.strictEqual(deleteWouldRemoveLastNew(statuses, "s2"), false);
    assert.strictEqual(deleteWouldRemoveLastNew(statuses, "s3"), false);
  });

  test("存在しない ID では止めない", () => {
    assert.strictEqual(deleteWouldRemoveLastNew(statuses, "none"), false);
  });

  test("最後の NEW を別カテゴリに変える操作は止める", () => {
    assert.strictEqual(categoryChangeWouldRemoveLastNew(statuses, "s1", "DONE"), true);
    assert.strictEqual(categoryChangeWouldRemoveLastNew(statuses, "s1", null), true);
  });

  test("NEW のまま・他のステータスの変更・変更なしは止めない", () => {
    assert.strictEqual(categoryChangeWouldRemoveLastNew(statuses, "s1", "NEW"), false);
    assert.strictEqual(categoryChangeWouldRemoveLastNew(statuses, "s2", "DONE"), false);
    assert.strictEqual(categoryChangeWouldRemoveLastNew(statuses, "s1", undefined), false);
  });

  test("他に NEW があれば変更してよい", () => {
    const two = [...statuses, { id: "s4", systemCategory: "NEW" }];
    assert.strictEqual(categoryChangeWouldRemoveLastNew(two, "s1", "DONE"), false);
  });
});
