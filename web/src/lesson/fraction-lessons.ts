// 出題表のある章（分数・整数・小数・□と△の式）の学習。出題表（plans/sansu-5.ts）から組み立てる。
// 問題の出どころ（Q-01）はプログラムで作ると決まった（D-131）。章のテストは点を出さない。Q-02 が決まるまでの仮
// ファイル名は分数の章だけだった頃のまま（import している所が多いので変えない）
import type { LessonTarget } from "../game/logic";
import { buildLesson, defaultPlanIds } from "./plan";
import { currentPlanOverrides } from "./plan-source";
import type { LessonDefinition } from "./problems";

/** 学習の名前。URL と途中の記録に使う */
export function lessonKey(target: LessonTarget): string {
  if (target.kind === "main") return `main-${target.index}`;
  return target.kind === "test" ? "test" : target.sideId;
}

/** 作ってある学習を探す。作っていないマスは undefined で、「はじめる」を押すと CP-222 のトーストを出す（D-93） */
export function findLesson(chapterId: string, target: LessonTarget): LessonDefinition | undefined {
  return buildLesson(`${chapterId}:${lessonKey(target)}`, currentPlanOverrides());
}

/** その章に、組み立てられる学習があるか */
export function hasLessons(chapterId: string): boolean {
  const prefix = `${chapterId}:`;
  return defaultPlanIds().some((planId) => planId.startsWith(prefix) && buildLesson(planId, currentPlanOverrides()) !== undefined);
}
