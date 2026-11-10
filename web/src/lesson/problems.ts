// 問題の形と、問題を組み立てる関数。中身は fraction-lessons.ts に置く
import { countUnits, leastCommonMultiple } from "./fraction";
import type { Fraction, Operator } from "./fraction";
import { createDivideProblem, createEquivalentProblem, createGame, createProblem, createRewriteProblem } from "./tiles";
import type { PieceSupply, Problem, TileGame } from "./tiles";
import type { NumberProblem } from "./number-problem";

/** タイルで解く寄り道。data/chapters.ts の分数の章にある */
export const TILE_LESSON_SIDE_ID = "fraction-t2";

interface ProblemBase {
  /** 出題表から作った問題の id（`関数名(数,…)`）。固定で作った問題には無い */
  id?: string;
  /** タイル置き場の中身。空ならタイルを使わず、「分かんない」でヒントを見せる */
  pieces: PieceSupply[];
  /** 順に見せる */
  hints: string[];
  /** タイルより先に開くヒントの数。無ければ「分かんない」ですぐタイルを開く */
  hintsBeforeTiles?: number;
}

/** 計算して答える */
export interface CalculateProblem extends ProblemBase {
  kind: "calculate";
  left: Fraction;
  operator: Operator;
  right: Fraction;
  /** 式の仮分数を帯分数で見せる */
  showMixed?: boolean;
}

/** 約分する */
export interface ReduceProblem extends ProblemBase {
  kind: "reduce";
  value: Fraction;
}

/** 通分する */
export interface CommonProblem extends ProblemBase {
  kind: "common";
  left: Fraction;
  right: Fraction;
}

/** 2つの分数の大きさをくらべる */
export interface CompareProblem extends ProblemBase {
  kind: "compare";
  left: Fraction;
  right: Fraction;
}

/** 計算する前に、答えが threshold より大きいか小さいかを見積もる */
export interface EstimateProblem extends ProblemBase {
  kind: "estimate";
  left: Fraction;
  operator: Operator;
  right: Fraction;
  threshold: Fraction;
}

/** わり算を分数で表す（dividend ÷ divisor）。答えは約分しない */
export interface DivideProblem extends ProblemBase {
  kind: "divide";
  dividend: number;
  divisor: number;
}

/** 同じ大きさの分数 value = □/target。答えは □ に入る分子だけ */
export interface EquivalentProblem extends ProblemBase {
  kind: "equivalent";
  value: Fraction;
  target: number;
}

/** タイルの盤で考えられる問題（見積もりはタイルを出さないが、式は分数） */
export type TileProblem =
  | CalculateProblem | ReduceProblem | CommonProblem | CompareProblem | EstimateProblem | DivideProblem | EquivalentProblem;

/** 1つの学習の中で、問題ごとにタイルの問題と数の問題を切り替える（D-132、problems の ADR-003） */
export type LessonProblem = TileProblem | NumberProblem;

export const isNumberProblem = (problem: LessonProblem): problem is NumberProblem => problem.kind === "number";

/** 分数の章の最初の3マスで、問題の前に見せる図解の種類 */
export type LessonIntro = "division" | "decimal" | "equivalent";

export interface LessonDefinition {
  id: string;
  /** 出題表の学習の名前（`{章 id}:{key}`）。出題表から作った学習だけが持つ */
  planId?: string;
  /** 1問目の前に見せる図解（FractionIntro）。見終えたら問題へ進む */
  intro?: LessonIntro;
  /** 先にタイルで解く学習。解けるまで答えの欄を出さない */
  isTilesFirst: boolean;
  problems: LessonProblem[];
}

export const hasTiles = (problem: LessonProblem): boolean => problem.pieces.length > 0;

/** 「分かんない」で、タイルより先にヒントを開く問題か */
export const startsWithHints = (problem: LessonProblem): boolean => !hasTiles(problem) || problem.hintsBeforeTiles !== undefined;

/** タイルの盤の問題にする。通分とくらべるは、2枚を同じタイルでうめるので、たし算の盤と同じ */
// 数の問題は盤を出さないので、空の盤にする。session.ts は問題ごとに盤を持つため、形だけ合わせる
const NO_TILES: Problem = createRewriteProblem({ num: 1, den: 1 });

export function tileProblemOf(problem: LessonProblem): Problem {
  if (problem.kind === "number") return NO_TILES;
  if (problem.kind === "reduce") return createRewriteProblem(problem.value);
  if (problem.kind === "divide") return createDivideProblem(problem.dividend, problem.divisor);
  if (problem.kind === "equivalent") return createEquivalentProblem(problem.value, problem.target);
  const operator = problem.kind === "calculate" || problem.kind === "estimate" ? problem.operator : "+";
  return createProblem(problem.left, operator, problem.right);
}

export const gameOf = (problem: LessonProblem): TileGame => createGame(problem.pieces, tileProblemOf(problem));

/* ---------- 組み立て ---------- */

const text = ({ num, den }: Fraction): string => `${num}/${den}`;

const unitsOf = (value: Fraction, den: number): number => countUnits(value, den) ?? 0;

// 同じ種類は1つにまとめて枚数を足す。盤は種類でタイルを探すので、同じ種類が2つあると後ろの枚数を数えない
function supplyOf(entries: [Fraction, number][]): PieceSupply[] {
  const pieces = new Map<string, PieceSupply>();
  for (const [piece, count] of entries) {
    pieces.set(text(piece), { ...piece, count: (pieces.get(text(piece))?.count ?? 0) + count });
  }
  return [...pieces.values()];
}

function pairSupply(left: Fraction, operator: Operator, right: Fraction): PieceSupply[] {
  const den = leastCommonMultiple([left.den, right.den]);
  // たし算は1まい多く用意する。ためしに置いても足りなくならない
  const units = unitsOf(left, den) + (operator === "+" ? unitsOf(right, den) + 1 : 0);
  return supplyOf([[left, 1], [right, 1], [{ num: 1, den }, units]]);
}

function pairHints(left: Fraction, operator: Operator, right: Fraction): string[] {
  const unit = `1/${leastCommonMultiple([left.den, right.den])}`;
  if (operator === "-") {
    return ["[小|ちい]さいタイルでうめると、[取|と]りやすくなります", `${unit} を ${text(left)} に[当|あ]ててみましょう`, `${text(right)} のタイルを、うめたタイルの[上|うえ]に[重|かさ]ねましょう`];
  }
  const targets = [left, right].map(text).filter((value) => value !== unit);
  return ["どちらも[同|おな]じ[大|おお]きさのタイルでうめられるか、ためしてみましょう", ...targets.map((target) => `${unit} を ${target} に[当|あ]ててみましょう`)];
}

export function calculateProblem(left: Fraction, operator: Operator, right: Fraction, showMixed = false): CalculateProblem {
  return { kind: "calculate", left, operator, right, showMixed, pieces: pairSupply(left, operator, right), hints: pairHints(left, operator, right) };
}

/** 式で考える類題。ヒントを開ききっても分からない時だけ、同じ問題をタイルで考えられる。行き止まりにしないため */
export function plainProblem(left: Fraction, operator: Operator, right: Fraction): CalculateProblem {
  const den = leastCommonMultiple([left.den, right.den]);
  const hints = ["はじめに、[分母|ぶんぼ]をそろえてみましょう", `[分母|ぶんぼ]を ${den} にそろえましょう`];
  return {
    kind: "calculate",
    left,
    operator,
    right,
    pieces: pairSupply(left, operator, right),
    hints: [...hints, ...pairHints(left, operator, right)],
    hintsBeforeTiles: hints.length,
  };
}

/** wrongUnit は、うまらないことをためせるタイル */
export function reduceProblem(value: Fraction, wrongUnit: Fraction): ReduceProblem {
  const { den } = createRewriteProblem(value).answer;
  const units = unitsOf(value, den);
  return {
    kind: "reduce",
    value,
    pieces: supplyOf([[value, 1], [{ num: 1, den }, units], [wrongUnit, units]]),
    hints: ["もっと[大|おお]きいタイルでも、ぴったりうめられます", `1/${den} を ${text(value)} に[当|あ]ててみましょう`],
  };
}

export function commonProblem(left: Fraction, right: Fraction): CommonProblem {
  return { kind: "common", left, right, pieces: pairSupply(left, "+", right), hints: pairHints(left, "+", right) };
}

export function compareProblem(left: Fraction, right: Fraction): CompareProblem {
  return { kind: "compare", left, right, pieces: pairSupply(left, "+", right), hints: pairHints(left, "+", right) };
}

const valueText = (value: Fraction): string => (value.den === 1 ? `${value.num}` : text(value));

// 式によって見る所がちがう。たし算は半分とくらべ、ひき算は引かれる数としきい値をくらべる
function estimateHints(left: Fraction, operator: Operator, right: Fraction, threshold: Fraction): string[] {
  const [first, second, limit] = [text(left), text(right), valueText(threshold)];
  if (operator === "-") return [`${first} と ${limit} をくらべてみましょう`, `${first} から ${second} だけへると、${limit} とくらべてどうなるでしょう`];
  const half = text({ num: threshold.num, den: threshold.den * 2 });
  return [`${first} と ${second} を、それぞれ ${half} とくらべてみましょう`, `${half} と ${half} をたすと ${limit} です`];
}

export function estimateProblem(left: Fraction, operator: Operator, right: Fraction, threshold: Fraction): EstimateProblem {
  return { kind: "estimate", left, operator, right, threshold, pieces: [], hints: estimateHints(left, operator, right, threshold) };
}

/** a ÷ b。1/b のタイルを a まい並べると解ける。1まい多く用意して、ためしに置いても足りなくならないようにする */
export function divideProblem(dividend: number, divisor: number): DivideProblem {
  return {
    kind: "divide",
    dividend,
    divisor,
    pieces: supplyOf([[{ num: 1, den: divisor }, dividend + 1]]),
    hints: [
      `ものさしを ${divisor} こに[同|おな]じ[大|おお]きさで[分|わ]けた、ひとつぶんのタイルを[使|つか]います`,
      `そのタイルを ${dividend} まい、ものさしに[並|なら]べてみましょう`,
      "[並|なら]べたタイルが、ものさしのどこまでかを[見|み]ましょう",
    ],
  };
}

/** value = □/target。value を 1/target のタイルでうめ直す。target が分母の倍数なら細かいタイル、約数なら大きいタイル */
export function equivalentProblem(value: Fraction, target: number): EquivalentProblem {
  const { answer } = createEquivalentProblem(value, target);
  const unit = { num: 1, den: target };
  return {
    kind: "equivalent",
    value,
    target,
    pieces: supplyOf([[value, 1], [unit, answer.num]]),
    hints: [
      `${text(value)} のタイルを、ちがう[大|おお]きさのタイルでうめてみましょう`,
      `${text(unit)} のタイルは、${text(value)} のタイルの[上|うえ]に[重|かさ]ねられます`,
      "うめたタイルが[何|なん]まいかを[数|かぞ]えてみましょう",
    ],
  };
}
