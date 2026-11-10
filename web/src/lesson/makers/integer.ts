// 整数の章の数の問題の関数（7つ）。約数・倍数は整数のわり算（%）で求める
import { listText } from "../number-problem";
import type { NumberAnswer, NumberProblem } from "../number-problem";
import {
  defineNumberMaker, fail, leakedNumberReason, leakedPhraseReason, parseCount, parseIntArg,
} from "./number-common";
import type { Parsed } from "./number-common";
import type { ProblemMaker } from "./types";

/** 公倍数の上限（答えの大きさ。分母 20 までの通分に使う最小公倍数が入る大きさ） */
const MAX_MULTIPLE = 100;

/* ---------- 数を求める ---------- */

const range = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);

const divisorsOf = (n: number): number[] => range(1, n).filter((d) => n % d === 0);

const commonDivisorsOf = (a: number, b: number): number[] => range(1, Math.min(a, b)).filter((d) => a % d === 0 && b % d === 0);

const multiplesOf = (k: number, upTo: number): number[] => range(1, Math.floor(upTo / k)).map((times) => k * times);

/** 互除法 */
function gcdOf(a: number, b: number): number {
  return b === 0 ? a : gcdOf(b, a % b);
}

const lcmOf = (a: number, b: number): number => (a / gcdOf(a, b)) * b;

const sameList = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((value, index) => value === b[index]);

/** 全部えらぶ問題の答え。札は 1〜max（R-24：36 枚まで） */
const multiAnswer = (max: number, correct: number[]): NumberAnswer => ({ type: "multi", cards: range(1, max), correct });

function verifyMulti(answer: NumberAnswer, max: number, correct: number[]): string | null {
  if (answer.type !== "multi") return "答えは全部えらぶ形にしてください";
  if (!sameList(answer.cards, range(1, max))) return `札は 1〜${max} にしてください`;
  if (!sameList(answer.correct, correct)) return "答えが式と合いません";
  return null;
}

/** 答えの並び全体（"1, 2, 3, 4, 6, 12"）がヒントに入っていないか。1つずつの数は調べない（約数のヒントに「1」は出る） */
const leakedList = (hints: string[], list: readonly number[]): string | null => leakedNumberReason(hints, listText(list));

/* ---------- 引数を読む ---------- */

interface PairSpec { a: number; b: number }

/** 2つの数。同じ数も受ける（範囲は TBL-001 のとおり） */
function parsePair(args: unknown[], min: number, max: number): Parsed<PairSpec> {
  const a = parseIntArg(args[0], "a", min, max);
  const b = parseIntArg(args[1], "b", min, max);
  if (!a.ok) return a;
  if (!b.ok) return b;
  return { ok: true, value: { a: a.value, b: b.value } };
}

/* ---------- integer.parity(n) ---------- */

function parseParity(args: unknown[]): Parsed<number> {
  const count = parseCount(args, 1);
  if (count) return fail(count);
  return parseIntArg(args[0], "n", 0, 100);
}

function parityProblem(n: number): NumberProblem {
  const even = n % 2 === 0;
  return {
    kind: "number",
    pieces: [],
    hints: [
      "[偶数|ぐうすう]は 2 でわり[切|き]れる[数|かず]、[奇数|きすう]は 2 でわると 1 あまる[数|かず]です",
      `${n} を 2 でわってみましょう`,
      "[一|いち]の[位|くらい]の[数|かず]が 0、2、4、6、8 のどれかを[見|み]ると、[分|わ]かります",
    ],
    topic: { t: "parity", n, even },
    answer: { type: "choice", options: ["even", "odd"], correct: even ? "even" : "odd" },
  };
}

function verifyParity({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "parity") return "parity の問題ではありません";
  const even = topic.n % 2 === 0;
  if (topic.even !== even) return "even が n と合いません";
  if (answer.type !== "choice" || answer.options.join(",") !== "even,odd") return "選択肢は even と odd にしてください";
  if (answer.correct !== (even ? "even" : "odd")) return "正解の選択肢が n と合いません";
  const phrases = even ? ["偶数です", "偶数になります"] : ["奇数です", "奇数になります"];
  return leakedPhraseReason(hints, phrases);
}

export const INTEGER_PARITY = defineNumberMaker<number>({
  name: "integer.parity",
  parse: parseParity,
  toArgs: (n) => [n],
  make: parityProblem,
  verify: verifyParity,
});

/* ---------- integer.divisors(n) ---------- */

function parseDivisors(args: unknown[]): Parsed<number> {
  const count = parseCount(args, 1);
  if (count) return fail(count);
  return parseIntArg(args[0], "n", 2, 36);
}

function divisorsProblem(n: number): NumberProblem {
  const list = divisorsOf(n);
  return {
    kind: "number",
    pieces: [],
    hints: [
      "[約数|やくすう]は、その[数|かず]をわり[切|き]ることができる[整数|せいすう]です",
      "1 と、その[数|かず][自身|じしん]は、いつも[約数|やくすう]です",
      `1 から ${n} まで、[順|じゅん]にわり[切|き]れるかどうか[調|しら]べてみましょう`,
    ],
    topic: { t: "divisors", n, list },
    answer: multiAnswer(n, list),
  };
}

function verifyDivisors({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "divisors") return "divisors の問題ではありません";
  const list = divisorsOf(topic.n);
  if (!sameList(topic.list, list)) return "list が約数と合いません";
  return verifyMulti(answer, topic.n, list) ?? leakedList(hints, list);
}

export const INTEGER_DIVISORS = defineNumberMaker<number>({
  name: "integer.divisors",
  parse: parseDivisors,
  toArgs: (n) => [n],
  make: divisorsProblem,
  verify: verifyDivisors,
});

/* ---------- integer.multiples(k, upTo) ---------- */

interface MultiplesSpec { k: number; upTo: number }

function parseMultiples(args: unknown[]): Parsed<MultiplesSpec> {
  const count = parseCount(args, 2);
  if (count) return fail(count);
  const k = parseIntArg(args[0], "k", 2, 12);
  const upTo = parseIntArg(args[1], "upTo", 12, 36);
  if (!k.ok) return k;
  if (!upTo.ok) return upTo;
  if (multiplesOf(k.value, upTo.value).length < 2) return fail("倍数が 2 つ以上になる数にしてください");
  return { ok: true, value: { k: k.value, upTo: upTo.value } };
}

// 0 は倍数に入れない。札も 1 から
function multiplesProblem({ k, upTo }: MultiplesSpec): NumberProblem {
  const list = multiplesOf(k, upTo);
  return {
    kind: "number",
    pieces: [],
    hints: [
      "[倍数|ばいすう]は、その[数|かず]に 1、2、3、… をかけてできる[数|かず]です",
      `${k} × 1、${k} × 2、${k} × 3 と[計算|けいさん]していきましょう`,
      `${upTo} より[大|おお]きくなったら、そこでやめましょう`,
    ],
    topic: { t: "multiples", k, upTo, list },
    answer: multiAnswer(upTo, list),
  };
}

function verifyMultiples({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "multiples") return "multiples の問題ではありません";
  const list = multiplesOf(topic.k, topic.upTo);
  if (!sameList(topic.list, list)) return "list が倍数と合いません";
  return verifyMulti(answer, topic.upTo, list) ?? leakedList(hints, list);
}

export const INTEGER_MULTIPLES = defineNumberMaker<MultiplesSpec>({
  name: "integer.multiples",
  parse: parseMultiples,
  toArgs: ({ k, upTo }) => [k, upTo],
  make: multiplesProblem,
  verify: verifyMultiples,
});

/* ---------- integer.commonDivisors(a, b) ---------- */

function parseCommonDivisors(args: unknown[]): Parsed<PairSpec> {
  const count = parseCount(args, 2);
  return count ? fail(count) : parsePair(args, 2, 36);
}

// ヒントには数を書かない。公約数が 1 だけの組（8 と 9 など）で、答えの「1」が入ってしまうため
function commonDivisorsProblem({ a, b }: PairSpec): NumberProblem {
  const list = commonDivisorsOf(a, b);
  return {
    kind: "number",
    pieces: [],
    hints: [
      "まず、それぞれの[約数|やくすう]を[全部|ぜんぶ][書|か]き[出|だ]しましょう",
      "2 つの[数|かず]の[両方|りょうほう]に[出|で]てくる[数|かず]が、[公約数|こうやくすう]です",
      "[小|ちい]さいほうの[数|かず]の[約数|やくすう]の[中|なか]から、もう[一方|いっぽう]の[数|かず]でもわり[切|き]れるものを[見|み]つけましょう",
    ],
    topic: { t: "commonDivisors", a, b, list },
    answer: multiAnswer(Math.min(a, b), list),
  };
}

function verifyCommonDivisors({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "commonDivisors") return "commonDivisors の問題ではありません";
  const list = commonDivisorsOf(topic.a, topic.b);
  if (!sameList(topic.list, list)) return "list が公約数と合いません";
  return verifyMulti(answer, Math.min(topic.a, topic.b), list) ?? leakedList(hints, list);
}

export const INTEGER_COMMON_DIVISORS = defineNumberMaker<PairSpec>({
  name: "integer.commonDivisors",
  parse: parseCommonDivisors,
  toArgs: ({ a, b }) => [a, b],
  make: commonDivisorsProblem,
  verify: verifyCommonDivisors,
});

/* ---------- integer.gcd(a, b) ---------- */

function parseGcd(args: unknown[]): Parsed<PairSpec> {
  const count = parseCount(args, 2);
  return count ? fail(count) : parsePair(args, 2, 100);
}

// ヒントには数を書かない。答えが a か b と同じになる組（4 と 8 など）があるため
function gcdProblem({ a, b }: PairSpec): NumberProblem {
  const answer = gcdOf(a, b);
  return {
    kind: "number",
    pieces: [],
    hints: [
      "それぞれの[約数|やくすう]を[書|か]き[出|だ]して、どちらにも[出|で]てくる[数|かず]を[見|み]つけましょう",
      "どちらにも[出|で]てくる[数|かず]が、[公約数|こうやくすう]です",
      "[公約数|こうやくすう]の[中|なか]で、いちばん[大|おお]きい[数|かず]が[最大公約数|さいだいこうやくすう]です",
    ],
    topic: { t: "gcd", a, b, list: commonDivisorsOf(a, b), answer },
    answer: { type: "integer", value: answer },
  };
}

function verifyGcd({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "gcd") return "gcd の問題ではありません";
  const gcd = gcdOf(topic.a, topic.b);
  if (topic.answer !== gcd) return "answer が最大公約数と合いません";
  if (!sameList(topic.list, commonDivisorsOf(topic.a, topic.b))) return "list が公約数と合いません";
  if (answer.type !== "integer" || answer.value !== gcd) return "答えが最大公約数と合いません";
  return leakedNumberReason(hints, String(gcd));
}

export const INTEGER_GCD = defineNumberMaker<PairSpec>({
  name: "integer.gcd",
  parse: parseGcd,
  toArgs: ({ a, b }) => [a, b],
  make: gcdProblem,
  verify: verifyGcd,
});

/* ---------- integer.commonMultiple(a, b, nth) ---------- */

interface CommonMultipleSpec extends PairSpec { nth: number }

function parseCommonMultiple(args: unknown[]): Parsed<CommonMultipleSpec> {
  const count = parseCount(args, 3);
  if (count) return fail(count);
  const pair = parsePair(args, 2, 20);
  const nth = parseIntArg(args[2], "nth", 1, 3);
  if (!pair.ok) return pair;
  if (!nth.ok) return nth;
  const answer = lcmOf(pair.value.a, pair.value.b) * nth.value;
  if (answer > MAX_MULTIPLE) return fail(`答えは ${MAX_MULTIPLE} 以下になる数にしてください（${answer}）`);
  return { ok: true, value: { ...pair.value, nth: nth.value } };
}

const commonMultiplesOf = (a: number, b: number, nth: number): number[] => range(1, nth).map((times) => lcmOf(a, b) * times);

// ヒントには数を書かない。公倍数が a や b と同じになる組（4 と 8 など）があるため
function commonMultipleProblem({ a, b, nth }: CommonMultipleSpec): NumberProblem {
  const list = commonMultiplesOf(a, b, nth);
  return {
    kind: "number",
    pieces: [],
    hints: [
      "[公倍数|こうばいすう]は、どちらの[倍数|ばいすう]にもなっている[数|かず]です",
      "それぞれの[倍数|ばいすう]を[小|ちい]さい[順|じゅん]に[書|か]き[出|だ]して、[同|おな]じ[数|かず]を[見|み]つけましょう",
      "[同|おな]じ[数|かず]が[見|み]つかったら、[小|ちい]さいほうから[数|かぞ]えましょう",
    ],
    topic: { t: "commonMultiple", a, b, nth, list },
    answer: { type: "integer", value: list[nth - 1] },
  };
}

function verifyCommonMultiple({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "commonMultiple") return "commonMultiple の問題ではありません";
  const list = commonMultiplesOf(topic.a, topic.b, topic.nth);
  if (!sameList(topic.list, list)) return "list が公倍数と合いません";
  const nth = list[topic.nth - 1];
  if (answer.type !== "integer" || answer.value !== nth) return "答えが nth 番目の公倍数と合いません";
  return leakedNumberReason(hints, String(nth)) ?? leakedList(hints, list);
}

export const INTEGER_COMMON_MULTIPLE = defineNumberMaker<CommonMultipleSpec>({
  name: "integer.commonMultiple",
  parse: parseCommonMultiple,
  toArgs: ({ a, b, nth }) => [a, b, nth],
  make: commonMultipleProblem,
  verify: verifyCommonMultiple,
});

/* ---------- integer.lcm(a, b) ---------- */

function parseLcm(args: unknown[]): Parsed<PairSpec> {
  const count = parseCount(args, 2);
  if (count) return fail(count);
  const pair = parsePair(args, 2, 20);
  if (!pair.ok) return pair;
  const answer = lcmOf(pair.value.a, pair.value.b);
  return answer > MAX_MULTIPLE ? fail(`答えは ${MAX_MULTIPLE} 以下になる数にしてください（${answer}）`) : pair;
}

// ヒントには数を書かない。答えが a か b と同じになる組（3 と 6 など）があるため
function lcmProblem({ a, b }: PairSpec): NumberProblem {
  const answer = lcmOf(a, b);
  return {
    kind: "number",
    pieces: [],
    hints: [
      "[公倍数|こうばいすう]を、[小|ちい]さいほうから[書|か]き[出|だ]してみましょう",
      "[公倍数|こうばいすう]の[中|なか]で、いちばん[小|ちい]さい[数|かず]が[最小公倍数|さいしょうこうばいすう]です",
      "[大|おお]きいほうの[数|かず]の[倍数|ばいすう]から、もう[一方|いっぽう]の[数|かず]でもわり[切|き]れるものを[見|み]つけましょう",
    ],
    topic: { t: "lcm", a, b, answer },
    answer: { type: "integer", value: answer },
  };
}

function verifyLcm({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "lcm") return "lcm の問題ではありません";
  const lcm = lcmOf(topic.a, topic.b);
  if (topic.answer !== lcm) return "answer が最小公倍数と合いません";
  if (answer.type !== "integer" || answer.value !== lcm) return "答えが最小公倍数と合いません";
  return leakedNumberReason(hints, String(lcm));
}

export const INTEGER_LCM = defineNumberMaker<PairSpec>({
  name: "integer.lcm",
  parse: parseLcm,
  toArgs: ({ a, b }) => [a, b],
  make: lcmProblem,
  verify: verifyLcm,
});

export const INTEGER_MAKERS: readonly ProblemMaker[] = [
  INTEGER_PARITY, INTEGER_DIVISORS, INTEGER_MULTIPLES, INTEGER_COMMON_DIVISORS,
  INTEGER_GCD, INTEGER_COMMON_MULTIPLE, INTEGER_LCM,
];
