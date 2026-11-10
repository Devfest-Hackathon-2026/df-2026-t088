import type { LessonTarget } from "../game/logic";

export type GradeOneTopic = "compare" | "count" | "order" | "compose" | "tens" | "hundred" | "tens-unit" | "groups" | "compare-groups" | "addition" | "subtraction" | "carry" | "two-digit" | "borrow" | "shape" | "shape-build" | "position" | "shape-parts" | "length" | "measure" | "volume" | "clock" | "daily-time" | "chart" | "chart-read";
export const GRADE_ONE_TOPICS: Record<string, readonly GradeOneTopic[]> = {
  "sansu-1-01": ["compare", "count", "order", "compose", "tens", "hundred", "tens-unit", "groups", "compare-groups"],
  "sansu-1-02": ["addition", "subtraction", "carry", "two-digit", "borrow"],
  "sansu-1-03": ["shape", "shape-build", "position", "shape-parts"],
  "sansu-1-04": ["length", "measure", "volume"],
  "sansu-1-05": ["clock", "daily-time"],
  "sansu-1-06": ["chart", "chart-read"],
};
/** 章の各マスとまとめに対応する学びを返す。 */
export function findGradeOne(chapterId: string, target: LessonTarget): GradeOneTopic | undefined {
  const items = GRADE_ONE_TOPICS[chapterId];
  if (!items) return undefined;
  if (target.kind === "test") return items[0];
  return target.kind === "main" ? items[target.index] : undefined;
}
export function hasGradeOne(chapterId: string): boolean {
  return Object.hasOwn(GRADE_ONE_TOPICS, chapterId);
}

/** まとめでは章内の全マスから例題を出す。 */
export function gradeOneSummary(chapterId: string): readonly GradeOneTopic[] {
  return GRADE_ONE_TOPICS[chapterId] ?? [];
}
