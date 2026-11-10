// 出題表のある章（分数・整数・小数・□と△の式）の学習。出題表（plans/sansu-5.ts）から組み立てる。
// 問題の出どころ（Q-01）はプログラムで作ると決まった（D-131）。2回目からは数だけ入れ替える（D-254）。章のテストは点を出さない。Q-02 が決まるまでの仮
// ファイル名は分数の章だけだった頃のまま（import している所が多いので変えない）
import { loadAttempt } from "../game/lesson-resume";
import type { LessonTarget } from "../game/logic";
import { buildLesson, defaultPlanIds } from "./plan";
import { currentPlanOverrides } from "./plan-source";
import type { LessonDefinition } from "./problems";

/** 学習の名前。URL と途中の記録に使う */
export function lessonKey(target: LessonTarget): string {
  if (target.kind === "main") return `main-${target.index}`;
  return target.kind === "test" ? "test" : target.sideId;
}

/** 作ってある学習を探す。作っていないマスは undefined を返す。 */
export function findLesson(chapterId: string, target: LessonTarget): LessonDefinition | undefined {
  const planId = `${chapterId}:${lessonKey(target)}`;
  // 終えた回数が 1 以上なら数を入れ替える（D-254）。途中で読み直しても回数は変わらないので同じ問題
  return buildLesson(planId, currentPlanOverrides(), loadAttempt(planId));
}

/** その章に、組み立てられる学習があるか */
export function hasLessons(chapterId: string): boolean {
  const prefix = `${chapterId}:`;
  return defaultPlanIds().some((planId) => planId.startsWith(prefix) && buildLesson(planId, currentPlanOverrides()) !== undefined);
}
