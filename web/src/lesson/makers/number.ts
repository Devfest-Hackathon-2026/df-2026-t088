// 分数の章 main-1 の数の問題の関数（4つ）。共通の道具は number-common.ts。
// 小数は文字で持ち、10 の累乗の分数にして計算する。文は作らず、文に入れる値（topic）と答えとヒントを作る
import { calculate } from "../fraction";
import type { Fraction } from "../fraction";
import type { NumberProblem } from "../number-problem";
import { decimalPlaces, formatDecimal, isCanonicalDecimal, parseDecimal } from "./decimal-text";
import { mentionsFraction } from "./format";
import {
  defineNumberMaker, fail, leakedNumberReason, leakedPhraseReason, parseCount, parseIntArg,
} from "./number-common";
import type { Parsed } from "./number-common";
import type { ProblemMaker } from "./types";

export { stripRuby } from "./number-common";

/* ---------- 分数と小数の行き来 ---------- */

const fractionText = ({ num, den }: Fraction): string => `${num}/${den}`;
const sameFraction = (a: Fraction, b: Fraction): boolean => a.num === b.num && a.den === b.den;
const lowestTerms = (value: Fraction): Fraction => calculate(value, "+", { num: 0, den: 1 });

/** 小数第3位までで割り切れる分母（TBL-001） */
const DECIMAL_DENS: readonly number[] = [2, 4, 5, 8, 10, 20];

// number.fractionToDecimal(num, den)
interface FractionToDecimalSpec { num: number; den: number }

function parseFractionToDecimal(args: unknown[]): Parsed<FractionToDecimalSpec> {
  const count = parseCount(args, 2);
  if (count) return fail(count);
  const num = parseIntArg(args[0], "num", 1, 60);
  const den = parseIntArg(args[1], "den", 2, 20);
  if (!num.ok) return num;
  if (!den.ok) return den;
  if (!DECIMAL_DENS.includes(den.value)) return fail(`den は ${DECIMAL_DENS.join("・")} のどれかにしてください（${den.value}）`);
  if (num.value > den.value * 3) return fail("分数の値は 3 以下にしてください");
  if (num.value % den.value === 0) return fail("整数にならない分数にしてください");
  return { ok: true, value: { num: num.value, den: den.value } };
}

function fractionToDecimalProblem({ num, den }: FractionToDecimalSpec): NumberProblem {
  const value = { num, den };
  const decimal = formatDecimal(value);
  if (decimal === null) throw new RangeError(`fractionToDecimal: ${num}/${den} は小数で終わりません`);
  return {
    kind: "number",
    pieces: [],
    hints: [
      "[分数|ぶんすう]は、[分子|ぶんし]を[分母|ぶんぼ]でわった[数|かず]を[表|あらわ]しています",
      `${num}÷${den} を[計算|けいさん]してみましょう`,
      "[筆算|ひっさん]で、わり[切|き]れるまでわってみましょう",
    ],
    topic: { t: "fractionToDecimal", value, decimal },
    answer: { type: "decimal", value: decimal },
  };
}

function verifyFractionToDecimal({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "fractionToDecimal") return "fractionToDecimal の問題ではありません";
  const decimal = formatDecimal(topic.value);
  if (decimal === null || decimal !== topic.decimal) return `decimal が ${fractionText(topic.value)} の値と合いません`;
  if (answer.type !== "decimal" || answer.value !== decimal) return "答えが分数の値と合いません";
  return leakedNumberReason(hints, decimal);
}

export const NUMBER_FRACTION_TO_DECIMAL = defineNumberMaker<FractionToDecimalSpec>({
  name: "number.fractionToDecimal",
  parse: parseFractionToDecimal,
  toArgs: ({ num, den }) => [num, den],
  make: fractionToDecimalProblem,
  verify: verifyFractionToDecimal,
});

// number.decimalToFraction(d)。答えは約分しない {整数, 10^k}。約分した形も正解にするのは判定の仕事
function parseDecimalToFraction(args: unknown[]): Parsed<string> {
  const count = parseCount(args, 1);
  if (count) return fail(count);
  const [arg] = args;
  if (typeof arg !== "string") return fail("d は小数の文字（\"0.13\"）にしてください");
  const value = parseDecimal(arg);
  if (value === null) return fail("d は小数の文字（\"0.13\"）にしてください");
  if (!isCanonicalDecimal(arg)) return fail("d は余分な 0 を付けない書き方にしてください");
  const places = decimalPlaces(arg);
  if (places < 1 || places > 3) return fail("d は小数第1〜3位までの小数にしてください");
  if (value.num <= 0 || value.num >= value.den * 10) return fail("d は 0 より大きく 10 より小さくしてください");
  return { ok: true, value: arg };
}

function decimalToFractionProblem(decimal: string): NumberProblem {
  const value = parseDecimal(decimal);
  if (value === null) throw new RangeError(`decimalToFraction: ${decimal} は小数ではありません`);
  const { den } = value;
  return {
    kind: "number",
    pieces: [],
    hints: [
      "[小数|しょうすう]は、10 や 100 や 1000 を[分母|ぶんぼ]にする[分数|ぶんすう]で[表|あらわ]せます",
      `[小数点|しょうすうてん]の[右|みぎ]に ${decimalPlaces(decimal)} こ[数|かず]が[並|なら]んでいるので、[分母|ぶんぼ]は ${den} です`,
      "[分子|ぶんし]は、[小数点|しょうすうてん]をとった[数|かず]になります",
    ],
    topic: { t: "decimalToFraction", decimal, unit: { num: 1, den }, count: value.num, value },
    answer: { type: "fraction", value },
  };
}

function verifyDecimalToFraction({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "decimalToFraction") return "decimalToFraction の問題ではありません";
  const value = parseDecimal(topic.decimal);
  if (value === null || !isCanonicalDecimal(topic.decimal)) return `decimal ${topic.decimal} が小数の文字ではありません`;
  if (!sameFraction(topic.value, value)) return "value が小数の値と合いません";
  if (!sameFraction(topic.unit, { num: 1, den: value.den }) || topic.count !== value.num) return "unit と count が小数の値と合いません";
  if (answer.type !== "fraction" || !sameFraction(answer.value, value)) return "答えが小数の値と合いません";
  // 約分した形（0.5 なら 1/2）も答えなので、どちらもヒントに入れない
  const leaked = [value, lowestTerms(value)].find((form) => hints.some((hint) => mentionsFraction(hint, form)));
  return leaked ? `ヒントに答えの分数 ${fractionText(leaked)} が入っています` : null;
}

export const NUMBER_DECIMAL_TO_FRACTION = defineNumberMaker<string>({
  name: "number.decimalToFraction",
  parse: parseDecimalToFraction,
  toArgs: (decimal) => [decimal],
  make: decimalToFractionProblem,
  verify: verifyDecimalToFraction,
});

// number.intToFraction(n, den)。分子だけ入れる
interface IntToFractionSpec { n: number; den: number }

function parseIntToFraction(args: unknown[]): Parsed<IntToFractionSpec> {
  const count = parseCount(args, 2);
  if (count) return fail(count);
  const n = parseIntArg(args[0], "n", 1, 9);
  const den = parseIntArg(args[1], "den", 1, 20);
  if (!n.ok) return n;
  if (!den.ok) return den;
  return { ok: true, value: { n: n.value, den: den.value } };
}

// ヒントに n や den の数をそのまま書かない。den = 1 や n = 1 のとき、答え（n × den）と同じになってしまうため
function intToFractionProblem({ n, den }: IntToFractionSpec): NumberProblem {
  const count = n * den;
  return {
    kind: "number",
    pieces: [],
    hints: [
      "[整数|せいすう]を[分数|ぶんすう]に[直|なお]すには、[分母|ぶんぼ]を[決|き]めて、[分子|ぶんし]を[考|かんが]えます",
      `1/${den} をいくつ[集|あつ]めると、[整数|せいすう]と[同|おな]じ[大|おお]きさになるでしょうか`,
      "[分母|ぶんぼ]と[同|おな]じ[数|かず]だけ[集|あつ]めると、ちょうど[整数|せいすう]の[大|おお]きさになります",
    ],
    topic: { t: "intToFraction", n, den, count },
    answer: { type: "numerator", value: count },
  };
}

function verifyIntToFraction({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "intToFraction") return "intToFraction の問題ではありません";
  const count = topic.n * topic.den;
  if (topic.count !== count) return "count が n × den と合いません";
  if (answer.type !== "numerator" || answer.value !== count) return "答えが n × den と合いません";
  return leakedNumberReason(hints, String(count));
}

export const NUMBER_INT_TO_FRACTION = defineNumberMaker<IntToFractionSpec>({
  name: "number.intToFraction",
  parse: parseIntToFraction,
  toArgs: ({ n, den }) => [n, den],
  make: intToFractionProblem,
  verify: verifyIntToFraction,
});

// number.terminates(num, den)。分母が 2 と 5 だけでできている（約分したあと）なら、わり切れる
interface TerminatesSpec { num: number; den: number }

function parseTerminates(args: unknown[]): Parsed<TerminatesSpec> {
  const count = parseCount(args, 2);
  if (count) return fail(count);
  const den = parseIntArg(args[1], "den", 2, 20);
  if (!den.ok) return den;
  const num = parseIntArg(args[0], "num", 1, den.value - 1);
  if (!num.ok) return num;
  return { ok: true, value: { num: num.value, den: den.value } };
}

const dividesOut = (value: Fraction): boolean => formatDecimal(value) !== null;

/** 整数のわり算で求めた、小数第3位までを切り捨てた商（"0.333"）。num < den */
function truncatedQuotient(num: number, den: number): string {
  const scaled = num * 1000;
  const digits = String((scaled - (scaled % den)) / den).padStart(3, "0");
  return `0.${digits}`;
}

function terminatesProblem({ num, den }: TerminatesSpec): NumberProblem {
  const value = { num, den };
  const exact = formatDecimal(value);
  return {
    kind: "number",
    pieces: [],
    hints: [
      `${num}÷${den} を[計算|けいさん]してみましょう`,
      "[筆算|ひっさん]で、わり[切|き]れるまでわってみましょう。[同|おな]じ[数|かず]がくり[返|かえ]されるときは、おしまいがありません",
      "[分母|ぶんぼ]を 10、100、1000 のどれかにそろえられるか、[考|かんが]えてみましょう",
    ],
    topic: { t: "terminates", value, decimal: exact ?? truncatedQuotient(num, den), terminates: exact !== null },
    answer: { type: "choice", options: ["yes", "no"], correct: exact !== null ? "yes" : "no" },
  };
}

function verifyTerminates({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "terminates") return "terminates の問題ではありません";
  const { value } = topic;
  const exact = formatDecimal(value);
  if (topic.terminates !== (exact !== null)) return "terminates がわり算の結果と合いません";
  if (topic.decimal !== (exact ?? truncatedQuotient(value.num, value.den))) return "decimal がわり算の結果と合いません";
  const options = answer.type === "choice" ? answer.options : [];
  if (answer.type !== "choice" || options.join(",") !== "yes,no") return "選択肢は yes と no にしてください";
  if (answer.correct !== (dividesOut(value) ? "yes" : "no")) return "正解の選択肢がわり算の結果と合いません";
  return leakedPhraseReason(hints, answer.correct === "yes" ? ["わり切れます"] : ["わり切れません"]);
}

export const NUMBER_TERMINATES = defineNumberMaker<TerminatesSpec>({
  name: "number.terminates",
  parse: parseTerminates,
  toArgs: ({ num, den }) => [num, den],
  make: terminatesProblem,
  verify: verifyTerminates,
});

export const NUMBER_MAKERS: readonly ProblemMaker[] = [
  NUMBER_FRACTION_TO_DECIMAL, NUMBER_DECIMAL_TO_FRACTION, NUMBER_INT_TO_FRACTION, NUMBER_TERMINATES,
];
