// 分数の章の問題の関数（8つ）。組み立ては problems.ts の関数をそのまま使い、ここは検査と検算を足す
import { calculate, compareFractions, countUnits, isLowestTerms, leastCommonMultiple } from "../fraction";
import type { Fraction, Operator } from "../fraction";
import { calculateProblem, commonProblem, compareProblem, divideProblem, equivalentProblem, estimateProblem, plainProblem, reduceProblem } from "../problems";
import type { LessonProblem } from "../problems";
import { mentionsFraction, mentionsNumber } from "./format";
import { denRangeReason, MAX_DEN, MIN_DEN, tileLimitReason } from "./limits";
import type { Arg, CheckResult, ProblemMaker } from "./types";

type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });

/* ---------- 引数を読む ---------- */

function parseFraction(arg: unknown, label: string): Parsed<Fraction> {
  if (typeof arg !== "object" || arg === null || !("num" in arg) || !("den" in arg)) return fail(`${label}は分数 {num, den} にしてください`);
  const { num, den } = arg;
  if (typeof num !== "number" || typeof den !== "number" || !Number.isSafeInteger(num) || !Number.isSafeInteger(den)) {
    return fail(`${label}の num と den は整数にしてください`);
  }
  if (num < 1 || den < 1) return fail(`${label}の num と den は 1 以上にしてください`);
  return { ok: true, value: { num, den } };
}

/** 式や元の分数。分母は 2〜20 */
function parseTermFraction(arg: unknown, label: string): Parsed<Fraction> {
  const parsed = parseFraction(arg, label);
  if (!parsed.ok) return parsed;
  const reason = denRangeReason(label, parsed.value);
  return reason ? fail(reason) : parsed;
}

function parseOperator(arg: unknown): Parsed<Operator> {
  return arg === "+" || arg === "-" ? { ok: true, value: arg } : fail("op は + か - にしてください");
}

function parseCount(args: unknown[], min: number, max: number): string | null {
  if (args.length >= min && args.length <= max) return null;
  return min === max ? `args は ${min} 個にしてください（${args.length} 個）` : `args は ${min}〜${max} 個にしてください（${args.length} 個）`;
}

/** 1 か 1/2。数の 1 も分数 {1,1} も受ける */
function parseThreshold(arg: unknown): Parsed<Fraction> {
  const reason = "threshold は 1 か 1/2 にしてください";
  if (arg === 1) return { ok: true, value: { num: 1, den: 1 } };
  const parsed = parseFraction(arg, "threshold");
  if (!parsed.ok) return fail(reason);
  const { num, den } = parsed.value;
  if (num === 1 && (den === 1 || den === 2)) return { ok: true, value: { num, den } };
  return fail(reason);
}

interface ReduceSpec { value: Fraction; wrongUnit: Fraction }
interface PairSpec { left: Fraction; right: Fraction }
interface CalculateSpec { left: Fraction; operator: Operator; right: Fraction; showMixed: boolean }
interface EstimateSpec { left: Fraction; operator: Operator; right: Fraction; threshold: Fraction }

function parseReduce(args: unknown[]): Parsed<ReduceSpec> {
  const count = parseCount(args, 2, 2);
  if (count) return fail(count);
  const value = parseTermFraction(args[0], "value");
  const wrongUnit = parseTermFraction(args[1], "wrongUnit");
  if (!value.ok) return value;
  if (!wrongUnit.ok) return wrongUnit;
  if (isLowestTerms(value.value)) return fail("value は約分できる分数にしてください");
  return { ok: true, value: { value: value.value, wrongUnit: wrongUnit.value } };
}

function parsePair(args: unknown[]): Parsed<PairSpec> {
  const count = parseCount(args, 2, 2);
  if (count) return fail(count);
  const left = parseTermFraction(args[0], "left");
  const right = parseTermFraction(args[1], "right");
  if (!left.ok) return left;
  if (!right.ok) return right;
  return { ok: true, value: { left: left.value, right: right.value } };
}

function parseExpression(args: unknown[]): Parsed<Omit<CalculateSpec, "showMixed">> {
  const left = parseTermFraction(args[0], "left");
  const operator = parseOperator(args[1]);
  const right = parseTermFraction(args[2], "right");
  if (!left.ok) return left;
  if (!operator.ok) return operator;
  if (!right.ok) return right;
  if (operator.value === "-" && compareFractions(left.value, right.value) < 0) return fail("ひき算は left が right 以上になるようにしてください");
  return { ok: true, value: { left: left.value, operator: operator.value, right: right.value } };
}

function parseCalculate(args: unknown[]): Parsed<CalculateSpec> {
  const count = parseCount(args, 3, 4);
  if (count) return fail(count);
  if (args.length === 4 && typeof args[3] !== "boolean") return fail("showMixed は true か false にしてください");
  const expression = parseExpression(args);
  if (!expression.ok) return expression;
  return { ok: true, value: { ...expression.value, showMixed: args[3] === true } };
}

function parsePlain(args: unknown[]): Parsed<Omit<CalculateSpec, "showMixed">> {
  const count = parseCount(args, 3, 3);
  return count ? fail(count) : parseExpression(args);
}

function parseEstimate(args: unknown[]): Parsed<EstimateSpec> {
  const count = parseCount(args, 4, 4);
  if (count) return fail(count);
  const expression = parseExpression(args);
  const threshold = parseThreshold(args[3]);
  if (!expression.ok) return expression;
  if (!threshold.ok) return threshold;
  return { ok: true, value: { left: expression.value.left, operator: expression.value.operator, right: expression.value.right, threshold: threshold.value } };
}

interface DivideSpec { dividend: number; divisor: number }
interface EquivalentSpec { value: Fraction; target: number }

const isInteger = (arg: unknown): arg is number => typeof arg === "number" && Number.isSafeInteger(arg);

function parseDivide(args: unknown[]): Parsed<DivideSpec> {
  const count = parseCount(args, 2, 2);
  if (count) return fail(count);
  const [dividend, divisor] = args;
  if (!isInteger(dividend) || !isInteger(divisor)) return fail("a と b は整数にしてください");
  if (dividend < 1) return fail("a は 1 以上にしてください");
  if (divisor < MIN_DEN || divisor > MAX_DEN) return fail(`b は ${MIN_DEN}〜${MAX_DEN} にしてください（${divisor}）`);
  return { ok: true, value: { dividend, divisor } };
}

function parseEquivalent(args: unknown[]): Parsed<EquivalentSpec> {
  const count = parseCount(args, 3, 3);
  if (count) return fail(count);
  const [num, den, target] = args;
  if (!isInteger(num) || !isInteger(den) || !isInteger(target)) return fail("num・den・target は整数にしてください");
  if (num < 1) return fail("num は 1 以上にしてください");
  const reason = denRangeReason("den", { num, den }) ?? denRangeReason("target", { num, den: target });
  if (reason) return fail(reason);
  if (target === den) return fail("target は den と別の数にしてください");
  if (target % den !== 0 && den % target !== 0) return fail("target は den の倍数か約数にしてください");
  if ((num * target) % den !== 0) return fail(`${num}/${den} は分母 ${target} の分数にできません（分子が整数になりません）`);
  return { ok: true, value: { value: { num, den }, target } };
}

/* ---------- 検算 ---------- */

function leakedAnswer(problem: LessonProblem, answers: Fraction[]): string | null {
  const leaked = answers.find((answer) => problem.hints.some((hint) => mentionsFraction(hint, answer)));
  return leaked ? `ヒントに答えの分数 ${leaked.num}/${leaked.den} が入っています` : null;
}

/** 盤が作れて上限に収まるか。ヒントに答えが入っていないか */
function verifyTiles(problem: LessonProblem, answers: Fraction[]): string | null {
  return tileLimitReason(problem) ?? leakedAnswer(problem, answers);
}

function verifyCalculate(problem: LessonProblem, isPlain: boolean): string | null {
  if (problem.kind !== "calculate") return "calculate の問題ではありません";
  if (isPlain !== (problem.hintsBeforeTiles !== undefined)) return isPlain ? "plain の問題には hintsBeforeTiles が要ります" : "calculate の問題に hintsBeforeTiles があります";
  if (problem.operator === "-" && compareFractions(problem.left, problem.right) < 0) return "ひき算の答えが負になります";
  return verifyTiles(problem, [calculate(problem.left, problem.operator, problem.right)]);
}

// 約分の問題の「うまらないタイル」は、元の分数でも、約分した形の単位分数でもない3つ目のタイル
function verifyReduce(problem: LessonProblem): string | null {
  if (problem.kind !== "reduce") return "reduce の問題ではありません";
  if (isLowestTerms(problem.value)) return "value は約分できる分数にしてください";
  const reduced = calculate(problem.value, "+", { num: 0, den: 1 });
  const wrongUnit = problem.pieces.find((piece) => !(piece.num === problem.value.num && piece.den === problem.value.den) && !(piece.num === 1 && piece.den === reduced.den));
  if (!wrongUnit) return "うまらないタイル（wrongUnit）がありません";
  if (wrongUnit.num !== 1) return `wrongUnit は単位分数にしてください（${wrongUnit.num}/${wrongUnit.den}）`;
  if (countUnits(problem.value, wrongUnit.den) !== null) return `wrongUnit の ${wrongUnit.num}/${wrongUnit.den} で value がうまってしまいます`;
  return verifyTiles(problem, [reduced]);
}

/** 分母をそろえた形。元と同じ形のものは新しい情報ではないので除く */
function commonForms({ left, right }: PairSpec): Fraction[] {
  const den = leastCommonMultiple([left.den, right.den]);
  return [left, right]
    .map(({ num, den: oldDen }) => ({ num: num * (den / oldDen), den }))
    .filter((form, index) => form.den !== [left, right][index].den);
}

function verifyPair(problem: LessonProblem, kind: "common" | "compare"): string | null {
  if (problem.kind !== kind) return `${kind} の問題ではありません`;
  if (problem.left.den === problem.right.den) return "left と right の分母がちがう分数にしてください";
  return verifyTiles(problem, kind === "common" ? commonForms(problem) : []);
}

function verifyEstimate(problem: LessonProblem): string | null {
  if (problem.kind !== "estimate") return "estimate の問題ではありません";
  if (problem.pieces.length > 0) return "estimate はタイルを出しません";
  if (problem.operator === "-" && compareFractions(problem.left, problem.right) < 0) return "ひき算の left が right より小さくなっています";
  return null;
}

// わり切れる時の答えの整数。a か b と同じ数は問題に書いてあるので、ヒントに出てもよい
function leakedInteger(problem: LessonProblem, answer: number, shown: number[]): string | null {
  if (shown.includes(answer)) return null;
  return problem.hints.some((hint) => mentionsNumber(hint, String(answer))) ? `ヒントに答えの ${answer} が入っています` : null;
}

function verifyDivide(problem: LessonProblem): string | null {
  if (problem.kind !== "divide") return "divide の問題ではありません";
  const { dividend, divisor } = problem;
  const [piece, ...others] = problem.pieces;
  if (!piece || others.length > 0 || piece.num !== 1 || piece.den !== divisor || piece.count < dividend) return `1/${divisor} のタイルを ${dividend} まい以上、それだけ用意してください`;
  const isWhole = dividend % divisor === 0;
  const integer = isWhole ? leakedInteger(problem, dividend / divisor, [dividend, divisor]) : null;
  return verifyTiles(problem, [{ num: dividend, den: divisor }]) ?? integer;
}

function verifyEquivalent(problem: LessonProblem): string | null {
  if (problem.kind !== "equivalent") return "equivalent の問題ではありません";
  const { value, target } = problem;
  const num = countUnits(value, target);
  if (num === null) return `${value.num}/${value.den} は分母 ${target} の分数にできません`;
  if (target === value.den || (target % value.den !== 0 && value.den % target !== 0)) return "target は den と別の、den の倍数か約数にしてください";
  const unit = problem.pieces.find((piece) => piece.num === 1 && piece.den === target);
  if (!unit || unit.count < num) return `1/${target} のタイルが ${num} まい以上要ります`;
  // 答えは □ に入る分子。1/target のタイルは問題の道具なので、分子が 1 の時の分数は数えない
  const leaked = problem.hints.some((hint) => mentionsNumber(hint, String(num)) || (num !== 1 && mentionsFraction(hint, { num, den: target })));
  return tileLimitReason(problem) ?? (leaked ? `ヒントに答えの ${num} が入っています` : null);
}

/* ---------- 関数にまとめる ---------- */

interface MakerParts<Spec> {
  name: string;
  parse(args: unknown[]): Parsed<Spec>;
  toArgs(spec: Spec): Arg[];
  make(spec: Spec): LessonProblem;
  verify(problem: LessonProblem): string | null;
}

function defineMaker<Spec>(parts: MakerParts<Spec>): ProblemMaker {
  const check = (args: unknown[]): CheckResult => {
    const parsed = parts.parse(args);
    if (!parsed.ok) return parsed;
    const reason = tileLimitReason(parts.make(parsed.value));
    return reason ? fail(reason) : { ok: true, args: parts.toArgs(parsed.value) };
  };
  const build = (args: Arg[]): LessonProblem => {
    const parsed = parts.parse(args);
    if (!parsed.ok) throw new RangeError(`${parts.name}: ${parsed.reason}`);
    return parts.make(parsed.value);
  };
  return { name: parts.name, kind: "tile", check, build, verify: parts.verify };
}

const expressionArgs = ({ left, operator, right }: Omit<CalculateSpec, "showMixed">): Arg[] => [left, operator, right];

export const FRACTION_REDUCE = defineMaker<ReduceSpec>({
  name: "fraction.reduce",
  parse: parseReduce,
  toArgs: ({ value, wrongUnit }) => [value, wrongUnit],
  make: ({ value, wrongUnit }) => reduceProblem(value, wrongUnit),
  verify: verifyReduce,
});

export const FRACTION_COMMON = defineMaker<PairSpec>({
  name: "fraction.common",
  parse: parsePair,
  toArgs: ({ left, right }) => [left, right],
  make: ({ left, right }) => commonProblem(left, right),
  verify: (problem) => verifyPair(problem, "common"),
});

export const FRACTION_COMPARE = defineMaker<PairSpec>({
  name: "fraction.compare",
  parse: parsePair,
  toArgs: ({ left, right }) => [left, right],
  make: ({ left, right }) => compareProblem(left, right),
  verify: (problem) => verifyPair(problem, "compare"),
});

export const FRACTION_CALCULATE = defineMaker<CalculateSpec>({
  name: "fraction.calculate",
  parse: parseCalculate,
  toArgs: (spec) => (spec.showMixed ? [...expressionArgs(spec), true] : expressionArgs(spec)),
  make: ({ left, operator, right, showMixed }) => calculateProblem(left, operator, right, showMixed),
  verify: (problem) => verifyCalculate(problem, false),
});

export const FRACTION_PLAIN = defineMaker<Omit<CalculateSpec, "showMixed">>({
  name: "fraction.plain",
  parse: parsePlain,
  toArgs: expressionArgs,
  make: ({ left, operator, right }) => plainProblem(left, operator, right),
  verify: (problem) => verifyCalculate(problem, true),
});

export const FRACTION_ESTIMATE = defineMaker<EstimateSpec>({
  name: "fraction.estimate",
  parse: parseEstimate,
  toArgs: ({ left, operator, right, threshold }) => [left, operator, right, threshold],
  make: ({ left, operator, right, threshold }) => estimateProblem(left, operator, right, threshold),
  verify: verifyEstimate,
});

export const FRACTION_DIVIDE = defineMaker<DivideSpec>({
  name: "fraction.divide",
  parse: parseDivide,
  toArgs: ({ dividend, divisor }) => [dividend, divisor],
  make: ({ dividend, divisor }) => divideProblem(dividend, divisor),
  verify: verifyDivide,
});

export const FRACTION_EQUIVALENT = defineMaker<EquivalentSpec>({
  name: "fraction.equivalent",
  parse: parseEquivalent,
  toArgs: ({ value, target }) => [value.num, value.den, target],
  make: ({ value, target }) => equivalentProblem(value, target),
  verify: verifyEquivalent,
});

/** 分数の章の関数の一覧（makers/index.ts へは親がつなぐ） */
export const FRACTION_MAKERS: readonly ProblemMaker[] = [
  FRACTION_REDUCE, FRACTION_COMMON, FRACTION_COMPARE, FRACTION_CALCULATE, FRACTION_PLAIN, FRACTION_ESTIMATE, FRACTION_DIVIDE, FRACTION_EQUIVALENT,
];
