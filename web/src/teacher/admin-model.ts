// 課題・時間割の管理の、画面に依らない決まり（SCR-T06〜T08、#196）。入力の検査は見せる前の確かめで、正しさはサーバーが最後に決める
import { COPY } from "../copy";
import { SUBJECTS } from "../data";
import { displayText } from "../ruby-text";
import { ASSIGNMENT_FORM_COPY, TIMETABLE_COPY } from "./copy";
import type { AdminAssignment, AssignmentInput, TimetableDay } from "./api";

export const TITLE_MAX = 20;
export const MAX_DAYS = 7;
export const MAX_PERIODS = 8;

// 表示の名前。大人の画面はふりがなを付けないので、漢字のまま出す（displayText は grade が null なら漢字）
export function subjectLabel(id: string): string {
  const found = SUBJECTS.find((subject) => subject.id === id);
  const extra = (COPY.CP_745 as Record<string, string>)[id];
  return displayText(found?.name ?? extra ?? id, null);
}

// ふりがなの書き方 [語|よみ] を除いた字数（サーバーの visibleLength と同じ決まり）
export function visibleLength(title: string): number {
  return [...title.replace(/\[([^|\]]+)\|[^\]]+\]/g, "$1")].length;
}

/** 画面の入力。日付は YYYY-MM-DD、時と分は文字（空は未選択） */
export type AssignmentForm = {
  subjectId: string;
  title: string;
  date: string;
  hour: string;
  minute: string;
  linkKind: "none" | "chapterTest";
  chapterId: string;
};

export type AssignmentField = "subject" | "title" | "date" | "time" | "chapter";

export const EMPTY_ASSIGNMENT_FORM: AssignmentForm = {
  subjectId: "",
  title: "",
  date: "",
  hour: "",
  minute: "",
  linkKind: "none",
  chapterId: "",
};

// 押せない理由。項目ごとに 1 つだけ返す（入力欄の下に書く）
export function assignmentProblems(form: AssignmentForm): Partial<Record<AssignmentField, string>> {
  const problems: Partial<Record<AssignmentField, string>> = {};
  if (!form.subjectId) problems.subject = ASSIGNMENT_FORM_COPY.needSubject;
  const length = visibleLength(form.title.trim());
  if (length === 0) problems.title = ASSIGNMENT_FORM_COPY.needName;
  else if (length > TITLE_MAX) problems.title = ASSIGNMENT_FORM_COPY.nameTooLong;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) problems.date = ASSIGNMENT_FORM_COPY.needDate;
  if (form.hour === "" || form.minute === "") problems.time = ASSIGNMENT_FORM_COPY.needTime;
  if (form.linkKind === "chapterTest" && !form.chapterId) problems.chapter = ASSIGNMENT_FORM_COPY.needChapter;
  return problems;
}

/** 入力から、送る値（+09:00、分まで）を作る。押せない理由が無いときだけ使う */
export function toAssignmentInput(form: AssignmentForm): AssignmentInput {
  return {
    subjectId: form.subjectId,
    title: form.title.trim(),
    dueAt: `${form.date}T${form.hour.padStart(2, "0")}:${form.minute.padStart(2, "0")}+09:00`,
    link: form.linkKind === "chapterTest" ? { kind: "chapterTest", chapterId: form.chapterId } : null,
  };
}

/** 直すときに、今の値を入れる */
export function fromAssignment(assignment: AdminAssignment): AssignmentForm {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(assignment.dueAt);
  return {
    subjectId: assignment.subjectId,
    title: assignment.title,
    date: match?.[1] ?? "",
    hour: match?.[2] ?? "",
    minute: match?.[3] ?? "",
    linkKind: assignment.link ? "chapterTest" : "none",
    chapterId: assignment.link?.chapterId ?? "",
  };
}

/** 期限の早い順。同じ期限は、id の順（画面を開くたびに順が変わらないように） */
export function sortByDue(assignments: AdminAssignment[]): AdminAssignment[] {
  return [...assignments].sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id));
}

export const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
export const MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));


// ---- 時間割 ----

export const WEEKDAY_NAMES = TIMETABLE_COPY.weekdayNames.split("、");

/** 画面の時間割。曜日は 1 から連続（列の順）。コマも 1 から連続 */
export function normalizeDays(days: TimetableDay[]): TimetableDay[] {
  return [...days]
    .sort((a, b) => a.weekday - b.weekday)
    .map((day, index) => ({
      weekday: index + 1,
      periods: day.periods.map((period, periodIndex) => ({ period: periodIndex + 1, subjectId: period.subjectId })),
    }));
}

/** 曜日を増やす。新しい列は、いまの最後の列のコマを写す（空から作らない） */
export function addDay(days: TimetableDay[]): { days: TimetableDay[]; problem?: string } {
  if (days.length >= MAX_DAYS) return { days, problem: TIMETABLE_COPY.maxDays };
  const last = days[days.length - 1];
  const periods = last ? last.periods.map((period) => ({ ...period })) : [{ period: 1, subjectId: "kokugo" }];
  return { days: [...days, { weekday: days.length + 1, periods }] };
}

/** 曜日を減らす。いちばん後ろの列を外す */
export function removeDay(days: TimetableDay[]): { days: TimetableDay[]; problem?: string } {
  if (days.length <= 1) return { days, problem: TIMETABLE_COPY.minDays };
  return { days: days.slice(0, -1) };
}

/** その曜日のコマを増やす。新しいコマは、直前のコマの教科を写す */
export function addPeriod(days: TimetableDay[], dayIndex: number): { days: TimetableDay[]; problem?: string } {
  const day = days[dayIndex];
  if (!day) return { days };
  if (day.periods.length >= MAX_PERIODS) return { days, problem: TIMETABLE_COPY.maxPeriods };
  const last = day.periods[day.periods.length - 1];
  const next = days.map((item, index) =>
    index === dayIndex
      ? { ...item, periods: [...item.periods, { period: item.periods.length + 1, subjectId: last?.subjectId ?? "kokugo" }] }
      : item,
  );
  return { days: next };
}

/** その曜日のコマを減らす。いちばん後ろのコマを外す */
export function removePeriod(days: TimetableDay[], dayIndex: number): { days: TimetableDay[]; problem?: string } {
  const day = days[dayIndex];
  if (!day) return { days };
  if (day.periods.length <= 1) return { days, problem: TIMETABLE_COPY.minPeriods };
  return {
    days: days.map((item, index) => (index === dayIndex ? { ...item, periods: item.periods.slice(0, -1) } : item)),
  };
}

export function setSubject(days: TimetableDay[], dayIndex: number, periodIndex: number, subjectId: string): TimetableDay[] {
  return days.map((day, dIndex) =>
    dIndex === dayIndex
      ? { ...day, periods: day.periods.map((period, pIndex) => (pIndex === periodIndex ? { ...period, subjectId } : period)) }
      : day,
  );
}

/** 表の行数（いちばん長い曜日のコマ数） */
export function rowCount(days: TimetableDay[]): number {
  return days.reduce((max, day) => Math.max(max, day.periods.length), 0);
}
