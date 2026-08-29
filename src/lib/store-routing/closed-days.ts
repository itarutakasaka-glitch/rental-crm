// 店舗の営業日判定(汎用・DB駆動)。
// 元ネタ: inquiry-agent拡張(旧flat-agency-router) の router.js isOpen()/全店休()。
// 曜日+第◯週+祝日+臨時休業(DATE_RANGE)の複合ルールを StoreClosedDayRule から評価する。
import { prisma } from "@/lib/db/prisma";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function parseDateUTC(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, dow };
}

function nthWeekday(day: number): number {
  return Math.ceil(day / 7);
}

type ClosedDayRule = {
  type: string;
  weekday: number | null;
  nth: number | null;
  includeHolidays: boolean;
  startDate: Date | null;
  endDate: Date | null;
};

// 祝日判定は未実装(元のrouter.jsも空リストで開始)。必要になったら祝日APIやテーブルを追加する。
function isHoliday(_dateStr: string): boolean {
  return false;
}

export function evaluateIsOpen(rules: ClosedDayRule[], dateStr: string): boolean {
  const { d, dow } = parseDateUTC(dateStr);

  for (const r of rules) {
    if (r.type === "DATE_RANGE" && r.startDate && r.endDate) {
      const start = r.startDate.toISOString().slice(0, 10);
      const end = r.endDate.toISOString().slice(0, 10);
      if (dateStr >= start && dateStr <= end) return false;
    }
    if (r.type === "WEEKLY" && r.weekday === dow) return false;
    if (r.type === "NTH_WEEKDAY" && r.weekday === dow && r.nth === nthWeekday(d)) return false;
    if (r.includeHolidays && isHoliday(dateStr)) return false;
  }
  return true;
}

export async function isStoreOpen(storeId: string, dateStr: string): Promise<boolean> {
  const rules = await prisma.storeClosedDayRule.findMany({ where: { storeId } });
  return evaluateIsOpen(rules, dateStr);
}

// 複数店舗が「その日全て休み」かどうか(元の全店休()に相当)。
export async function areAllStoresClosed(storeIds: string[], dateStr: string): Promise<boolean> {
  if (storeIds.length === 0) return true;
  const results = await Promise.all(storeIds.map((id) => isStoreOpen(id, dateStr)));
  return results.every((open) => !open);
}

export { WEEKDAYS, parseDateUTC, nthWeekday };
