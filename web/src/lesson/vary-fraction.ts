// 分数の章と、分数と小数の問題（number.*）の数の入れ替え（D-254）。何を変えて何を変えないかは各関数の上に書く。
// ここで作る args は候補で、check・build・verify に通してから使う（plan.ts）。範囲は makers/ が決める
import type { Fraction } from "./fraction";
import type { Arg } from "./makers/types";
import { gcdOf, lcmOf, varyDigits } from "./vary-random";
import type { Random, Vary } from "./vary-random";

const isFraction = (arg: Arg | undefined): arg is Fraction => typeof arg === "object";
const isInt = (arg: Arg | undefined): arg is number => typeof arg === "number";
const sign = (value: number): number => Math.sign(value);
const TRIES = 200;

/** 分数どうしの大小。left が大きければ正 */
const compareValue = (a: Fraction, b: Fraction): number => a.num * b.den - b.num * a.den;

/** 分母の組の形。同じ・片方がもう片方の約数・それ以外 */
const denShape = (a: Fraction, b: Fraction): string => (a.den === b.den ? "same" : a.den % b.den === 0 || b.den % a.den === 0 ? "divides" : "other");

/** 分母の上限。元の分母より 2 だけ広げ、5〜10 に収める（タイルの分母は 24 まで） */
const denLimit = (...fractions: Fraction[]): number => Math.min(10, Math.max(5, ...fractions.map(({ den }) => den + 2)));

function randomFraction(random: Random, maxDen: number, improper: boolean): Fraction {
  const den = random.int(2, maxDen);
  return { num: improper ? random.int(den + 1, 2 * den - 1) : random.int(1, den - 1), den };
}

/** 元の組と同じ形（分母の組・左が仮分数か）で、accept を満たす組を探す。見つからなければ null */
function samplePair(random: Random, origin: [Fraction, Fraction], accept: (left: Fraction, right: Fraction) => boolean): [Fraction, Fraction] | null {
  const [left, right] = origin;
  const maxDen = denLimit(left, right);
  for (let count = 0; count < TRIES; count += 1) {
    const next: [Fraction, Fraction] = [randomFraction(random, maxDen, left.num > left.den), randomFraction(random, maxDen, right.num > right.den)];
    if (denShape(...next) !== denShape(left, right) || lcmOf(next[0].den, next[1].den) > 24) continue;
    if (accept(...next)) return next;
  }
  return null;
}

/** 計算した答え。ひき算は left - right */
const resultOf = (left: Fraction, op: Arg | undefined, right: Fraction): Fraction => ({
  num: left.num * right.den + (op === "-" ? -1 : 1) * right.num * left.den,
  den: left.den * right.den,
});

/**
 * fraction.divide(a, b)。わり切れる・1 より小さい（真分数）・わり切れない仮分数の別は変えない。
 * 分母 b は 2〜（元の b + 2、最低 5）、a は分母から作る
 */
export const varyDivide: Vary = (args, context) => {
  const [dividend, divisor] = args;
  if (!isInt(dividend) || !isInt(divisor)) return args;
  const random = context.random(`divide:${dividend}/${divisor}`);
  const den = random.int(2, Math.min(9, Math.max(5, divisor + 2)));
  if (dividend % divisor === 0) return [den * random.int(2, 4), den];
  if (dividend < divisor) return [random.int(1, den - 1), den];
  const choices = Array.from({ length: Math.floor(2.5 * den) - den }, (_, index) => den + 1 + index).filter((value) => value % den !== 0);
  return [random.pick(choices), den];
};

/**
 * fraction.equivalent(num, den, target)。分母を大きくする向きか小さくする向きかは変えない。
 * 倍率は 2〜（元の倍率、最低 3）、元の分数は真分数
 */
export const varyEquivalent: Vary = (args, context) => {
  const [num, den, target] = args;
  if (!isInt(num) || !isInt(den) || !isInt(target)) return args;
  const random = context.random(`equivalent:${num}/${den}->${target}`);
  const up = target > den;
  const ratio = up ? target / den : den / target;
  const factor = random.int(2, Math.max(3, ratio));
  const small = random.int(2, Math.min(6, Math.floor(20 / factor)));
  const numerator = random.int(1, small - 1);
  return up ? [numerator, small, small * factor] : [numerator * factor, small * factor, small];
};

/**
 * fraction.reduce(value, wrongUnit)。元の分数は「最も簡単な分数 × 倍率（2〜4）」の形のまま。
 * うまらないタイルは、約分した形の分母で割り切れない分母（2〜8）から選ぶ
 */
export const varyReduce: Vary = (args, context) => {
  const [value] = args;
  if (!isFraction(value)) return args;
  const random = context.random(`reduce:${value.num}/${value.den}`);
  const limit = Math.min(16, Math.max(8, value.den + 2));
  for (let count = 0; count < TRIES; count += 1) {
    const base = random.int(2, 5);
    const factor = random.int(2, 4);
    const num = random.int(1, base - 1);
    const wrong = random.int(2, 8);
    if (gcdOf(num, base) !== 1 || base * factor > limit || wrong % base === 0 || wrong === base * factor) continue;
    return [{ num: num * factor, den: base * factor }, { num: 1, den: wrong }];
  }
  return args;
};

/** fraction.common(left, right)。分母の組の形（片方がもう片方の約数か）は変えない。分子は 1 以上で分母より小さい */
export const varyCommon: Vary = (args, context) => {
  const [left, right] = args;
  if (!isFraction(left) || !isFraction(right)) return args;
  const pair = samplePair(context.random(`common:${left.num}/${left.den},${right.num}/${right.den}`), [left, right], () => true);
  return pair ?? args;
};

/**
 * fraction.compare(left, right)。分母の組の形と、どちらが大きいか（同じ大きさか）は変えない。
 * 同じ大きさの組は「分子と分母を同じ数倍した分数」にする
 */
export const varyCompare: Vary = (args, context) => {
  const [left, right] = args;
  if (!isFraction(left) || !isFraction(right)) return args;
  const random = context.random(`compare:${left.num}/${left.den},${right.num}/${right.den}`);
  const order = sign(compareValue(left, right));
  if (order === 0) {
    const small = random.int(2, 5);
    const factor = random.int(2, 3);
    const base = { num: random.int(1, small - 1), den: small };
    const scaled = { num: base.num * factor, den: small * factor };
    return left.den < right.den ? [base, scaled] : [scaled, base];
  }
  const pair = samplePair(random, [left, right], (a, b) => sign(compareValue(a, b)) === order);
  return pair ?? args;
};

/**
 * fraction.calculate / fraction.plain。たし算かひき算か・帯分数で答えるか・分母の組の形・左が仮分数か・
 * 答えが 1 より大きいか小さいかは変えない。ひき算は left > right
 */
export const varyCalculate: Vary = (args, context) => {
  const [left, op, right] = args;
  if (!isFraction(left) || !isFraction(right)) return args;
  const one = { num: 1, den: 1 };
  const side = sign(compareValue(resultOf(left, op, right), one));
  const random = context.random(`calculate:${left.num}/${left.den}${String(op)}${right.num}/${right.den}`);
  const pair = samplePair(random, [left, right], (a, b) => {
    const answer = resultOf(a, op, b);
    return answer.num > 0 && sign(compareValue(answer, one)) === side;
  });
  return pair ? [pair[0], op as Arg, pair[1], ...args.slice(3)] : args;
};

/** fraction.estimate(left, op, right, threshold)。しきい値と、答えがしきい値より大きいか小さいかは変えない */
export const varyEstimate: Vary = (args, context) => {
  const [left, op, right, threshold] = args;
  if (!isFraction(left) || !isFraction(right) || !isFraction(threshold)) return args;
  const side = sign(compareValue(resultOf(left, op, right), threshold));
  const random = context.random(`estimate:${left.num}/${left.den}${String(op)}${right.num}/${right.den}`);
  const pair = samplePair(random, [left, right], (a, b) => {
    const answer = resultOf(a, op, b);
    return answer.num > 0 && sign(compareValue(answer, threshold)) === side;
  });
  return pair ? [pair[0], op as Arg, pair[1], threshold] : args;
};

/** number.fractionToDecimal(num, den)。分母は 4・5・8・10（元の分母か 5 まで）の約分できない真分数 */
export const varyFractionToDecimal: Vary = (args, context) => {
  const [num, den] = args;
  if (!isInt(num) || !isInt(den)) return args;
  const random = context.random(`fractionToDecimal:${num}/${den}`);
  const next = random.pick([4, 5, 8, 10].filter((candidate) => candidate <= Math.max(den, 5)));
  const choices = Array.from({ length: next - 1 }, (_, index) => index + 1).filter((value) => gcdOf(value, next) === 1);
  return [random.pick(choices), next];
};

/** number.decimalToFraction(d)。小数点より下のけた数と 0 の桁は変えない */
export const varyDecimalToFraction: Vary = (args, context) => {
  const [text] = args;
  if (typeof text !== "string") return args;
  return [varyDigits(text, context.random(`decimalToFraction:${text}`))];
};

/** number.intToFraction(n, den)。整数 n は 2〜5、分母は 2〜6（元の数が大きければそこまで） */
export const varyIntToFraction: Vary = (args, context) => {
  const [n, den] = args;
  if (!isInt(n) || !isInt(den)) return args;
  const random = context.random(`intToFraction:${n},${den}`);
  return [random.int(2, Math.max(5, n)), random.int(2, Math.max(6, den))];
};

/** 約分したあとの分母が 2 と 5 だけでできているか（小数で終わるか） */
function terminates(num: number, den: number): boolean {
  let rest = den / gcdOf(num, den);
  for (const factor of [2, 5]) while (rest % factor === 0) rest /= factor;
  return rest === 1;
}

/** number.terminates(num, den)。わり切れるか・切れないかは変えない。分母は 3〜12 */
export const varyTerminates: Vary = (args, context) => {
  const [num, den] = args;
  if (!isInt(num) || !isInt(den)) return args;
  const random = context.random(`terminates:${num}/${den}`);
  const want = terminates(num, den);
  for (let count = 0; count < TRIES; count += 1) {
    const next = random.int(3, 12);
    const top = random.int(1, next - 1);
    if (terminates(top, next) === want) return [top, next];
  }
  return args;
};
