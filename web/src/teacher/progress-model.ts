// 子どもの進み（SCR-T10 の「子どもの進み」と SCR-T04）の形と見本のデータ。
// 形は docs/product/education-api-contract.md「子どもの進みの API（仮・案）」に合わせる。API の了承と #74 の確認までは、
// サーバーから読まずに、ここの見本のデータ（架空の30人）で動かす（teacher の D-T09、UI の R-50）。
// 数えるのは本線のマス（Chapter.items）だけ。寄り道と章のテストは数えない（UI の Q-48 は A に決めた）。
import { SUBJECTS } from "../data/constants";
import { chaptersOf, shownSubjectsOf } from "../data/courses";
import type { Chapter, SubjectId } from "../data/types";
import { plainText } from "../ruby-text";
import { CLASS_COPY } from "./copy";

export type ClassProgress = {
  now: string;
  subjectId: SubjectId;
  chapters: { chapterId: string; total: number }[];
  students: { number: string; lastStudiedOn: string | null; done: Record<string, number> }[];
};

export type ChildProgress = {
  number: string;
  lastStudiedOn: string | null;
  chapters: { chapterId: string; total: number; doneSquares: number[] }[];
};

/** 学級の学年。子どもの画面は本番で 6 年に固定されているので、先生の表も 6 年に合わせる（#232）。見本の学級の人数は 30 */
export const SAMPLE_GRADE = 6;
export const SAMPLE_SIZE = 30;

/** 学級の章（6年の、選んだ教科の章。並びのまま。初めは算数）。子どもの画面と同じ章の id を使う */
export const sampleChapters = (subjectId: SubjectId = "sansu"): readonly Chapter[] => chaptersOf(SAMPLE_GRADE, subjectId);

/** 教科の欄の選択肢。学級の学年で章のある、画面に出す教科（算数・理科。並びは SUBJECTS の順。D-218）。subjectsOfGrade だけだと章が仮の教科まで入る */
export const classSubjects = (): SubjectId[] => shownSubjectsOf(SAMPLE_GRADE).filter((id) => chaptersOf(SAMPLE_GRADE, id).length > 0);

/** 教科の名前（ふりがなを外した文字）。教材データの SUBJECTS の名前を使う */
export const subjectName = (subjectId: SubjectId): string => plainText(SUBJECTS.find((subject) => subject.id === subjectId)?.name ?? "");

/** URL の subject の値を教科にする。選択肢に無い値・無い場合は算数 */
export const parseSubject = (value: string | null): SubjectId => classSubjects().find((id) => id === value) ?? "sansu";

/** URL の subject の値。算数は省く */
export const subjectQuery = (subjectId: SubjectId): string => (subjectId === "sansu" ? "" : `subject=${subjectId}`);

const numberOf = (index: number) => `A-${String(index + 1).padStart(2, "0")}`;

/** 日付（YYYY-MM-DD）を days 日もどす */
function daysBefore(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, (day ?? 1) - days));
  return value.toISOString().slice(0, 10);
}

/**
 * 見本の学級の進み。番号ごとに決まった値（開くたびに変わらない）。
 * 前の章から順に進み、途中の章が1つある。A-05 と A-23 は一度も学んでいない（CP-1102 の見本）
 */
export function sampleClassProgress(today: string, subjectId: SubjectId = "sansu"): ClassProgress {
  const chapters = sampleChapters(subjectId).map((chapter) => ({ chapterId: chapter.id, total: chapter.items.length }));
  const students = Array.from({ length: SAMPLE_SIZE }, (_, index) => {
    const number = numberOf(index);
    if (index === 4 || index === 22) return { number, lastStudiedOn: null, done: {} };
    // 終えた本線のマスの合計を、番号から決める（多い子・少ない子が混ざるように）
    const seed = (index * 37 + 11) % 29;
    let left = 4 + seed;
    const done: Record<string, number> = {};
    for (const chapter of chapters) {
      if (left <= 0) break;
      const value = Math.min(chapter.total, left);
      done[chapter.chapterId] = value;
      left -= value;
    }
    return { number, lastStudiedOn: daysBefore(today, index % 6), done };
  });
  return { now: `${today}T09:00:00+09:00`, subjectId, chapters, students };
}

/** 保存した進み（API の students）を、表と子どもの画面の形にする。章は選んだ教科の章だけ（web の教材の順）。今の仮の API は教科で分けず全部の章の done を返すので、ここで絞る */
export function classProgressFrom(now: string, students: { number: string; lastStudiedOn: string | null; done: Record<string, number> }[], subjectId: SubjectId = "sansu"): ClassProgress {
  const chapters = sampleChapters(subjectId).map((chapter) => ({ chapterId: chapter.id, total: chapter.items.length }));
  return { now, subjectId, chapters, students };
}

/** 学級の進みから、一人の進みを取り出す。番号がいなければ undefined */
export function childProgressOf(progress: ClassProgress, number: string): ChildProgress | undefined {
  const student = progress.students.find((item) => item.number === number);
  if (!student) return undefined;
  return {
    number,
    lastStudiedOn: student.lastStudiedOn,
    chapters: progress.chapters.map(({ chapterId, total }) => ({
      chapterId,
      total,
      doneSquares: Array.from({ length: student.done[chapterId] ?? 0 }, (_, square) => square),
    })),
  };
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 日付（YYYY-MM-DD）を CP-1112 の形「11/6（金）」にする。null は CP-1102「まだ」 */
export function formatStudiedOn(date: string | null): string {
  if (!date) return CLASS_COPY.notYet;
  const [year, month, day] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1)).getUTCDay()] ?? "";
  return CLASS_COPY.date(month ?? 0, day ?? 0, weekday);
}

/** 日本時間の今日（YYYY-MM-DD） */
export function todayInJapan(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
