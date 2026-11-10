// 並べ方と判定のルール（docs/design/home/04_functional_spec.md）。「今日」はサーバの now の日本時間の日付で決める
import type { Assignment, TimetableDay } from "./types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const JST_OFFSET = 9 * HOUR;
/** 一覧に残す「出したもの」の日数（HM-19） */
export const RECENT_DAYS = 7;
/** ファーストディスプレイの「出すものと期限」に出す件数（HM-19。D-159 で 2 にし、D-232 で行を低くして 3 に戻した） */
export const FRAME_LIMIT = 3;

const jst = (iso: string) => new Date(Date.parse(iso) + JST_OFFSET);
/** 日本時間の日付（YYYY-MM-DD） */
export const jstDateKey = (iso: string): string => jst(iso).toISOString().slice(0, 10);
/** 日本時間の曜日。月=1 … 日=7 */
export const jstWeekday = (iso: string): number => ((jst(iso).getUTCDay() + 6) % 7) + 1;
/** 日本時間の時刻（8:30 の形） */
export const jstTime = (iso: string): string => {
  const date = jst(iso);
  return `${date.getUTCHours()}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
};

const byDue = (left: Assignment, right: Assignment) => Date.parse(left.dueAt) - Date.parse(right.dueAt);

/** 今日までに出すもの：期日の日付が今日以前で、まだ出していない。期日の早い順 */
export function dueByToday(assignments: readonly Assignment[], now: string): Assignment[] {
  const today = jstDateKey(now);
  return assignments.filter((a) => a.submittedAt === null && jstDateKey(a.dueAt) <= today).sort(byDue);
}

/** まだ出していないもの（期日の早い順） */
export const notSubmitted = (assignments: readonly Assignment[]): Assignment[] => assignments.filter((a) => a.submittedAt === null).sort(byDue);

/** 出したもの（7日以内、出した時刻の新しい順） */
export function recentlySubmitted(assignments: readonly Assignment[], now: string): Assignment[] {
  const nowMs = Date.parse(now);
  return assignments
    .filter((a) => a.submittedAt !== null && nowMs - Date.parse(a.submittedAt) <= RECENT_DAYS * DAY)
    .sort((left, right) => Date.parse(right.submittedAt as string) - Date.parse(left.submittedAt as string));
}

/** 一覧：まだのもの全部、その後に7日以内に出したもの */
export const assignmentList = (assignments: readonly Assignment[], now: string): Assignment[] =>
  [...notSubmitted(assignments), ...recentlySubmitted(assignments, now)];

export const isOverdue = (a: Assignment, now: string): boolean => a.submittedAt === null && Date.parse(a.dueAt) < Date.parse(now);
export const isLate = (a: Assignment): boolean => a.submittedAt !== null && Date.parse(a.submittedAt) > Date.parse(a.dueAt);

export type DueLabel =
  | { kind: "today"; time: string }
  | { kind: "tomorrow"; time: string }
  | { kind: "date"; month: number; day: number; weekday: number; time: string };

/** 期日の書き方。今日・明日・それ以外（日付と曜日） */
export function dueLabel(dueAt: string, now: string): DueLabel {
  const time = jstTime(dueAt);
  const due = jstDateKey(dueAt);
  if (due === jstDateKey(now)) return { kind: "today", time };
  if (due === jstDateKey(new Date(Date.parse(now) + DAY).toISOString())) return { kind: "tomorrow", time };
  const date = jst(dueAt);
  return { kind: "date", month: date.getUTCMonth() + 1, day: date.getUTCDate(), weekday: jstWeekday(dueAt), time };
}

/** 時間割で示す日。今日が時間割にあれば今日、無ければ次に時間割がある曜日（HM-20） */
export function focusDay(days: readonly TimetableDay[], now: string): { weekday: number; isToday: boolean } | undefined {
  if (days.length === 0) return undefined;
  const today = jstWeekday(now);
  for (let offset = 0; offset < 7; offset += 1) {
    const weekday = ((today - 1 + offset) % 7) + 1;
    if (days.some((day) => day.weekday === weekday)) return { weekday, isToday: offset === 0 };
  }
  return undefined;
}

/** 表の行の数（いちばん多い日のコマ数） */
export const periodCount = (days: readonly TimetableDay[]): number => Math.max(0, ...days.flatMap((day) => day.periods.map((p) => p.period)));
