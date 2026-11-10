// 出題表から学習を組み立てる（FR-003・ADR-005）。差し込みの行は1行ずつ確かめ、落ちた行は捨てる
import { problemIdOf } from "./makers/format";
import { findMaker } from "./makers/index";
import type { PlanEntry, PlanOverrides } from "./makers/types";
import { DEFAULT_PLANS } from "./plans/sansu-5";
import type { LessonDefinition, LessonProblem } from "./problems";
import { MAX_DRAWS, varyEntry, varySeed } from "./vary";

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

/**
 * 行の数だけ入れ替えた問題を作る（D-254）。入れ替えた行は、check・build・verify を通り、元の行や前の行と同じ問題にならないものだけ使う。
 * 引き直しても駄目な行と、入れ替えられない関数の行は、元の行のまま
 */
function buildVaried(entry: PlanEntry, seed: number, seen: Set<string>): { id: string; problem: LessonProblem } | null {
  const original = buildEntry(entry);
  for (let draw = 0; draw < MAX_DRAWS; draw += 1) {
    const candidate = varyEntry(entry, seed, draw);
    if (!candidate) break;
    const built = buildEntry(candidate);
    if (built && built.id !== original?.id && !seen.has(built.id)) return built;
  }
  return original;
}

/** 行を問題にして、落ちた行と同じ id の後の行を捨て、先頭 10 行までにする。seed があれば数を入れ替える */
function buildProblems(entries: PlanEntry[], seed?: number): LessonProblem[] {
  const seen = new Set<string>();
  const problems: LessonProblem[] = [];
  for (const entry of entries) {
    const built = seed === undefined ? buildEntry(entry) : buildVaried(entry, seed, seen);
    if (!built || seen.has(built.id)) continue;
    seen.add(built.id);
    problems.push({ ...built.problem, id: built.id });
  }
  return problems.slice(0, MAX_LESSON_PROBLEMS);
}

const cache = new WeakMap<PlanOverrides, Map<string, LessonDefinition | undefined>>();

function assemble(planId: string, overrides: PlanOverrides, attempt: number): LessonDefinition | undefined {
  const plan = DEFAULT_PLANS[planId];
  if (!plan) return undefined;
  const override = Object.hasOwn(overrides, planId) ? overrides[planId] : undefined;
  let problems = override ? buildProblems(override) : [];
  // 先生が差し込んだ出題表は数を入れ替えない。0 回目（はじめて）は出題表のまま
  if (problems.length === 0) problems = buildProblems(plan.entries, attempt > 0 ? varySeed(planId, attempt) : undefined);
  if (problems.length === 0) return undefined;
  const lesson: LessonDefinition = { id: planId.slice(planId.indexOf(":") + 1), planId, isTilesFirst: plan.tilesFirst === true, problems };
  return plan.intro ? { ...lesson, intro: plan.intro } : lesson;
}

/**
 * 学習を組み立てる。同じ planId・overrides のオブジェクト・attempt なら、同じ LessonDefinition を返す。既定にも無い学習は undefined。
 * attempt は、その学習を終えた回数。1 以上なら既定の出題表の数を入れ替える（差し込みの出題表は入れ替えない）
 */
export function buildLesson(planId: string, overrides: PlanOverrides, attempt = 0): LessonDefinition | undefined {
  let byPlan = cache.get(overrides);
  if (!byPlan) {
    byPlan = new Map();
    cache.set(overrides, byPlan);
  }
  const key = `${planId}#${attempt}`;
  if (!byPlan.has(key)) byPlan.set(key, assemble(planId, overrides, attempt));
  return byPlan.get(key);
}
