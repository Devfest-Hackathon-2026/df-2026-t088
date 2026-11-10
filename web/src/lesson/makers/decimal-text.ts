// 小数の文字と分数の行き来。小数は浮動小数にせず、10 の累乗を分母にした分数にして計算する（NFR-007）
import { calculate } from "../fraction";
import type { Fraction } from "../fraction";
import type { DecimalText } from "../number-problem";

const DECIMAL = /^(\d+)(?:\.(\d+))?$/;

/** 小数点より下のけた数 */
export function decimalPlaces(text: DecimalText): number {
  return DECIMAL.exec(text)?.[2]?.length ?? 0;
}

/** "12.34" → {num: 1234, den: 100}。約分しない。読めない文字や安全な整数を超える時は null */
export function parseDecimal(text: string): Fraction | null {
  const match = DECIMAL.exec(text);
  if (!match) return null;
  const [, whole = "", digits = ""] = match;
  const num = Number(`${whole}${digits}`);
  const den = 10 ** digits.length;
  return Number.isSafeInteger(num) && Number.isSafeInteger(den) ? { num, den } : null;
}

/** 分数を、余分な 0 の無い小数の文字にする。小数で終わらない分数（1/3 など）は null */
export function formatDecimal(value: Fraction): DecimalText | null {
  const { num, den } = calculate(value, "+", { num: 0, den: 1 });
  let rest = den;
  let places = 0;
  for (const factor of [2, 5]) {
    while (rest % factor === 0) rest /= factor;
  }
  if (rest !== 1) return null;
  while (10 ** places % den !== 0) places += 1;
  const scaled = BigInt(num) * (10n ** BigInt(places) / BigInt(den));
  const digits = scaled.toString().padStart(places + 1, "0");
  if (places === 0) return digits;
  return `${digits.slice(0, -places)}.${digits.slice(-places)}`;
}

/** 正規化した小数の文字か（"0.5" は真、"0.50"・"00.5"・".5"・"3." は偽） */
export function isCanonicalDecimal(text: string): boolean {
  const value = parseDecimal(text);
  return value !== null && formatDecimal(value) === text;
}
