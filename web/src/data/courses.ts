// 学年と教科から、教科の表・章を選び出す（FR-001、FR-003、TBL-001）。
// ./index を経由せず、元のファイルから読む（index は courses を export するので、循環になる）
import { CHAPTERS } from "./chapters";
import { SUBJECTS } from "./constants";
import { CURRICULUM } from "./curriculum";
import { GENERATED_CHAPTERS } from "./curriculum-items";
import { applyKidNames } from "./kid-cell-names";
import type { Grade } from "./kanji-grades";
import { GRADES } from "./kanji-grades";
import { KOKUGO_CHAPTERS } from "./kokugo";
import type { Chapter, SubjectId } from "./types";

const keyOf = (grade: Grade, subjectId: SubjectId): string => `${grade}:${subjectId}`;

/** 5年国語の漢字の章を置く場所。「言葉の特徴や使い方」（章の番号 01）の次（C-23） */
const KANJI_AFTER = "kokugo-5-01";

function buildCourses(): Map<string, readonly Chapter[]> {
  const courses = new Map<string, Chapter[]>();
  for (const chapter of GENERATED_CHAPTERS.map((generated) => applyKidNames(generated))) {
    const key = keyOf(chapter.grade, chapter.subjectId);
    const list = courses.get(key) ?? [];
    list.push(chapter);
    courses.set(key, list);
  }
  courses.set(keyOf(5, "sansu"), [...CHAPTERS]);
  const kokugo5 = courses.get(keyOf(5, "kokugo")) ?? [];
  const at = kokugo5.findIndex((chapter) => chapter.id === KANJI_AFTER);
  kokugo5.splice(at + 1, 0, ...KOKUGO_CHAPTERS);
  return courses;
}

const COURSES = buildCourses();
const NO_CHAPTERS: readonly Chapter[] = [];

/** その学年に実施される教科。CURRICULUM の学年ごとの教科から引き、並びは SUBJECTS の順（FR-001） */
export function subjectsOfGrade(grade: Grade): SubjectId[] {
  const subjects = CURRICULUM.find((entry) => entry.grade === grade)?.subjects ?? [];
  return SUBJECTS.map((subject) => subject.id).filter((id) => subjects.some((subject) => subject.subjectId === id));
}

/** 島に出す教科（FR-011）。今は算数・理科だけ */
export const SHOWN_SUBJECTS: readonly SubjectId[] = ["sansu", "rika"];

/** 画面に出す教科。その学年に実施される教科（subjectsOfGrade）と算数・理科の重なり。並びは SUBJECTS の順（FR-011） */
export function shownSubjectsOf(grade: Grade): SubjectId[] {
  return subjectsOfGrade(grade).filter((id) => SHOWN_SUBJECTS.includes(id));
}

/** その学年・教科の章（並びのまま）。無ければ空配列。同じ配列を返す */
export function chaptersOf(grade: Grade, subjectId: SubjectId): readonly Chapter[] {
  return COURSES.get(keyOf(grade, subjectId)) ?? NO_CHAPTERS;
}

/** 全学年・全教科の章。学年→教科の順 */
export const ALL_CHAPTERS: readonly Chapter[] = GRADES.flatMap((grade) => subjectsOfGrade(grade).flatMap((subjectId) => chaptersOf(grade, subjectId)));

const BY_ID = new Map(ALL_CHAPTERS.map((chapter) => [chapter.id, chapter]));

/** id から章を探す。どの学年の章でもよい */
export function findAnyChapter(id: string): Chapter | undefined {
  return BY_ID.get(id);
}
