import { test, describe } from "node:test";
import assert from "node:assert";
import { parseHHMM, formatHHMM, buildSlots, overlaps, checkAvailability } from "./schedule-slots";

// implementation-spec-v1.md §2.5 / §6.2: 「連動あり＝即時確定」の判断。
// ここを間違えると、埋まっている枠を確定にしてしまう（顧客が来店したのに席が無い）。

describe("時刻の読み書き", () => {
  test("HH:MM を分に直す", () => {
    assert.strictEqual(parseHHMM("09:30"), 570);
    assert.strictEqual(parseHHMM("9:05"), 545);
    assert.strictEqual(parseHHMM("00:00"), 0);
  });

  test("形式が違えば null（勝手に0時と解釈しない）", () => {
    for (const v of ["", null, undefined, "9時", "24:00", "12:60", "12-30"]) {
      assert.strictEqual(parseHHMM(v as any), null, String(v));
    }
  });

  test("分から HH:MM に戻せる", () => {
    assert.strictEqual(formatHHMM(570), "09:30");
    assert.strictEqual(formatHHMM(0), "00:00");
  });
});

describe("枠の組み立て", () => {
  test("営業時間を枠の長さで割る", () => {
    const slots = buildSlots("10:00", "13:00", 60);
    assert.deepStrictEqual(slots.map((s) => formatHHMM(s.start)), ["10:00", "11:00", "12:00"]);
  });

  test("終了時刻をまたぐ枠は作らない", () => {
    const slots = buildSlots("10:00", "11:30", 60);
    assert.deepStrictEqual(slots.map((s) => formatHHMM(s.start)), ["10:00"]);
  });

  test("開始と終了が逆・不正なら空", () => {
    assert.deepStrictEqual(buildSlots("18:00", "10:00", 60), []);
    assert.deepStrictEqual(buildSlots("bad", "10:00", 60), []);
    assert.deepStrictEqual(buildSlots("10:00", "18:00", 0), []);
  });

  test("接している区間は重ならない扱い", () => {
    assert.strictEqual(overlaps({ start: 600, end: 660 }, { start: 660, end: 720 }), false);
    assert.strictEqual(overlaps({ start: 600, end: 660 }, { start: 630, end: 690 }), true);
  });
});

describe("空き判定", () => {
  const base = { hoursStart: "10:00", hoursEnd: "18:00", slotMinutes: 60, busy: [], isOpen: true };

  test("営業時間内の空いている枠は受け付ける", () => {
    const r = checkAvailability({ ...base, visitTime: "14:00" });
    assert.strictEqual(r.kind, "ok");
  });

  test("定休日は候補も出さずに断る", () => {
    const r = checkAvailability({ ...base, visitTime: "14:00", isOpen: false });
    assert.strictEqual(r.kind, "ng");
    if (r.kind === "ng") assert.deepStrictEqual(r.alternatives, []);
  });

  test("枠の途中の時刻は受け付けない（半端な予約を作らない）", () => {
    const r = checkAvailability({ ...base, visitTime: "14:30" });
    assert.strictEqual(r.kind, "ng");
  });

  test("営業時間外は受け付けない", () => {
    assert.strictEqual(checkAvailability({ ...base, visitTime: "09:00" }).kind, "ng");
    assert.strictEqual(checkAvailability({ ...base, visitTime: "18:00" }).kind, "ng");
  });

  test("埋まっている枠は断り、同じ日の空きを候補に返す", () => {
    const r = checkAvailability({ ...base, visitTime: "14:00", busy: [{ start: 840, end: 900 }] });
    assert.strictEqual(r.kind, "ng");
    if (r.kind === "ng") {
      assert.ok(!r.alternatives.includes("14:00"));
      assert.ok(r.alternatives.includes("15:00"));
    }
  });

  test("一部だけ重なる予定でも埋まっている扱いにする", () => {
    // 14:30-15:30 の予定は 14:00 枠にも 15:00 枠にもかかる
    const r = checkAvailability({ ...base, visitTime: "14:00", busy: [{ start: 870, end: 930 }] });
    assert.strictEqual(r.kind, "ng");
    if (r.kind === "ng") assert.ok(!r.alternatives.includes("15:00"));
  });

  test("同時に2組受けられる店舗は1件埋まっていても受け付ける", () => {
    const r = checkAvailability({ ...base, visitTime: "14:00", busy: [{ start: 840, end: 900 }], capacity: 2 });
    assert.strictEqual(r.kind, "ok");
  });

  test("時刻の形式が違えば受け付けない", () => {
    assert.strictEqual(checkAvailability({ ...base, visitTime: "14時" }).kind, "ng");
  });
});
