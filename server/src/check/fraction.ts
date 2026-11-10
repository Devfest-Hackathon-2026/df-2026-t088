export type Fraction = { num: number; den: number };

function toBigIntFraction(value: Fraction): { num: bigint; den: bigint } {
  if (!Number.isSafeInteger(value.num) || !Number.isSafeInteger(value.den) || value.den === 0) {
    throw new RangeError("分数には安全な整数の分子と、0以外の分母が必要です。");
  }
  return { num: BigInt(value.num), den: BigInt(value.den) };
}

function fromBigIntFraction(num: bigint, den: bigint): Fraction {
  if (den === 0n) throw new RangeError("分母は0にできません。");
  if (den < 0n) { num = -num; den = -den; }
  const divisor = gcdBigInt(num, den);
  const reducedNum = num / divisor;
  const reducedDen = den / divisor;
  if (reducedNum > BigInt(Number.MAX_SAFE_INTEGER) || reducedNum < BigInt(Number.MIN_SAFE_INTEGER) || reducedDen > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("計算結果が安全な整数の範囲を超えています。");
  }
  return { num: Number(reducedNum), den: Number(reducedDen) };
}

function gcdBigInt(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a || 1n;
}

export function gcd(left: number, right: number): number {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) throw new RangeError("最大公約数には安全な整数が必要です。");
  const result = gcdBigInt(BigInt(left), BigInt(right));
  return Number(result);
}

export function reduceFraction(value: Fraction): Fraction {
  const fraction = toBigIntFraction(value);
  return fromBigIntFraction(fraction.num, fraction.den);
}

export function addFractions(left: Fraction, right: Fraction): Fraction {
  const a = toBigIntFraction(left);
  const b = toBigIntFraction(right);
  return fromBigIntFraction(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function subtractFractions(left: Fraction, right: Fraction): Fraction {
  const a = toBigIntFraction(left);
  const b = toBigIntFraction(right);
  return fromBigIntFraction(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function fractionsEqual(left: Fraction, right: Fraction): boolean {
  const a = toBigIntFraction(left);
  const b = toBigIntFraction(right);
  return a.num * b.den === b.num * a.den;
}
