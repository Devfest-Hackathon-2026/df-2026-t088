// 問題の関数の型。名前と数の並び（args）で問題を作る。出題表（plans/）と組み立てがこの形に依存する
import type { Fraction } from "../fraction";
import type { LessonIntro, LessonProblem } from "../problems";

/** 出題表の数。分数は {num, den}、真偽値は calculate の showMixed だけ */
export type Arg = number | Fraction | string | boolean;

/** 出題表の1行 */
export interface PlanEntry {
  maker: string;
  args: Arg[];
}

/** 学習の出題表 */
export interface LessonPlan {
  /** 先にタイルで解く学習 */
  tilesFirst?: boolean;
  /** 1問目の前に見せる図解。差し込みの出題表では変えない */
  intro?: LessonIntro;
  entries: PlanEntry[];
}

/** 差し込まれた出題表。学習の名前（`{章 id}:{key}`）→ 行の並び。tilesFirst は差し込めない */
export type PlanOverrides = Record<string, PlanEntry[]>;

export type CheckResult = { ok: true; args: Arg[] } | { ok: false; reason: string };

export interface ProblemMaker {
  /** 例 `fraction.calculate` */
  name: string;
  kind: "tile" | "number";
  /** 形と範囲を確かめ、正規化した args（省ける値は省いた形）を返す */
  check(args: unknown[]): CheckResult;
  /** 正規化した args から問題を作る。check を通らない args では RangeError */
  build(args: Arg[]): LessonProblem;
  /** 問題が正しければ null、だめなら理由 */
  verify(problem: LessonProblem): string | null;
}
