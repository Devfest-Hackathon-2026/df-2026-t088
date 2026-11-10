// 整数・小数・□と△の式の章の数の入れ替え（D-254）。何を変えて何を変えないかは各関数の上に書く。
// ここで作る args は候補で、check・build・verify に通してから使う（plan.ts）。範囲は makers/ が決める
import type { Arg } from "./makers/types";
import { gcdOf, lcmOf, varyDigits } from "./vary-random";
import type { Random, Vary } from "./vary-random";

const TRIES = 300;
const isInt = (arg: Arg | undefined): arg is number => typeof arg === "number";
const range = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);
const countDivisors = (n: number): number => range(1, n).filter((d) => n % d === 0).length;
const isPrime = (n: number): boolean => n >= 2 && countDivisors(n) === 2;
const textOf = (arg: Arg | undefined): string | null => (typeof arg === "string" ? arg : isInt(arg) ? String(arg) : null);

/* ---------- 整数 ---------- */

/** integer.parity(n)。0 はそのまま。1 けたか 2 けたか、偶数か奇数かは変えない */
export const varyParity: Vary = (args, context) => {
  const [n] = args;
  if (!isInt(n) || n === 0) return args;
  const [lo, hi] = n < 10 ? [1, 9] : [10, 99];
  const value = context.random(`parity:${n}`).int(lo, hi);
  return [value % 2 === n % 2 ? value : value + 1 > hi ? value - 1 : value + 1];
};

/** integer.divisors(n)。素数なら別の素数、そうでなければ約数の数が近い（約 3 割以内、±1 以上）合成数（6〜36） */
export const varyDivisors: Vary = (args, context) => {
  const [n] = args;
  if (!isInt(n)) return args;
  const random = context.random(`divisors:${n}`);
  if (isPrime(n)) return [random.pick(range(2, 36).filter(isPrime))];
  const near = range(6, 36).filter((value) => !isPrime(value) && Math.abs(countDivisors(value) - countDivisors(n)) <= Math.max(1, Math.round(countDivisors(n) * 0.3)));
  return [random.pick(near)];
};

/** integer.multiples(k, upTo)。倍数の個数が ±2 以内になる k と範囲にする（k は 2〜12、範囲は 12〜36） */
export const varyMultiples: Vary = (args, context) => {
  const [k, upTo] = args;
  if (!isInt(k) || !isInt(upTo)) return args;
  const random = context.random(`multiples:${k},${upTo}`);
  const count = Math.floor(upTo / k);
  for (let tries = 0; tries < TRIES; tries += 1) {
    const nextK = random.int(Math.max(2, k - 2), Math.min(12, k + 2));
    const nextUpTo = random.int(Math.max(12, upTo - 5), Math.min(36, upTo + 3));
    const nextCount = Math.floor(nextUpTo / nextK);
    if (nextCount >= Math.max(2, count - 2) && nextCount <= count + 2) return [nextK, nextUpTo];
  }
  return args;
};

/** 2 数の a と b を、公約数 g と「たがいに素な」p, q の積（a = g×p, b = g×q）として作り直す。g が 1 の組は g = 1 のまま */
function varyCoprimePair(a: number, b: number, random: Random, cap: number): [number, number] | null {
  const g = gcdOf(a, b);
  const [p, q] = [a / g, b / g];
  for (let tries = 0; tries < TRIES; tries += 1) {
    const nextP = p === 1 ? 1 : random.int(2, Math.max(4, p));
    const nextQ = random.int(Math.max(2, nextP + 1), Math.max(5, q));
    if (gcdOf(nextP, nextQ) !== 1) continue;
    const nextG = g === 1 ? 1 : random.int(2, Math.floor(cap / nextQ));
    if (nextG >= 1 && nextG * nextQ <= cap && nextG * nextP >= 2) return a <= b ? [nextG * nextP, nextG * nextQ] : [nextG * nextQ, nextG * nextP];
  }
  return null;
}

/** integer.commonDivisors(a, b)。最大公約数が 1 か、a が b の約数か、の形は変えない。数は元の大きい方 + 6 まで（36 まで） */
export const varyCommonDivisors: Vary = (args, context) => {
  const [a, b] = args;
  if (!isInt(a) || !isInt(b)) return args;
  const pair = varyCoprimePair(a, b, context.random(`commonDivisors:${a},${b}`), Math.min(36, Math.max(a, b) + 6));
  return pair ?? args;
};

/** integer.gcd(a, b)。形は commonDivisors と同じ。数は元の大きい方 + 10 まで（100 まで） */
export const varyGcd: Vary = (args, context) => {
  const [a, b] = args;
  if (!isInt(a) || !isInt(b)) return args;
  const pair = varyCoprimePair(a, b, context.random(`gcd:${a},${b}`), Math.min(100, Math.max(a, b) + 10));
  return pair ?? args;
};

/** 2 数の関係。片方がもう片方の約数・たがいに素・それ以外 */
const relationOf = (a: number, b: number): string => (lcmOf(a, b) === Math.max(a, b) ? "divides" : gcdOf(a, b) === 1 ? "coprime" : "common");

/**
 * 2 数 a, b（2〜20、a < b）を、元と同じ関係で作り直す。最小公倍数 × times が 100 以下になるものだけ
 */
function varyMultiplePair(a: number, b: number, random: Random, times: number): [number, number] | null {
  const cap = Math.min(20, Math.max(a, b) + 4);
  for (let tries = 0; tries < TRIES; tries += 1) {
    const [x, y] = [random.int(2, cap), random.int(2, cap)].sort((left, right) => left - right) as [number, number];
    if (x !== y && relationOf(x, y) === relationOf(a, b) && lcmOf(x, y) * times <= 100) return [x, y];
  }
  return null;
}

/** integer.commonMultiple(a, b, nth)。同じ (a, b) の行は同じ組に入れ替える（8 と 12 の「1 番目」と「2 番目」）。nth は変えない。最小公倍数 × 3 が 100 以下 */
export const varyCommonMultiple: Vary = (args, context) => {
  const [a, b, nth] = args;
  if (!isInt(a) || !isInt(b) || !isInt(nth)) return args;
  const pair = varyMultiplePair(a, b, context.random(`commonMultiple:${a},${b}`), 3);
  return pair ? [pair[0], pair[1], nth] : args;
};

/** integer.lcm(a, b)。関係（約数・たがいに素・それ以外）は変えない */
export const varyLcm: Vary = (args, context) => {
  const [a, b] = args;
  if (!isInt(a) || !isInt(b)) return args;
  const pair = varyMultiplePair(a, b, context.random(`lcm:${a},${b}`), 1);
  return pair ?? args;
};

/* ---------- 小数 ---------- */

const placesOf = (text: string): number => (text.includes(".") ? text.length - text.indexOf(".") - 1 : 0);
const scaleOf = (text: string, places: number): number => Math.round(Number(text) * 10 ** places);

/** 整数 n を 10^places で割った小数の文字。余分な 0 は付けない */
function fromScaled(n: number, places: number): string {
  const digits = String(n).padStart(places + 1, "0");
  if (places === 0) return digits;
  return `${digits.slice(0, -places)}.${digits.slice(-places)}`.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** decimal.shift(x, factor)。倍率は変えない。x は、けた数・小数点の位置・0 の桁を変えず、0 でない桁だけ入れ替える */
export const varyShift: Vary = (args, context) => {
  const [x, factor] = args;
  const text = textOf(x);
  if (text === null || factor === undefined) return args;
  return [varyDigits(text, context.random(`shift:${text}`)), factor];
};

/**
 * decimal.compareProduct / compareQuotient(a, b)。b が 1 より大きいか小さいかは変えない（0.1〜0.9、1.1〜3.9）。
 * a は、けた数・0 の桁を変えず入れ替える。同じ a の行は同じ a にする（80 に 0.8 をかけた時と 2.5 をかけた時）
 */
export const varyCompare: Vary = (args, context) => {
  const [a, b] = args;
  const aText = textOf(a);
  const bText = textOf(b);
  if (aText === null || bText === null) return args;
  const nextA = varyDigits(aText, context.random(`a:${aText}`));
  const random = context.random(`b:${bText}`);
  if (Number(bText) < 1) return [nextA, `0.${random.int(1, 9)}`];
  const tenths = random.pick(range(11, 39).filter((value) => value % 10 !== 0));
  return [nextA, fromScaled(tenths, 1)];
};

/**
 * decimal.multiply(a, b)。a・b とも、けた数・小数点の位置・0 の桁は変えない。
 * 同じ a の行は同じ a、0 でない桁の並びが同じ b の行は同じ桁にする（12×4.3 と 12×0.43）
 */
export const varyMultiply: Vary = (args, context) => {
  const [a, b] = args;
  const aText = textOf(a);
  const bText = textOf(b);
  if (aText === null || bText === null) return args;
  return [varyDigits(aText, context.random(`a:${aText}`)), varyDigits(bText, context.random(`b:${bText.replace(/[0.]/g, "")}`))];
};

/**
 * decimal.divide(a, b)。わり切れる組を、b と商から作る（a = b × 商）。
 * b と商は、けた数・0 の桁を変えずに入れ替え、a の小数点より下のけた数が元より増えない組だけ使う
 */
export const varyDecimalDivide: Vary = (args, context) => {
  const [a, b] = args;
  const aText = textOf(a);
  const bText = textOf(b);
  if (aText === null || bText === null) return args;
  const quotient = fromScaled(Math.round((scaleOf(aText, 2) * 100) / scaleOf(bText, 2)), 2);
  const random = context.random(`divide:${aText}/${bText}`);
  for (let tries = 0; tries < TRIES * 2; tries += 1) {
    const nextB = varyDigits(bText, random);
    const nextQuotient = varyDigits(quotient, random);
    const nextA = fromScaled(scaleOf(nextB, 2) * scaleOf(nextQuotient, 2), 4);
    if (nextQuotient !== "1" && placesOf(nextA) <= placesOf(aText)) return [nextA, nextB];
  }
  return args;
};

/** decimal.divideRemainder(a, b)。商（整数部分）のけた数と、あまりが出ることは変えない */
export const varyDivideRemainder: Vary = (args, context) => {
  const [a, b] = args;
  const aText = textOf(a);
  const bText = textOf(b);
  if (aText === null || bText === null) return args;
  const digits = String(Math.floor(scaleOf(aText, 1) / scaleOf(bText, 1))).length;
  const random = context.random(`divideRemainder:${aText}/${bText}`);
  for (let tries = 0; tries < TRIES; tries += 1) {
    const [nextA, nextB] = [varyDigits(aText, random), varyDigits(bText, random)];
    const [intA, intB] = [scaleOf(nextA, 1), scaleOf(nextB, 1)];
    if (intA % intB !== 0 && String(Math.floor(intA / intB)).length === digits) return [nextA, nextB];
  }
  return args;
};

/** decimal.distributive(a, b, c)。a のけた数と、a×c が整数になるかは変えない。b は 1〜4（元が大きければそこまで）、c は 0.1〜0.9 */
export const varyDistributive: Vary = (args, context) => {
  const [a, b, c] = args;
  if (!isInt(a) || !isInt(b) || typeof c !== "string") return args;
  const random = context.random(`distributive:${a},${b},${c}`);
  const isWhole = (value: number, tenths: number): boolean => (value * tenths) % 10 === 0;
  const want = isWhole(a, Number(c.slice(2)));
  for (let tries = 0; tries < TRIES; tries += 1) {
    const nextA = random.int(a < 10 ? 1 : 10, a < 10 ? 9 : 99);
    const tenths = random.int(1, 9);
    if (isWhole(nextA, tenths) === want) return [nextA, random.int(1, Math.max(4, b)), `0.${tenths}`];
  }
  return args;
};

/* ---------- □と△の式 ---------- */

/** 式の a・b。式の形（add・mul・mulAdd）は変えない。a は 2〜（元の a + 2、最低 8、9 まで）、mulAdd の b は 1〜（元の b + 1、最低 5、9 まで） */
function varyRule(form: Arg | undefined, a: Arg | undefined, b: Arg | undefined, random: Random): [Arg, number, number] | null {
  if (typeof form !== "string" || !isInt(a) || !isInt(b)) return null;
  const nextA = random.int(2, Math.min(9, Math.max(8, a + 2)));
  return [form, nextA, form === "mulAdd" ? random.int(1, Math.min(9, Math.max(5, b + 1))) : 0];
}

/** expression.pickRule(form, a, b) */
export const varyPickRule: Vary = (args, context) => {
  const rule = varyRule(args[0], args[1], args[2], context.random(`pickRule:${args.join(",")}`));
  return rule ?? args;
};

/** expression.tableBlank(form, a, b, x)。空らんの △ は 2〜（元の x + 2、最低 7、10 まで） */
export const varyTableBlank: Vary = (args, context) => {
  const random = context.random(`tableBlank:${args.join(",")}`);
  const rule = varyRule(args[0], args[1], args[2], random);
  const x = args[3];
  if (!rule || !isInt(x)) return args;
  return [...rule, random.int(2, Math.min(10, Math.max(7, x + 2)))];
};

/** expression.evaluate(form, a, b, x)。x が 0.5 きざみの小数なら小数（0.5〜5.5）、整数なら整数（2〜10）のまま */
export const varyEvaluate: Vary = (args, context) => {
  const random = context.random(`evaluate:${args.join(",")}`);
  const rule = varyRule(args[0], args[1], args[2], random);
  const x = textOf(args[3]);
  if (!rule || x === null) return args;
  return [...rule, x.includes(".") ? `${random.int(0, 5)}.5` : String(random.int(2, 10))];
};
