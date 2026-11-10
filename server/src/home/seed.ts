// ファーストディスプレイ（#187）の見本。先生が配る形（管理画面、#196）ができるまでの値。
// 正本は docs/design/home/08_database.md。期日は「起動した日の 0:00（日本時間）＋N日＋時刻」（HM-16）
export type TimetableSubjectId =
  | "kokugo" | "sansu" | "rika" | "shakai" | "eigo" | "ongaku" | "taiiku" | "zuko" | "katei" | "seikatsu"
  | "doutoku" | "sougou" | "gakkatsu";

/** 課題とアプリの学習のつながり（#196、Q-29）。null はつながない。子どもの API には返さない */
export type AssignmentLink = { kind: "chapterTest"; chapterId: string } | null;

export const TIMETABLE_SUBJECT_IDS: readonly TimetableSubjectId[] = [
  "kokugo", "sansu", "rika", "shakai", "eigo", "ongaku", "taiiku", "zuko", "katei", "seikatsu", "doutoku", "sougou", "gakkatsu",
];

export type Assignment = { id: string; subjectId: TimetableSubjectId; title: string; dueAt: string; link: AssignmentLink };
export type TimetableDay = { weekday: number; periods: { period: number; subjectId: TimetableSubjectId }[] };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const JST_OFFSET = 9 * HOUR;

/** 日本時間の ISO 8601（+09:00 付き、秒まで） */
export function toJstIso(epochMs: number): string {
  return new Date(epochMs + JST_OFFSET).toISOString().slice(0, 19) + "+09:00";
}

/** その時刻の日本時間の日付の 0:00 を、UTC のミリ秒で */
export function jstDayStart(epochMs: number): number {
  return Math.floor((epochMs + JST_OFFSET) / DAY) * DAY - JST_OFFSET;
}

// 期日の日（起動した日から何日後か）と時刻。HM-14、HM-15
const ASSIGNMENT_SEEDS: { id: string; subjectId: TimetableSubjectId; title: string; days: number; hour: number; minute: number }[] = [
  { id: "hw-kanji-12", subjectId: "kokugo", title: "[漢字|かんじ]ドリル 12ページ", days: -1, hour: 8, minute: 30 },
  { id: "hw-fraction-print", subjectId: "sansu", title: "[分数|ぶんすう]のプリント", days: 0, hour: 8, minute: 30 },
  { id: "hw-lever-print", subjectId: "rika", title: "てこのプリント", days: 0, hour: 15, minute: 0 },
  { id: "hw-history-report", subjectId: "shakai", title: "[歴史|れきし]の[人物|じんぶつ]のしらべ[学習|がくしゅう]", days: 1, hour: 8, minute: 30 },
  { id: "hw-sewing-plan", subjectId: "katei", title: "ナップザックの[計画|けいかく][表|ひょう]", days: 3, hour: 8, minute: 30 },
  { id: "hw-dream-card", subjectId: "eigo", title: "しょうらいの[夢|ゆめ]カード", days: 5, hour: 8, minute: 30 },
];

export function seedAssignments(startedAt: number): Assignment[] {
  const dayStart = jstDayStart(startedAt);
  return ASSIGNMENT_SEEDS.map(({ id, subjectId, title, days, hour, minute }) => ({
    id, subjectId, title, dueAt: toJstIso(dayStart + days * DAY + hour * HOUR + minute * 60_000), link: null,
  }));
}

// 月〜金、水だけ5コマ（週29コマ。HM-17、HM-18）
const WEEK: TimetableSubjectId[][] = [
  ["kokugo", "sansu", "rika", "shakai", "taiiku", "gakkatsu"],
  ["sansu", "kokugo", "eigo", "rika", "zuko", "zuko"],
  ["kokugo", "sansu", "shakai", "ongaku", "doutoku"],
  ["sansu", "kokugo", "rika", "taiiku", "sougou", "sougou"],
  ["kokugo", "sansu", "shakai", "eigo", "katei", "taiiku"],
];

export function seedTimetable(): TimetableDay[] {
  return WEEK.map((subjects, index) => ({
    weekday: index + 1,
    periods: subjects.map((subjectId, period) => ({ period: period + 1, subjectId })),
  }));
}

/** 見本の学級の番号。A-01〜A-30（HM-12）。名前は持たない（teacher の D-T01） */
export const CLASS_NUMBERS: readonly string[] = Array.from({ length: 30 }, (_, index) => `A-${String(index + 1).padStart(2, "0")}`);
