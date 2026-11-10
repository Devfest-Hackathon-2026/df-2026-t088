// 小数の章の問題の関数（7つ）。小数は文字で持ち、計算は 10 の累乗を分母にした分数と整数で行う（浮動小数は使わない）。
// 範囲の正本は docs/design/problems/08_database/README.md の TBL-001。check は範囲を、verify は答えと topic の合い方・ヒントに答えが入っていないかを見る
import { compareFractions } from "../fraction";
import type { Fraction } from "../fraction";
import type { DecimalText, NumberAnswer, NumberProblem } from "../number-problem";
import { decimalPlaces, formatDecimal, isCanonicalDecimal, parseDecimal } from "./decimal-text";
import { defineNumberMaker, fail, leakReason, parseCount, parseWhole, succeed } from "./number-common";
import type { Parsed } from "./number-common";
import type { ProblemMaker } from "./types";

/* ---------- 小数の文字を読む ---------- */

/** 正規化した小数の文字は必ず読める。読めなければ RangeError */
export function fractionOf(text: DecimalText): Fraction {
  const value = parseDecimal(text);
  if (!value) throw new RangeError(`小数の文字ではありません: ${text}`);
  return value;
}

interface TextRule {
  /** 整数の数（5 など）も受けて文字にそろえる */
  allowNumber: boolean;
  min: DecimalText;
  max: DecimalText;
  minPlaces?: number;
  maxPlaces: number;
}

function parseText(arg: unknown, label: string, allowNumber: boolean): Parsed<DecimalText> {
  if (allowNumber && typeof arg === "number") {
    return Number.isSafeInteger(arg) && arg >= 0 ? succeed(String(arg)) : fail(`${label}は 0 以上の整数か、小数の文字にしてください`);
  }
  if (typeof arg === "string" && isCanonicalDecimal(arg)) return succeed(arg);
  return fail(`${label}は小数の文字にしてください（"0.5"、"3"。余分な 0 は付けません）`);
}

/** 小数の文字で、けた数と大きさの範囲に入っているか。外れたら理由 */
function parseBounded(arg: unknown, label: string, rule: TextRule): Parsed<DecimalText> {
  const parsed = parseText(arg, label, rule.allowNumber);
  if (!parsed.ok) return parsed;
  const text = parsed.value;
  const places = decimalPlaces(text);
  if (places > rule.maxPlaces) return fail(`${label}は小数第${rule.maxPlaces}位までにしてください（${text}）`);
  if (places < (rule.minPlaces ?? 0)) return fail(`${label}は小数点より下がある小数にしてください（${text}）`);
  const value = fractionOf(text);
  if (compareFractions(value, fractionOf(rule.min)) < 0 || compareFractions(value, fractionOf(rule.max)) > 0) {
    return fail(`${label}は ${rule.min}〜${rule.max} にしてください（${text}）`);
  }
  return succeed(text);
}

/** 整数の部分と小数部分を合わせた整数（"1.25" → 125）。小数点より下を places けたにそろえる */
function scaled(text: DecimalText, places: number): number {
  const { num, den } = fractionOf(text);
  return num * (10 ** places / den);
}

const decimalOf = (num: number, places: number): DecimalText => {
  const text = formatDecimal({ num, den: 10 ** places });
  if (text === null) throw new RangeError("小数で書けません");
  return text;
};

const KANJI_PLACES = ["", "一", "二", "三", "四"];

const decimalAnswer = (answer: NumberAnswer): DecimalText | null => (answer.type === "decimal" ? answer.value : null);

/* ---------- decimal.shift ---------- */

type Power = 10 | 100 | 1000;
interface ShiftSpec { x: DecimalText; up: boolean; power: Power }

const isPower = (value: unknown): value is Power => value === 10 || value === 100 || value === 1000;
const powerPlaces = (power: Power): number => (power === 10 ? 1 : power === 100 ? 2 : 3);

function shiftValue(x: DecimalText, up: boolean, power: Power): Fraction {
  const { num, den } = fractionOf(x);
  return up ? { num: num * power, den } : { num, den: den * power };
}

function parseShift(args: unknown[]): Parsed<ShiftSpec> {
  const count = parseCount(args, 2);
  if (count) return fail(count);
  const x = parseBounded(args[0], "x", { allowNumber: true, min: "0.01", max: "999.99", maxPlaces: 2 });
  if (!x.ok) return x;
  const factor = args[1];
  let spec: ShiftSpec | null = null;
  if (isPower(factor)) spec = { x: x.value, up: true, power: factor };
  else if (typeof factor === "object" && factor !== null && "num" in factor && "den" in factor && factor.num === 1 && isPower(factor.den)) {
    spec = { x: x.value, up: false, power: factor.den };
  }
  if (!spec) return fail("factor は 10・100・1000、または 1/10・1/100・1/1000（{num:1, den:10 など}）にしてください");
  const answer = formatDecimal(shiftValue(spec.x, spec.up, spec.power));
  if (answer === null || decimalPlaces(answer) > 4) return fail("答えは小数第4位までにしてください");
  return succeed(spec);
}

function shiftHints({ x, up, power }: ShiftSpec): string[] {
  const direction = up ? "[右|みぎ]" : "[左|ひだり]";
  return [
    `${x} の[小数点|しょうすうてん]を、${direction}へうつして[考|かんが]えましょう`,
    `${direction}へ${KANJI_PLACES[powerPlaces(power)]}けた、うつします`,
    "[位|くらい]が[足|た]りない[所|ところ]は、0 を[書|か]いてうめましょう",
  ];
}

function makeShift(spec: ShiftSpec): NumberProblem {
  const answer = formatDecimal(shiftValue(spec.x, spec.up, spec.power));
  if (answer === null) throw new RangeError("小数で書けません");
  return {
    kind: "number",
    pieces: [],
    hints: shiftHints(spec),
    topic: { t: "shift", x: spec.x, direction: spec.up ? "up" : "down", power: spec.power, places: powerPlaces(spec.power), answer },
    answer: { type: "decimal", value: answer },
  };
}

function verifyShift({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "shift") return "shift の問題ではありません";
  if (!isCanonicalDecimal(topic.x)) return "x が小数の文字ではありません";
  if (topic.places !== powerPlaces(topic.power)) return "places が power と合いません";
  const expected = formatDecimal(shiftValue(topic.x, topic.direction === "up", topic.power));
  if (expected === null || topic.answer !== expected) return `答えは ${expected} のはずですが、topic の answer は ${topic.answer} です`;
  if (decimalAnswer(answer) !== expected) return `答えは ${expected} のはずです`;
  return leakReason(hints, [expected]);
}

export const DECIMAL_SHIFT = defineNumberMaker<ShiftSpec>({
  name: "decimal.shift",
  parse: parseShift,
  toArgs: ({ x, up, power }) => [x, up ? power : { num: 1, den: power }],
  make: makeShift,
  verify: verifyShift,
});

/* ---------- decimal.compareProduct / decimal.compareQuotient ---------- */

interface CompareSpec { a: DecimalText; b: DecimalText }

const COMPARE_A: TextRule = { allowNumber: true, min: "0.1", max: "100", maxPlaces: 1 };
const COMPARE_B: TextRule = { allowNumber: false, min: "0.1", max: "9.9", maxPlaces: 1 };

function parseCompare(args: unknown[]): Parsed<CompareSpec> {
  const count = parseCount(args, 2);
  if (count) return fail(count);
  const a = parseBounded(args[0], "a", COMPARE_A);
  const b = parseBounded(args[1], "b", COMPARE_B);
  if (!a.ok) return a;
  if (!b.ok) return b;
  if (b.value === "1") return fail("b は 1 以外にしてください");
  return succeed({ a: a.value, b: b.value });
}

/** b が 1 より大きいか。積は大きい方向、商は小さい方向に動く */
const factorIsOver = (b: DecimalText): boolean => compareFractions(fractionOf(b), { num: 1, den: 1 }) > 0;

function compareAnswer(bigger: boolean): NumberAnswer {
  return { type: "choice", options: ["above", "below"], correct: bigger ? "above" : "below" };
}

function compareHints(spec: CompareSpec, product: boolean): string[] {
  const { a, b } = spec;
  const tail = product
    ? "1 より[大|おお]きい[数|かず]をかけると[積|せき]は[大|おお]きくなり、1 より[小|ちい]さい[数|かず]をかけると[積|せき]は[小|ちい]さくなります"
    : "1 より[小|ちい]さい[数|かず]でわると[商|しょう]は[大|おお]きくなり、1 より[大|おお]きい[数|かず]でわると[商|しょう]は[小|ちい]さくなります";
  return [product ? `${a}×1 は ${a} です` : `${a}÷1 は ${a} です`, `${b} は 1 より[大|おお]きいですか、[小|ちい]さいですか`, tail];
}

function verifyCompare({ topic, answer }: NumberProblem, product: boolean): string | null {
  const t = product ? "compareProduct" : "compareQuotient";
  if (topic.t !== t) return `${t} の問題ではありません`;
  if (!isCanonicalDecimal(topic.a) || !isCanonicalDecimal(topic.b)) return "a と b が小数の文字ではありません";
  if (topic.b === "1") return "b は 1 以外にしてください";
  const bigger = product ? factorIsOver(topic.b) : !factorIsOver(topic.b);
  if (topic.bigger !== bigger) return `bigger は ${bigger} のはずです`;
  if (answer.type !== "choice" || answer.correct !== (bigger ? "above" : "below") || answer.options.join() !== "above,below") {
    return `答えは ${bigger ? "above" : "below"} の選択肢のはずです`;
  }
  return null;
}

export const DECIMAL_COMPARE_PRODUCT = defineNumberMaker<CompareSpec>({
  name: "decimal.compareProduct",
  parse: parseCompare,
  toArgs: ({ a, b }) => [a, b],
  make: (spec) => {
    const bigger = factorIsOver(spec.b);
    return { kind: "number", pieces: [], hints: compareHints(spec, true), topic: { t: "compareProduct", a: spec.a, b: spec.b, bigger }, answer: compareAnswer(bigger) };
  },
  verify: (problem) => verifyCompare(problem, true),
});

export const DECIMAL_COMPARE_QUOTIENT = defineNumberMaker<CompareSpec>({
  name: "decimal.compareQuotient",
  parse: parseCompare,
  toArgs: ({ a, b }) => [a, b],
  make: (spec) => {
    const bigger = !factorIsOver(spec.b);
    return { kind: "number", pieces: [], hints: compareHints(spec, false), topic: { t: "compareQuotient", a: spec.a, b: spec.b, bigger }, answer: compareAnswer(bigger) };
  },
  verify: (problem) => verifyCompare(problem, false),
});

/* ---------- decimal.multiply ---------- */

const MULTIPLY_A: TextRule = { allowNumber: true, min: "0.01", max: "99.99", maxPlaces: 2 };
const MULTIPLY_B: TextRule = { allowNumber: false, min: "0.01", max: "99.99", minPlaces: 1, maxPlaces: 2 };

type MultiplySpec = CompareSpec;

function parseMultiply(args: unknown[]): Parsed<MultiplySpec> {
  const count = parseCount(args, 2);
  if (count) return fail(count);
  const a = parseBounded(args[0], "a", MULTIPLY_A);
  const b = parseBounded(args[1], "b", MULTIPLY_B);
  if (!a.ok) return a;
  if (!b.ok) return b;
  return succeed({ a: a.value, b: b.value });
}

/** 小数点を取った整数どうしの積と、小数点より下のけた数の和から答えを作る */
function multiplyParts({ a, b }: MultiplySpec): { intA: number; intB: number; intProduct: number; places: number; answer: DecimalText } {
  const placesA = decimalPlaces(a);
  const placesB = decimalPlaces(b);
  const intA = scaled(a, placesA);
  const intB = scaled(b, placesB);
  const intProduct = intA * intB;
  const places = placesA + placesB;
  return { intA, intB, intProduct, places, answer: decimalOf(intProduct, places) };
}

function makeMultiply(spec: MultiplySpec): NumberProblem {
  const { intA, intB, intProduct, places, answer } = multiplyParts(spec);
  return {
    kind: "number",
    pieces: [],
    hints: [
      "[小数点|しょうすうてん]が[無|な]いものとして、[整数|せいすう]どうしのかけ[算|ざん]にします",
      `${intA}×${intB} を[計算|けいさん]しましょう`,
      "[答|こた]えの[小数点|しょうすうてん]は、かけられる[数|かず]とかける[数|かず]の、[小数点|しょうすうてん]より[下|した]のけた[数|すう]をたした[分|ぶん]だけ、[左|ひだり]へうつします",
    ],
    topic: { t: "multiply", a: spec.a, b: spec.b, intA, intB, intProduct, places, answer },
    answer: { type: "decimal", value: answer },
  };
}

function verifyMultiply({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "multiply") return "multiply の問題ではありません";
  if (!isCanonicalDecimal(topic.a) || !isCanonicalDecimal(topic.b)) return "a と b が小数の文字ではありません";
  const expected = multiplyParts({ a: topic.a, b: topic.b });
  if (topic.intA !== expected.intA || topic.intB !== expected.intB) return "intA か intB が、a と b の小数点を取った整数と合いません";
  if (topic.intProduct !== expected.intProduct) return `intProduct は ${expected.intProduct} のはずです`;
  if (topic.places !== expected.places) return `places は ${expected.places} のはずです`;
  if (topic.answer !== expected.answer || decimalAnswer(answer) !== expected.answer) return `答えは ${expected.answer} のはずです`;
  return leakReason(hints, [expected.answer, String(expected.intProduct)]);
}

export const DECIMAL_MULTIPLY = defineNumberMaker<MultiplySpec>({
  name: "decimal.multiply",
  parse: parseMultiply,
  toArgs: ({ a, b }) => [a, b],
  make: makeMultiply,
  verify: verifyMultiply,
});

/* ---------- decimal.divide ---------- */

const DIVIDE_A: TextRule = MULTIPLY_A;
const DIVIDE_B: TextRule = MULTIPLY_B;

type Factor = 10 | 100;

/**
 * factor は、わられる数もわる数も整数になる 10 の累乗（小数点より下のけた数の多いほうに合わせる）。
 * 0.1÷0.04 は ×100 で 10÷4、1.25÷0.4 は ×100 で 125÷40（×10 だと 12.5÷4 になり、わられる数が整数にならない）
 */
function divideParts({ a, b }: CompareSpec): { factor: Factor; intA: number; intB: number; answer: DecimalText | null } {
  const factor: Factor = Math.max(decimalPlaces(a), decimalPlaces(b)) >= 2 ? 100 : 10;
  const places = factor === 10 ? 1 : 2;
  const intA = scaled(a, places);
  const intB = scaled(b, places);
  return { factor, intA, intB, answer: formatDecimal({ num: intA, den: intB }) };
}

function parseDivide(args: unknown[]): Parsed<CompareSpec> {
  const count = parseCount(args, 2);
  if (count) return fail(count);
  const a = parseBounded(args[0], "a", DIVIDE_A);
  const b = parseBounded(args[1], "b", DIVIDE_B);
  if (!a.ok) return a;
  if (!b.ok) return b;
  const { answer } = divideParts({ a: a.value, b: b.value });
  if (answer === null) return fail("わり切れる組にしてください");
  if (decimalPlaces(answer) > 2) return fail("商は小数第2位までにしてください");
  return succeed({ a: a.value, b: b.value });
}

function makeDivide(spec: CompareSpec): NumberProblem {
  const { factor, intA, intB, answer } = divideParts(spec);
  if (answer === null) throw new RangeError("わり切れません");
  return {
    kind: "number",
    pieces: [],
    hints: [
      `わる[数|かず]の ${spec.b} を[整数|せいすう]にするには、[小数点|しょうすうてん]を[右|みぎ]へ[何|なん]けたうつせばよいでしょうか`,
      "わられる[数|かず]の[小数点|しょうすうてん]も、[同|おな]じけた[数|すう]だけ[右|みぎ]へうつします",
      "[整数|せいすう]どうしのわり[算|ざん]にして、[計算|けいさん]しましょう",
    ],
    topic: { t: "divide", a: spec.a, b: spec.b, factor, intA, intB, answer },
    answer: { type: "decimal", value: answer },
  };
}

function verifyDivide({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "divide") return "divide の問題ではありません";
  if (!isCanonicalDecimal(topic.a) || !isCanonicalDecimal(topic.b)) return "a と b が小数の文字ではありません";
  const expected = divideParts({ a: topic.a, b: topic.b });
  if (expected.answer === null) return "わり切れない組です";
  if (topic.factor !== expected.factor) return `factor は ${expected.factor} のはずです`;
  if (topic.intA !== expected.intA || topic.intB !== expected.intB) return "intA か intB が、a と b に factor をかけた整数と合いません";
  if (topic.answer !== expected.answer || decimalAnswer(answer) !== expected.answer) return `答えは ${expected.answer} のはずです`;
  return leakReason(hints, [expected.answer]);
}

export const DECIMAL_DIVIDE = defineNumberMaker<CompareSpec>({
  name: "decimal.divide",
  parse: parseDivide,
  toArgs: ({ a, b }) => [a, b],
  make: makeDivide,
  verify: verifyDivide,
});

/* ---------- decimal.divideRemainder ---------- */

const REMAINDER_A: TextRule = { allowNumber: true, min: "0.1", max: "99.9", maxPlaces: 1 };
const REMAINDER_B: TextRule = { allowNumber: false, min: "0.1", max: "99.9", minPlaces: 1, maxPlaces: 1 };

/** 10 倍した整数どうしで、商とあまりを求める（あまりは 1/10 の位） */
function remainderParts({ a, b }: CompareSpec): { quotient: number; remainder: number } {
  const intA = scaled(a, 1);
  const intB = scaled(b, 1);
  const quotient = Math.floor(intA / intB);
  return { quotient, remainder: intA - intB * quotient };
}

function parseDivideRemainder(args: unknown[]): Parsed<CompareSpec> {
  const count = parseCount(args, 2);
  if (count) return fail(count);
  const a = parseBounded(args[0], "a", REMAINDER_A);
  const b = parseBounded(args[1], "b", REMAINDER_B);
  if (!a.ok) return a;
  if (!b.ok) return b;
  const { quotient, remainder } = remainderParts({ a: a.value, b: b.value });
  if (quotient < 1) return fail("商が 1 以上になるように、a は b 以上にしてください");
  if (remainder === 0) return fail("あまりが出る組にしてください");
  return succeed({ a: a.value, b: b.value });
}

function makeDivideRemainder(spec: CompareSpec): NumberProblem {
  const { quotient, remainder } = remainderParts(spec);
  const remainderText = decimalOf(remainder, 1);
  return {
    kind: "number",
    pieces: [],
    hints: [
      `[商|しょう]は[整数|せいすう]で[求|もと]めます。${spec.a} の[中|なか]に、${spec.b} がいくつ[入|はい]るか[考|かんが]えましょう`,
      `${spec.b} を[何|なん]こ[集|あつ]めると、${spec.a} をこえないか[調|しら]べましょう`,
      "あまりは、わられる[数|かず]から、わる[数|かず]×[商|しょう]をひいた[数|かず]です。[小数点|しょうすうてん]は、わられる[数|かず]にそろえてうちます",
    ],
    topic: { t: "divideRemainder", a: spec.a, b: spec.b, quotient, remainder: remainderText },
    answer: { type: "remainder", quotient, remainder: remainderText },
  };
}

function verifyDivideRemainder({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "divideRemainder") return "divideRemainder の問題ではありません";
  if (!isCanonicalDecimal(topic.a) || !isCanonicalDecimal(topic.b)) return "a と b が小数の文字ではありません";
  const { quotient, remainder } = remainderParts({ a: topic.a, b: topic.b });
  const remainderText = decimalOf(remainder, 1);
  if (scaled(topic.b, 1) * quotient + remainder !== scaled(topic.a, 1)) return "わられる数＝わる数×商＋あまり になっていません";
  if (remainder === 0 || remainder >= scaled(topic.b, 1)) return "あまりは 0 より大きく、わる数より小さくなります";
  if (topic.quotient !== quotient || topic.remainder !== remainderText) return `商は ${quotient}、あまりは ${remainderText} のはずです`;
  if (answer.type !== "remainder" || answer.quotient !== quotient || answer.remainder !== remainderText) return `答えは商 ${quotient}、あまり ${remainderText} のはずです`;
  return leakReason(hints, [String(quotient), remainderText]);
}

export const DECIMAL_DIVIDE_REMAINDER = defineNumberMaker<CompareSpec>({
  name: "decimal.divideRemainder",
  parse: parseDivideRemainder,
  toArgs: ({ a, b }) => [a, b],
  make: makeDivideRemainder,
  verify: verifyDivideRemainder,
});

/* ---------- decimal.distributive ---------- */

interface DistributiveSpec { a: number; b: number; c: DecimalText }

function parseDistributive(args: unknown[]): Parsed<DistributiveSpec> {
  const count = parseCount(args, 3);
  if (count) return fail(count);
  const a = parseWhole(args[0], "a", 1, 99);
  const b = parseWhole(args[1], "b", 1, 9);
  const c = parseBounded(args[2], "c", { allowNumber: false, min: "0.1", max: "0.9", minPlaces: 1, maxPlaces: 1 });
  if (!a.ok) return a;
  if (!b.ok) return b;
  if (!c.ok) return c;
  return succeed({ a: a.value, b: b.value, c: c.value });
}

/** b + c（b は整数、c は 1/10 の位） */
const sumText = (b: number, c: DecimalText): DecimalText => decimalOf(b * 10 + fractionOf(c).num, 1);

function makeDistributive({ a, b, c }: DistributiveSpec): NumberProblem {
  const sum = sumText(b, c);
  return {
    kind: "number",
    pieces: [],
    hints: [
      `${sum} は ${b} と □ をたした[数|かず]です`,
      `${a}×${sum} は、${a}×${b} と ${a}×□ をたした[数|かず]になります`,
      `${sum} から ${b} をひいた[数|かず]が □ です`,
    ],
    topic: { t: "distributive", a, b, c },
    answer: { type: "decimal", value: c },
  };
}

function verifyDistributive({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "distributive") return "distributive の問題ではありません";
  const { a, b, c } = topic;
  if (!Number.isSafeInteger(a) || a < 1 || a > 99 || !Number.isSafeInteger(b) || b < 1 || b > 9) return "a と b の範囲が合いません";
  if (!isCanonicalDecimal(c) || decimalPlaces(c) !== 1 || fractionOf(c).num > 9 || fractionOf(c).num < 1) return "c は 0.1〜0.9 にしてください";
  // a×(b+c) = a×b + a×□ を、10 倍した整数で確かめる（□ は c）
  if (a * (b * 10 + fractionOf(c).num) !== a * b * 10 + a * fractionOf(c).num) return "a×(b+c) と a×b + a×□ が合いません";
  if (decimalAnswer(answer) !== c) return `答えは ${c} のはずです`;
  return leakReason(hints, [c]);
}

export const DECIMAL_DISTRIBUTIVE = defineNumberMaker<DistributiveSpec>({
  name: "decimal.distributive",
  parse: parseDistributive,
  toArgs: ({ a, b, c }) => [a, b, c],
  make: makeDistributive,
  verify: verifyDistributive,
});

/** 小数の章の7つ。makers/index.ts への登録は別 */
export const DECIMAL_MAKERS: readonly ProblemMaker[] = [
  DECIMAL_SHIFT, DECIMAL_COMPARE_PRODUCT, DECIMAL_MULTIPLY, DECIMAL_COMPARE_QUOTIENT, DECIMAL_DIVIDE, DECIMAL_DIVIDE_REMAINDER, DECIMAL_DISTRIBUTIVE,
];
