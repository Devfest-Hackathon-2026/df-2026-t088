// 出題表から学習を組み立てる（FR-003・ADR-005）。差し込みの行は1行ずつ確かめ、落ちた行は捨てる
import { problemIdOf } from "./makers/format";
import { findMaker } from "./makers/index";
import type { PlanEntry, PlanOverrides } from "./makers/types";
import { DEFAULT_PLANS } from "./plans/sansu-5";
import type { LessonDefinition, LessonProblem } from "./problems";

/** 1つの学習の問題の数の上限 */
export const MAX_LESSON_PROBLEMS = 10;

/** 出題表のある学習の名前を、並べて返す */
export const defaultPlanIds = (): string[] => Object.keys(DEFAULT_PLANS);

/** 1行を問題にする。check・build・verify のどれかで落ちたら null */
function buildEntry(entry: PlanEntry): { id: string; problem: LessonProblem } | null {
  const maker = findMaker(entry.maker);
  if (!maker) return null;
  try {
    const checked = maker.check(entry.args);
    if (!checked.ok) return null;
    const problem = maker.build(checked.args);
    if (maker.verify(problem) !== null) return null;
    return { id: problemIdOf(maker.name, checked.args), problem };
  } catch {
    return null;
  }
}

/** 行を問題にして、落ちた行と同じ id の後の行を捨て、先頭 10 行までにする */
function buildProblems(entries: PlanEntry[]): LessonProblem[] {
  const seen = new Set<string>();
  const problems: LessonProblem[] = [];
  for (const entry of entries) {
    const built = buildEntry(entry);
    if (!built || seen.has(built.id)) continue;
    seen.add(built.id);
    problems.push({ ...built.problem, id: built.id });
  }
  return problems.slice(0, MAX_LESSON_PROBLEMS);
}

const cache = new WeakMap<PlanOverrides, Map<string, LessonDefinition | undefined>>();

function assemble(planId: string, overrides: PlanOverrides): LessonDefinition | undefined {
  const plan = DEFAULT_PLANS[planId];
  if (!plan) return undefined;
  const override = Object.hasOwn(overrides, planId) ? overrides[planId] : undefined;
  let problems = override ? buildProblems(override) : [];
  if (problems.length === 0) problems = buildProblems(plan.entries);
  if (problems.length === 0) return undefined;
  const lesson: LessonDefinition = { id: planId.slice(planId.indexOf(":") + 1), planId, isTilesFirst: plan.tilesFirst === true, problems };
  return plan.intro ? { ...lesson, intro: plan.intro } : lesson;
}

/** 学習を組み立てる。同じ planId と同じ overrides のオブジェクトなら、同じ LessonDefinition を返す。既定にも無い学習は undefined */
export function buildLesson(planId: string, overrides: PlanOverrides): LessonDefinition | undefined {
  let byPlan = cache.get(overrides);
  if (!byPlan) {
    byPlan = new Map();
    cache.set(overrides, byPlan);
  }
  if (!byPlan.has(planId)) byPlan.set(planId, assemble(planId, overrides));
  return byPlan.get(planId);
}
