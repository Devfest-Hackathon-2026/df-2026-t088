// 先生の入力（課題・時間割）の検査（#196）。決まりの正本は docs/product/education-api-contract.md「先生の管理の API」の「受ける値」
import { LINK_CHAPTERS, type LinkChapter } from "./chapters.ts";
import { TIMETABLE_SUBJECT_IDS, type AssignmentLink, type TimetableDay, type TimetableSubjectId } from "./seed.ts";
import type { AssignmentInput } from "./store.ts";

export type InputDetail = { field: string; reason: string };
export type Checked<T> = { ok: true; value: T } | { ok: false; details: InputDetail[] };

const TITLE_MAX = 20;
const MAX_DAYS = 7;
const MAX_PERIODS = 8;
// ふりがなの書き方 [語|よみ] は、表示では「語」だけを数える
const RUBY = /\[([^|\]]+)\|[^\]]+\]/g;
// +09:00 の日時。分まで（秒は 00 だけ受け、保存は分まで）
const DUE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::00)?\+09:00$/;
const CHAPTER_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** 表示される字数（ふりがなを除く）。サロゲートペアを1字と数える */
export function visibleLength(title: string): number {
  return [...title.replace(RUBY, "$1")].length;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSubjectId(value: unknown): value is TimetableSubjectId {
  return typeof value === "string" && (TIMETABLE_SUBJECT_IDS as readonly string[]).includes(value);
}

function checkLink(value: unknown, details: InputDetail[], chapters: readonly LinkChapter[]): AssignmentLink {
  if (value === null) return null;
  if (!isObject(value)) {
    details.push({ field: "link", reason: "format" });
    return null;
  }
  if (value.kind !== "chapterTest") {
    // マス単位は、Q-29 の覆す条件に当たったときに足す（今は受けない）
    details.push({ field: "link", reason: "unsupported" });
    return null;
  }
  if (typeof value.chapterId !== "string" || !CHAPTER_ID.test(value.chapterId)) {
    details.push({ field: "link.chapterId", reason: "format" });
    return null;
  }
  // 形が合っても、選べる章の一覧（link-options）に無い id は弾く
  if (!chapters.some((chapter) => chapter.chapterId === value.chapterId)) {
    details.push({ field: "link.chapterId", reason: "unknown" });
    return null;
  }
  return { kind: "chapterTest", chapterId: value.chapterId };
}

export function checkAssignment(body: unknown, chapters: readonly LinkChapter[] = LINK_CHAPTERS): Checked<AssignmentInput> {
  if (!isObject(body)) return { ok: false, details: [{ field: "body", reason: "format" }] };
  const details: InputDetail[] = [];

  if (!isSubjectId(body.subjectId)) details.push({ field: "subjectId", reason: "unknown" });

  let title = "";
  if (typeof body.title !== "string" || body.title.trim() === "") details.push({ field: "title", reason: "required" });
  else {
    title = body.title.trim();
    if (visibleLength(title) > TITLE_MAX) details.push({ field: "title", reason: "too_long" });
  }

  let dueAt = "";
  const match = typeof body.dueAt === "string" ? DUE.exec(body.dueAt) : null;
  if (!match || Number.isNaN(Date.parse(`${match[1]}:00+09:00`))) details.push({ field: "dueAt", reason: "format" });
  else dueAt = `${match[1]}:00+09:00`;

  const link = checkLink(body.link, details, chapters);

  if (details.length > 0 || !isSubjectId(body.subjectId)) return { ok: false, details };
  return { ok: true, value: { subjectId: body.subjectId, title, dueAt, link } };
}

export function checkTimetable(body: unknown): Checked<TimetableDay[]> {
  if (!isObject(body) || !Array.isArray(body.days)) return { ok: false, details: [{ field: "days", reason: "format" }] };
  const details: InputDetail[] = [];
  if (body.days.length > MAX_DAYS) details.push({ field: "days", reason: "too_many" });

  const weekdays = new Set<number>();
  const days: TimetableDay[] = [];
  body.days.forEach((raw, dayIndex) => {
    const where = `days[${dayIndex}]`;
    if (!isObject(raw) || !Number.isInteger(raw.weekday) || (raw.weekday as number) < 1 || (raw.weekday as number) > MAX_DAYS) {
      details.push({ field: `${where}.weekday`, reason: "range" });
      return;
    }
    const weekday = raw.weekday as number;
    if (weekdays.has(weekday)) details.push({ field: `${where}.weekday`, reason: "duplicate" });
    weekdays.add(weekday);

    if (!Array.isArray(raw.periods) || raw.periods.length < 1) {
      details.push({ field: `${where}.periods`, reason: "required" });
      return;
    }
    if (raw.periods.length > MAX_PERIODS) details.push({ field: `${where}.periods`, reason: "too_many" });
    const periods = raw.periods.map((item, periodIndex) => {
      const at = `${where}.periods[${periodIndex}]`;
      if (!isObject(item)) {
        details.push({ field: at, reason: "format" });
        return { period: periodIndex + 1, subjectId: "kokugo" as TimetableSubjectId };
      }
      // コマ番号は 1 から連続（抜けを作らない）
      if (item.period !== periodIndex + 1) details.push({ field: `${at}.period`, reason: "sequence" });
      if (!isSubjectId(item.subjectId)) details.push({ field: `${at}.subjectId`, reason: "unknown" });
      return { period: periodIndex + 1, subjectId: isSubjectId(item.subjectId) ? item.subjectId : ("kokugo" as TimetableSubjectId) };
    });
    days.push({ weekday, periods });
  });

  if (details.length > 0) return { ok: false, details };
  return { ok: true, value: days.sort((left, right) => left.weekday - right.weekday) };
}
