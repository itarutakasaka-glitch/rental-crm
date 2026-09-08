// implementation-spec-v1.md §6.2 (M-10) の「空き照会」のうち、外部サービスに触らない部分。
// 営業時間・1枠の長さ・既に埋まっている枠から、その時刻が受け付けられるかを判断する。
// DB に触らないので、そのままテストできる。

export type Slot = { start: number; end: number }; // その日の 0:00 からの分

/** "09:30" → 570。形式が違えば null。 */
export function parseHHMM(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

export function formatHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 営業時間を1枠ずつに割る。終了時刻をまたぐ枠は作らない。 */
export function buildSlots(hoursStart: string, hoursEnd: string, slotMinutes: number): Slot[] {
  const s = parseHHMM(hoursStart), e = parseHHMM(hoursEnd);
  if (s === null || e === null || slotMinutes <= 0 || e <= s) return [];
  const out: Slot[] = [];
  for (let t = s; t + slotMinutes <= e; t += slotMinutes) out.push({ start: t, end: t + slotMinutes });
  return out;
}

/** 2つの区間が重なるか（終端どうしの接触は重ならない扱い） */
export function overlaps(a: Slot, b: Slot): boolean {
  return a.start < b.end && b.start < a.end;
}

export type AvailabilityInput = {
  /** 希望時刻 "14:00" */
  visitTime: string;
  hoursStart: string;
  hoursEnd: string;
  slotMinutes: number;
  /** その日の既存予定（分単位） */
  busy: Slot[];
  /** 定休日なら false */
  isOpen: boolean;
  /** 同時に受けられる件数（1店舗で並行対応できる組数） */
  capacity?: number;
};

// 判別子は文字列にする。tsconfig の strict が false のため、boolean リテラルでは絞り込めない。
export type AvailabilityResult =
  | { kind: "ok"; slot: Slot }
  | { kind: "ng"; reason: string; alternatives: string[] };

/**
 * 希望時刻が受け付けられるかを判断し、駄目なら同じ日の空き枠を候補として返す。
 * 「営業時間内の枠に一致していること」まで見る（半端な時刻の予約を作らない）。
 */
export function checkAvailability(input: AvailabilityInput): AvailabilityResult {
  const { visitTime, hoursStart, hoursEnd, slotMinutes, busy, isOpen } = input;
  const capacity = Math.max(1, input.capacity ?? 1);
  const slots = buildSlots(hoursStart, hoursEnd, slotMinutes);

  const free = slots.filter((s) => busy.filter((b) => overlaps(s, b)).length < capacity);
  const alternatives = isOpen ? free.map((s) => formatHHMM(s.start)) : [];

  if (!isOpen) return { kind: "ng", reason: "その日は定休日です", alternatives: [] };

  const want = parseHHMM(visitTime);
  if (want === null) return { kind: "ng", reason: "時刻の形式が正しくありません", alternatives };

  const slot = slots.find((s) => s.start === want);
  if (!slot) return { kind: "ng", reason: "受付できる時間帯ではありません", alternatives };

  const conflicts = busy.filter((b) => overlaps(slot, b)).length;
  if (conflicts >= capacity) return { kind: "ng", reason: "その時間は埋まっています", alternatives };

  return { kind: "ok", slot };
}
