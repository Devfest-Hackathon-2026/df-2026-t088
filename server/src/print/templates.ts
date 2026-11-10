import { parseExpression } from "../check/expression.ts";
import { addFractions, gcd, subtractFractions, type Fraction } from "../check/fraction.ts";

export type PrintTemplateId = "rika-lever" | "rika-moon" | "sansu-fraction-addsub";
export type LeverParams = { left: { pos: number; g: number }; right: { pos: number } };
export type PrintTemplate = {
  id: PrintTemplateId;
  unit: string;
  validateParams: (params: unknown) => string[];
  /** 問題文にどれか 1 つは含まれるはずの言葉。AI が型を取り違えたものを、プログラムで落とす */
  keywords: readonly string[];
  /** 言葉の照合の代わりに使う。問題文が数だけで言葉が無い型は、文を式として読み直して params と比べる */
  questionMatches?: (questionText: string, params: unknown) => boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validPosition(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 6;
}

function validateLever(params: unknown): string[] {
  if (!isRecord(params) || Object.keys(params).some((key) => key !== "left" && key !== "right")
    || !isRecord(params.left) || !isRecord(params.right)
    || Object.keys(params.left).some((key) => key !== "pos" && key !== "g")
    || Object.keys(params.right).some((key) => key !== "pos")) return ["てこの数の形が違います"];
  const { left, right } = params;
  if (!validPosition(left.pos) || !validPosition(right.pos)) return ["てこの位置は1から6までです"];
  if (!Number.isInteger(left.g) || (left.g as number) < 10 || (left.g as number) > 100 || (left.g as number) % 10 !== 0) return ["重さは10から100までの10刻みです"];
  const answer = (left.g as number) * left.pos / right.pos;
  if (!Number.isInteger(answer) || answer < 10 || answer > 100 || answer % 10 !== 0) return ["てこの答えは10から100までの10の倍数です"];
  return [];
}

function validateMoon(params: unknown): string[] {
  return isRecord(params) && Object.keys(params).length === 0 ? [] : ["月の問題には数を付けません"];
}

const FRACTION_MAX_DEN = 12;
const FRACTION_MAX_COMMON_DEN = 24;
const FRACTION_MAX_RULER_UNITS = 48;
const FRACTION_MAX_SUM = 3;
const FRACTION_QUESTION = /^\s*\d+\s*\/\s*\d+\s*[+-]\s*\d+\s*\/\s*\d+\s*$/;

function readFraction(value: unknown): Fraction | undefined {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "num" && key !== "den")) return undefined;
  const { num, den } = value;
  if (!Number.isInteger(num) || !Number.isInteger(den)) return undefined;
  if ((den as number) < 2 || (den as number) > FRACTION_MAX_DEN || (num as number) < 1 || (num as number) > (den as number) * 2) return undefined;
  return { num: num as number, den: den as number };
}

function validateFractionAddSub(params: unknown): string[] {
  if (!isRecord(params) || Object.keys(params).some((key) => key !== "left" && key !== "op" && key !== "right")
    || (params.op !== "+" && params.op !== "-")) return ["分数の数の形が違います"];
  const left = readFraction(params.left);
  const right = readFraction(params.right);
  if (!left || !right) return ["分母は2から12まで、分子は1以上で分数の大きさは2以下です"];
  const commonDen = left.den / gcd(left.den, right.den) * right.den;
  if (commonDen > FRACTION_MAX_COMMON_DEN) return ["通分した分母は24以下です"];
  // 子どもの盤は、1 の数 × 通分した分母 が 48 までしか置けない（web/src/lesson/makers/limits.ts の tileLimitReason と同じ決まり）。
  // ここで落とさないと、先生は配れるのに、子どもの画面で「ひらけませんでした」になる（全部の組み合わせの試験で見つけた）
  const wholesOf = (value: { num: number; den: number }): number => Math.max(1, Math.ceil(value.num / value.den));
  const tooBig = (value: { num: number; den: number }): boolean => wholesOf(value) * commonDen > FRACTION_MAX_RULER_UNITS;
  if (params.op === "+") {
    const sum = addFractions(left, right);
    if (sum.num > sum.den * FRACTION_MAX_SUM) return ["たし算の答えは3以下です"];
    return tooBig(sum) ? ["盤に置ける大きさを超えています"] : [];
  }
  const difference = subtractFractions(left, right);
  if (difference.num <= 0) return ["ひき算は左が右より大きくします"];
  return tooBig(left) ? ["盤に置ける大きさを超えています"] : [];
}

function fractionQuestionMatches(questionText: string, params: unknown): boolean {
  if (!FRACTION_QUESTION.test(questionText) || !isRecord(params)) return false;
  const parsed = parseExpression(questionText);
  const left = readFraction(params.left);
  const right = readFraction(params.right);
  if (!parsed.ok || !left || !right) return false;
  const { expression } = parsed;
  // 約分した形に読み替えず、書かれた数がそのまま params と同じかを見る
  return expression.operator === params.op
    && expression.left.num === left.num && expression.left.den === left.den && expression.right.num === right.num && expression.right.den === right.den;
}

export const PRINT_TEMPLATES: readonly PrintTemplate[] = [
  { id: "rika-lever", unit: "理科 6 年 てこのはたらき", validateParams: validateLever, keywords: ["てこ", "支点", "目もり", "めもり", "おもり", "つり合"] },
  { id: "rika-moon", unit: "理科 6 年 月の見え方", validateParams: validateMoon, keywords: ["月"] },
  { id: "sansu-fraction-addsub", unit: "算数 5 年 分数のたし算・ひき算", validateParams: validateFractionAddSub, keywords: [], questionMatches: fractionQuestionMatches },
];

export function printTemplate(id: unknown): PrintTemplate | undefined {
  return PRINT_TEMPLATES.find((template) => template.id === id);
}
