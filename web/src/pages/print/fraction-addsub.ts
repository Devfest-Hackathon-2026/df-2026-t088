// 型「分数のたし算・ひき算」の範囲と、子どもの学習への変換。
// 範囲は docs/product/education-api-contract.md「プリントの型「分数のたし算・ひき算」」の表。server と同じ決まり
import { calculate, compareFractions, leastCommonMultiple } from "../../lesson/fraction";
import type { LessonDefinition } from "../../lesson/problems";
import { calculateProblem } from "../../lesson/problems";
import { tileLimitReason } from "../../lesson/makers/limits";
import type { FractionAddSubParams } from "./types";

export const FRACTION_TEMPLATE_ID = "sansu-fraction-addsub";
/** 学びの輪へ送る lessonKey */
export const FRACTION_LESSON_KEY = `print:${FRACTION_TEMPLATE_ID}`;
/** 単元の id（契約書） */
export const FRACTION_CHAPTER_ID = "sansu-5-fraction";
const MIN_DEN = 2;
const MAX_DEN = 12;
const MAX_COMMON_DEN = 24;
const MAX_SUM_WHOLES = 3;
const MAX_SIZE_WHOLES = 2;
const FRACTION_KEYS = ["num", "den"];

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every((key) => keys.includes(key));
const isInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

function readFraction(value: unknown): { num: number; den: number } | null {
  if (!isObject(value) || !hasOnlyKeys(value, FRACTION_KEYS)) return null;
  return isInt(value.num) && isInt(value.den) ? { num: value.num, den: value.den } : null;
}

/** 形が合う params だけを取り出す（範囲は見ない）。余計な項目があれば null */
export function readFractionParams(raw: unknown): FractionAddSubParams | null {
  if (!isObject(raw) || !hasOnlyKeys(raw, ["left", "op", "right"])) return null;
  const left = readFraction(raw.left);
  const right = readFraction(raw.right);
  if (!left || !right || (raw.op !== "+" && raw.op !== "-")) return null;
  return { left, op: raw.op, right };
}

/** 範囲の外なら理由、中なら null。盤に置けるかも見る */
export function fractionRangeReason(params: FractionAddSubParams): string | null {
  const { left, op, right } = params;
  for (const [label, value] of [["左", left], ["右", right]] as const) {
    if (value.den < MIN_DEN || value.den > MAX_DEN) return `${label}の分母は ${MIN_DEN}〜${MAX_DEN} にしてください`;
    if (value.num < 1) return `${label}の分子は 1 以上にしてください`;
    if (value.num > value.den * MAX_SIZE_WHOLES) return `${label}の分数は 2 以下にしてください`;
  }
  if (leastCommonMultiple([left.den, right.den]) > MAX_COMMON_DEN) return `通分した分母が ${MAX_COMMON_DEN} を超えます`;
  if (op === "+") {
    const sum = calculate(left, "+", right);
    if (sum.num > sum.den * MAX_SUM_WHOLES) return `答えが ${MAX_SUM_WHOLES} を超えます`;
  } else if (compareFractions(left, right) <= 0) {
    return "左を右より大きくしてください";
  }
  return tileLimitReason(calculateProblem(left, op, right));
}

/** 式の文。半角で「1/2 + 1/3」 */
export function fractionExpression({ left, op, right }: FractionAddSubParams): string {
  return `${left.num}/${left.den} ${op} ${right.num}/${right.den}`;
}

const EXPRESSION = /^\s*(\d+)\s*\/\s*(\d+)\s*([+-])\s*(\d+)\s*\/\s*(\d+)\s*$/;

/** questionText を式として読み、params と同じなら true */
export function expressionMatches(questionText: string, params: FractionAddSubParams): boolean {
  const match = EXPRESSION.exec(questionText);
  if (!match) return false;
  const [, ln, ld, op, rn, rd] = match;
  return Number(ln) === params.left.num && Number(ld) === params.left.den && op === params.op && Number(rn) === params.right.num && Number(rd) === params.right.den;
}

/** 配られた 1 問から、タイルの学習の定義を作る。範囲の外・形の違いは null（AI は呼ばない） */
export function fractionLessonOf(questionText: string, rawParams: unknown): LessonDefinition | null {
  const params = readFractionParams(rawParams);
  if (!params || fractionRangeReason(params) !== null || !expressionMatches(questionText, params)) return null;
  const { left, op, right } = params;
  return { id: FRACTION_LESSON_KEY, isTilesFirst: false, problems: [calculateProblem(left, op, right)] };
}
