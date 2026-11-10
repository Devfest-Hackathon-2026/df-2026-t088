// 学習を開くたびに数だけ入れ替える（D-254）。出題表の行（関数の名前と数）から、同じ関数・同じ形の別の数の行を作る。
// 入れ替えは「何回目か」（attempt）が種。0 回目は出題表のまま。乱数は種つきで、同じ種なら同じ行になる
import type { PlanEntry } from "./makers/types";
import {
  varyCalculate, varyCommon, varyCompare as varyFractionCompare, varyDecimalToFraction, varyDivide, varyEquivalent, varyEstimate,
  varyFractionToDecimal, varyIntToFraction, varyReduce, varyTerminates,
} from "./vary-fraction";
import {
  varyCommonDivisors, varyCommonMultiple, varyCompare, varyDecimalDivide, varyDistributive, varyDivideRemainder, varyDivisors, varyEvaluate,
  varyGcd, varyLcm, varyMultiples, varyMultiply, varyParity, varyPickRule, varyShift, varyTableBlank,
} from "./vary-math";
import { hashText, varyContextOf } from "./vary-random";
import type { Vary } from "./vary-random";

/** 関数の名前 → 数の入れ替え方。ここに無い関数の行は入れ替えない */
export const VARIES: Readonly<Record<string, Vary>> = {
  "fraction.reduce": varyReduce,
  "fraction.common": varyCommon,
  "fraction.compare": varyFractionCompare,
  "fraction.calculate": varyCalculate,
  "fraction.plain": varyCalculate,
  "fraction.estimate": varyEstimate,
  "fraction.divide": varyDivide,
  "fraction.equivalent": varyEquivalent,
  "number.fractionToDecimal": varyFractionToDecimal,
  "number.decimalToFraction": varyDecimalToFraction,
  "number.intToFraction": varyIntToFraction,
  "number.terminates": varyTerminates,
  "integer.parity": varyParity,
  "integer.divisors": varyDivisors,
  "integer.multiples": varyMultiples,
  "integer.commonDivisors": varyCommonDivisors,
  "integer.gcd": varyGcd,
  "integer.commonMultiple": varyCommonMultiple,
  "integer.lcm": varyLcm,
  "decimal.shift": varyShift,
  "decimal.compareProduct": varyCompare,
  "decimal.compareQuotient": varyCompare,
  "decimal.multiply": varyMultiply,
  "decimal.divide": varyDecimalDivide,
  "decimal.divideRemainder": varyDivideRemainder,
  "decimal.distributive": varyDistributive,
  "expression.pickRule": varyPickRule,
  "expression.tableBlank": varyTableBlank,
  "expression.evaluate": varyEvaluate,
};

/** 引き直しの上限。これで駄目なら元の行を使う */
export const MAX_DRAWS = 30;

/** 学習の名前と何回目かから決まる種 */
export const varySeed = (planId: string, attempt: number): number => hashText(`${planId}#${attempt}`);

/** draw 回目の候補。入れ替えられない関数は null */
export function varyEntry(entry: PlanEntry, seed: number, draw: number): PlanEntry | null {
  const vary = VARIES[entry.maker];
  return vary ? { maker: entry.maker, args: vary(entry.args, varyContextOf(seed, draw)) } : null;
}
