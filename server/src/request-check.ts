import { parseExpression, type ParsedExpression } from "./check/expression.ts";
import { LIMITS } from "./limits.ts";

type Fraction = { num: number; den: number };

// 入口（parts・similar-problem・reflection）で、AI を呼ぶ前に式を確かめる共通の判定。
export function readRequestedExpression(text: string, maxTerm: number = LIMITS.maxFractionTerm): ParsedExpression | undefined {
  const parsed = parseExpression(text);
  if (!parsed.ok) return undefined;
  const { left, right, operator } = parsed.expression;
  // 分子0は、AI に渡しても検算で必ず落ちて無駄な呼び出しになる
  if (left.num === 0 || right.num === 0) return undefined;
  if ([left.num, left.den, right.num, right.den].some((value) => value > maxTerm)) return undefined;
  if (operator === "-" && left.num * right.den < right.num * left.den) return undefined;
  return parsed.expression;
}

// 組が同じかどうか。たし算・ひき算の両方で、左右を入れ替えた組も同じ組として数える。
export function isSameFractionPair(first: ParsedExpression, second: ParsedExpression): boolean {
  return first.operator === second.operator
    && ((sameFraction(first.left, second.left) && sameFraction(first.right, second.right))
      || (sameFraction(first.left, second.right) && sameFraction(first.right, second.left)));
}

function sameFraction(left: Fraction, right: Fraction): boolean {
  return left.num === right.num && left.den === right.den;
}
