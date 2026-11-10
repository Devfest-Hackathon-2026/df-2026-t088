import { chaptersOf, subjectsOfGrade } from "../data/courses";
import type { Grade } from "../data/kanji-grades";
import type { GameState, SubjectId } from "../data";
import { KOKUGO_COURSE } from "../lesson/kokugo-lessons";
import { hasLessons } from "../lesson/fraction-lessons";
import { subjectLevel } from "./logic";

// CMP-028 くわしくのタブの「教科の すすみ」（D-197）。学習（問題）のある章が1つでもある教科だけ行にする

export interface SubjectProgressRow {
  subjectId: SubjectId;
  /** 章のテストをクリアした章の数 */
  cleared: number;
  /** その学年のその教科の章の数（鍵の章も数える） */
  total: number;
  /** 教科の Lv */
  level: number;
}

export interface SubjectProgress {
  rows: SubjectProgressRow[];
  /** 学習の無い教科の数（CP-1135） */
  pending: number;
}

/** その教科のその章に学習があるか。算数は分数の学習、国語は国語の学習、ほかの教科はまだ無い */
export type ChapterHasLessons = (subjectId: SubjectId, chapterId: string) => boolean;

export const hasLessonsOfSubject: ChapterHasLessons = (subjectId, chapterId) => {
  if (subjectId === "sansu") return hasLessons(chapterId);
  if (subjectId === "kokugo") {
    return KOKUGO_COURSE.hasLesson(chapterId, { kind: "test" }) || KOKUGO_COURSE.hasLesson(chapterId, { kind: "main", index: 0 });
  }
  return false;
};

export function subjectProgressRows(grade: Grade, state: GameState, hasLesson: ChapterHasLessons = hasLessonsOfSubject): SubjectProgress {
  const rows: SubjectProgressRow[] = [];
  let pending = 0;
  for (const subjectId of subjectsOfGrade(grade)) {
    const chapters = chaptersOf(grade, subjectId);
    if (!chapters.some((chapter) => hasLesson(subjectId, chapter.id))) {
      pending += 1;
      continue;
    }
    rows.push({
      subjectId,
      cleared: chapters.filter((chapter) => state.progress[chapter.id]?.test === true).length,
      total: chapters.length,
      // 古い保存には経験値が無い教科がある
      level: subjectLevel(state.xp[subjectId] ?? 0),
    });
  }
  return { rows, pending };
}
