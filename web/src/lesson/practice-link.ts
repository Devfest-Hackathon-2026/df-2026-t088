import { findAnyChapter } from "../data/courses";
import { targetOf, titleOf } from "../pages/lesson/lesson-common";
import { buildLesson, defaultPlanIds } from "./plan";

const basePlan = {};

export const practicePlans = () => defaultPlanIds().flatMap((id) => {
  const [chapterId, key] = id.split(":");
  const chapter = findAnyChapter(chapterId);
  const target = chapter ? targetOf(key, chapter) : null;
  const lesson = buildLesson(id, basePlan);
  if (!chapter || !target || !lesson || lesson.problems.length < 2) return [];
  return [{ id, chapter, title: titleOf(chapter, target), lesson }];
});

export function practiceHash(planId: string, problemIds: readonly string[]): string {
  const params = new URLSearchParams({ plan: planId });
  for (const id of problemIds) params.append("problem", id);
  return `#${params}`;
}

export function practiceFromHash(hash: string) {
  const params = new URLSearchParams(hash.slice(1));
  const plan = practicePlans().find(({ id }) => id === params.get("plan"));
  if (!plan) return null;

  const ids = params.getAll("problem");
  const byId = new Map(plan.lesson.problems.map((problem) => [problem.id, problem]));
  if (ids.length !== byId.size || new Set(ids).size !== ids.length) return null;

  const problems = ids.map((id) => byId.get(id)).filter((problem) => problem !== undefined);
  return problems.length === ids.length ? { title: plan.title, lesson: { ...plan.lesson, problems } } : null;
}
