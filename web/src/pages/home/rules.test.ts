import { describe, expect, it } from "vitest";
import { assignmentList, dueByToday, dueLabel, focusDay, isLate, isOverdue, jstDateKey, jstWeekday, periodCount } from "./rules";
import type { Assignment, TimetableDay } from "./types";

const a = (id: string, dueAt: string, submittedAt: string | null = null): Assignment => ({ id, subjectId: "kokugo", title: id, dueAt, submittedAt });
// 2026-11-09（月）10:00 日本時間
const NOW = "2026-11-09T10:00:00+09:00";
const LIST = [
  a("tomorrow", "2026-11-10T08:30:00+09:00"),
  a("today-pm", "2026-11-09T15:00:00+09:00"),
  a("yesterday", "2026-11-08T08:30:00+09:00"),
  a("today-am", "2026-11-09T08:30:00+09:00"),
  a("later", "2026-11-14T08:30:00+09:00"),
];

describe("日本時間の日付と曜日", () => {
  it("UTC で前の日でも、日本時間の日付で決める", () => {
    expect(jstDateKey("2026-11-09T00:30:00+09:00")).toBe("2026-11-09");
    expect(jstDateKey("2026-11-08T15:30:00Z")).toBe("2026-11-09");
    expect(jstWeekday(NOW)).toBe(1);
    expect(jstWeekday("2026-11-15T23:59:00+09:00")).toBe(7);
  });
});

describe("今日までに出すもの", () => {
  it("期日の日付が今日以前でまだのものを、期日の早い順に出す。時刻を過ぎていなくても今日の分は入る", () => {
    expect(dueByToday(LIST, NOW).map((x) => x.id)).toEqual(["yesterday", "today-am", "today-pm"]);
  });
  it("出したものは入らない", () => {
    const list = LIST.map((x) => (x.id === "today-am" ? { ...x, submittedAt: "2026-11-09T09:00:00+09:00" } : x));
    expect(dueByToday(list, NOW).map((x) => x.id)).toEqual(["yesterday", "today-pm"]);
  });
});

describe("一覧", () => {
  it("まだのもの全部の後に、7日以内に出したものを新しい順に並べる。7日より前に出したものは出さない", () => {
    const list = [
      ...LIST.filter((x) => x.id !== "later"),
      a("done-new", "2026-11-09T08:30:00+09:00", "2026-11-09T09:00:00+09:00"),
      a("done-old", "2026-11-05T08:30:00+09:00", "2026-11-04T09:00:00+09:00"),
      a("done-8days", "2026-10-30T08:30:00+09:00", "2026-11-01T10:00:00+09:00"),
    ];
    expect(assignmentList(list, NOW).map((x) => x.id)).toEqual(["yesterday", "today-am", "today-pm", "tomorrow", "done-new", "done-old"]);
  });
});

describe("期限を過ぎた・おくれて出した", () => {
  it("まだで時刻を過ぎたら期限を過ぎた。出した時刻が期日より後ならおくれて出した", () => {
    expect(isOverdue(a("x", "2026-11-09T08:30:00+09:00"), NOW)).toBe(true);
    expect(isOverdue(a("x", "2026-11-09T15:00:00+09:00"), NOW)).toBe(false);
    expect(isOverdue(a("x", "2026-11-09T08:30:00+09:00", NOW), NOW)).toBe(false);
    expect(isLate(a("x", "2026-11-09T08:30:00+09:00", NOW))).toBe(true);
    expect(isLate(a("x", "2026-11-09T15:00:00+09:00", NOW))).toBe(false);
  });
});

describe("期日の書き方", () => {
  it("今日・明日・それ以外", () => {
    expect(dueLabel("2026-11-09T15:00:00+09:00", NOW)).toEqual({ kind: "today", time: "15:00" });
    expect(dueLabel("2026-11-10T08:30:00+09:00", NOW)).toEqual({ kind: "tomorrow", time: "8:30" });
    expect(dueLabel("2026-11-14T08:30:00+09:00", NOW)).toEqual({ kind: "date", month: 11, day: 14, weekday: 6, time: "8:30" });
  });
});

describe("時間割で示す日", () => {
  const days: TimetableDay[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, periods: [{ period: 1, subjectId: "kokugo" }, ...(weekday === 3 ? [] : [{ period: 6, subjectId: "sansu" as const }])] }));
  it("今日が時間割にあれば今日", () => {
    expect(focusDay(days, "2026-11-11T10:00:00+09:00")).toEqual({ weekday: 3, isToday: true });
  });
  it("土曜・日曜は次の月曜を「つぎの授業」にする", () => {
    expect(focusDay(days, "2026-11-14T10:00:00+09:00")).toEqual({ weekday: 1, isToday: false });
    expect(focusDay(days, "2026-11-15T23:00:00+09:00")).toEqual({ weekday: 1, isToday: false });
  });
  it("表の行の数はいちばん多い日のコマ数", () => {
    expect(periodCount(days)).toBe(6);
    expect(focusDay([], NOW)).toBeUndefined();
  });
});
