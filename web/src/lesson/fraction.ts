// 分数の計算。分数は整数の {num, den} で持つ。小数にすると 1/3 + 1/6 のような値の比較が誤るので、割り算で比べない

export interface Fraction {
  num: number;
  den: number;
}

export type Operator = "+" | "-";

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let [a, b] = [left < 0n ? -left : left, right < 0n ? -right : right];
  while (b !== 0n) [a, b] = [b, a % b];
  return a || 1n;
}

function toSafeFraction(num: bigint, den: bigint): Fraction {
  const divisor = greatestCommonDivisor(num, den);
  const fraction = { num: Number(num / divisor), den: Number(den / divisor) };
  if (!Number.isSafeInteger(fraction.num) || !Number.isSafeInteger(fraction.den)) {
    throw new RangeError("計算結果が安全な整数の範囲を超えています");
  }
  return fraction;
}

function crossProducts(left: Fraction, right: Fraction): [bigint, bigint] {
  return [BigInt(left.num) * BigInt(right.den), BigInt(right.num) * BigInt(left.den)];
}

export function fractionsEqual(left: Fraction, right: Fraction): boolean {
  const [a, b] = crossProducts(left, right);
  return a === b;
}

/** left が right より大きければ 1、小さければ -1、同じなら 0。割り算はしない */
export function compareFractions(left: Fraction, right: Fraction): -1 | 0 | 1 {
  const [a, b] = crossProducts(left, right);
  if (a === b) return 0;
  return a > b ? 1 : -1;
}

/** これ以上約分できないか */
export function isLowestTerms({ num, den }: Fraction): boolean {
  return greatestCommonDivisor(BigInt(num), BigInt(den)) === 1n;
}

/** 約分した答えを返す。安全な整数を超えたら RangeError */
export function calculate(left: Fraction, operator: Operator, right: Fraction): Fraction {
  const [a, b] = crossProducts(left, right);
  return toSafeFraction(operator === "+" ? a + b : a - b, BigInt(left.den) * BigInt(right.den));
}

/** value が 1/unitDen の何枚分か。割り切れなければ null */
export function countUnits(value: Fraction, unitDen: number): number | null {
  const units = BigInt(value.num) * BigInt(unitDen);
  return units % BigInt(value.den) === 0n ? Number(units / BigInt(value.den)) : null;
}

export function leastCommonMultiple(values: number[]): number {
  const result = values.reduce((total, value) => total / greatestCommonDivisor(total, BigInt(value)) * BigInt(value), 1n);
  return Number(result);
}

/** 切り上げた整数。ものさしの長さに使う */
export function ceilToWhole({ num, den }: Fraction): number {
  return Number((BigInt(num) + BigInt(den) - 1n) / BigInt(den));
}
