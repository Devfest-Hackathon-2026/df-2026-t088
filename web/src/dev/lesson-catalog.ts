import { chaptersOf } from "../data";
import type { Chapter } from "../data";
import type { Grade } from "../data/kanji-grades";
import { findGradeOne, gradeOneSummary } from "../lesson/grade-one";
import { GRADE_ONE_SUMMARY } from "../lesson/grade-one-summary";
import { findGradeTwo, gradeTwoSummary } from "../lesson/grade-two";
import { findUpperMath, upperMathSummary } from "../lesson/upper-math";
import { findLesson } from "../lesson/fraction-lessons";
import { targetOf, titleOf } from "../pages/lesson/lesson-common";

export function catalogEntry(chapter: Chapter, key: string) {
  const target = targetOf(key, chapter)!;
  const test = target.kind === "test";
  const one = findGradeOne(chapter.id, target);
  const two = findGradeTwo(chapter.id, target);
  const upper = findUpperMath(chapter.id, target);
  const fraction = findLesson(chapter.id, target);
  const ones = one ? test ? gradeOneSummary(chapter.id) : [one] : [];
  const twos = two ? test ? gradeTwoSummary(chapter.id) : [two.practice] : [];
  const uppers = upper ? test ? upperMathSummary(chapter.id) : [upper, ...(upper.followUps ?? [])] : [];
  const makeTen = !test && two?.practice.visual?.type === "make-ten";
  const count = makeTen ? 2 : ones.length || twos.length || uppers.length || (fraction?.intro ? 1 : fraction?.problems.length ?? 0);
  const title = test ? titleOf(chapter, target) : one ? GRADE_ONE_SUMMARY[one].title : two?.practice.title ?? upper?.title ?? titleOf(chapter, target);
  return { chapter, key, test, title, ones, twos, uppers, fraction, count, makeTen };
}
export function lessonCatalog(grade: Grade) {
  return chaptersOf(grade, "sansu").map((chapter) => ({ chapter, entries: [
    ...chapter.items.map((_, i) => catalogEntry(chapter, `main-${i}`)),
    ...chapter.sides.map((side) => catalogEntry(chapter, side.id)),
    catalogEntry(chapter, "test"),
  ] }));
}
export type CatalogEntry = ReturnType<typeof catalogEntry>;
