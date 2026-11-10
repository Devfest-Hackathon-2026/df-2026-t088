// 間違い方の型。子どもが答え欄に打った間違いを、プログラムの規則で分ける（AI は使わない）。
// 規則の正本は docs/product/education-api-contract.md「間違い方の型（仮）」。judge.ts は触らず、ここだけで完結させる。
import { calculate, fractionsEqual, leastCommonMultiple } from "./fraction";
import type { Fraction, Operator } from "./fraction";
import { readAnswer } from "./judge";
import type { CalculateProblem } from "./problems";

export type ErrorPattern = "sum-both" | "sum-num-only" | "same-den-sum" | "lever-same-weight" | "lever-inverse" | "unclassified";

/** プリントのてこの規則表。子どもには承認済みの文がないときだけ使う */
export const LEVER_HINT_BY_PATTERN = {
  "lever-same-weight": "左と右では、支点からのきょりがちがうよ。重さ × きょりで比べよう",
  "lever-inverse": "支点から遠いほど、軽いおもりでつり合うよ",
} as const;

const apply = (a: number, operator: Operator, b: number): number => (operator === "+" ? a + b : a - b);

// 打った答えと比べる候補。負や 0 の分母は答えになり得ないので、比べない
const isUsable = (value: Fraction): boolean => value.num > 0 && value.den > 0;

/**
 * 分子どうし、分母どうしを計算した。
 * 分母が同じたし算では、この形は same-den-sum（正しい答えの半分）と必ず同じ値になり、型が付かなくなる。
 * 分母が同じなら「分母どうしをたした」と「そろえた後に分母もたした」は同じ操作なので、same-den-sum だけで数える（#264）
 */
function sumBoth({ left, operator, right }: CalculateProblem): Fraction[] {
  if (operator === "+" && left.den === right.den) return [];
  return [{ num: apply(left.num, operator, right.num), den: apply(left.den, operator, right.den) }];
}

/** 分子だけを計算して、分母は足さなかった。どの分母を使ったかは、答えから区別できないので、まとめて 1 つにする */
function sumNumOnly({ left, operator, right }: CalculateProblem): Fraction[] {
  const num = apply(left.num, operator, right.num);
  const dens = [left.den, right.den, left.den * right.den, leastCommonMultiple([left.den, right.den]), Math.max(left.den, right.den), Math.min(left.den, right.den)];
  return dens.map((den) => ({ num, den }));
}

/** 分母をそろえたが、分母もたした。たし算だけで、正しい答えの半分になる */
function sameDenSum({ left, operator, right }: CalculateProblem): Fraction[] {
  if (operator !== "+") return [];
  const correct = calculate(left, "+", right);
  return [{ num: correct.num, den: correct.den * 2 }];
}

const RULES: [Exclude<ErrorPattern, "unclassified">, (problem: CalculateProblem) => Fraction[]][] = [
  ["sum-both", sumBoth],
  ["sum-num-only", sumNumOnly],
  ["same-den-sum", sameDenSum],
];

const matchesAny = (answer: Fraction, candidates: Fraction[]): boolean =>
  candidates.some((candidate) => isUsable(candidate) && fractionsEqual(answer, candidate));

/**
 * 間違った答えを分ける。1 つの型にだけ合うときだけ型を付け、複数に合う、どれにも合わない、
 * 読めない、正しい答え、のときは unclassified にする（答え 1 つでは、考え方は決まらないため）
 */
export function classifyWrongAnswer(problem: CalculateProblem, answerText: string): ErrorPattern {
  const answer = readAnswer(answerText);
  if (!answer) return "unclassified";
  try {
    if (fractionsEqual(answer, calculate(problem.left, problem.operator, problem.right))) return "unclassified";
    const matched = RULES.filter(([, candidatesOf]) => matchesAny(answer, candidatesOf(problem)));
    const only = matched.length === 1 ? matched[0] : undefined;
    return only ? only[0] : "unclassified";
  } catch {
    // 計算が安全な整数を超えたときは、型を付けない
    return "unclassified";
  }
}
