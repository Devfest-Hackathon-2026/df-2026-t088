import { describe, expect, it } from "vitest";
import { calculate, fractionsEqual, leastCommonMultiple } from "./fraction";
import type { Fraction, Operator } from "./fraction";
import { judgeAnswer } from "./judge";
import {
  alignedExpression, commonUnit, createGame, createProblem, dropOnTile, isSolved, layoutTiles, moveTile, placeTile, remainingCount,
  rulerCount, rulerLength, undoOnTile,
} from "./tiles";
import type { PieceSupply, TileGame, TileResult } from "./tiles";
import { guideParts } from "./wording";

// 分母 12 までの式を全部、子どもと同じ操作で解く。範囲は docs/product/education-api-contract.md の「受け付ける式の形」と上限に合わせる。
// 分子は 1 以上（0 を含む式は受けない）。仮分数も入れて、分母の 2 倍で止める。帯分数は式として受けないので入れない
const MAX_DEN = 12;
const MAX_NUM_PER_DEN = 2;
// server/src/limits.ts の maxPieceTypes と maxPiecesPerType
const MAX_PIECE_TYPES = 6;
const MAX_PIECES_PER_TYPE = 100;

const OPERATORS: Operator[] = ["+", "-"];
const keyOf = ({ num, den }: Fraction): string => `${num}/${den}`;

function allFractions(): Fraction[] {
  const fractions: Fraction[] = [];
  for (let den = 1; den <= MAX_DEN; den += 1) {
    for (let num = 1; num <= den * MAX_NUM_PER_DEN; num += 1) fractions.push({ num, den });
  }
  return fractions;
}

const gcd = (left: number, right: number): number => (right === 0 ? left : gcd(right, left % right));

// fraction.ts の答えを確かめるので、ここでは別の書き方で計算する
function expectedAnswer(left: Fraction, operator: Operator, right: Fraction): Fraction {
  const crossed = right.num * left.den * (operator === "+" ? 1 : -1);
  const num = left.num * right.den + crossed;
  const den = left.den * right.den;
  const divisor = gcd(Math.abs(num), den);
  return { num: num / divisor, den: den / divisor };
}

// 同じ種類は 1 つにまとめて枚数を足す。盤は key でタイルを探すので、同じ key が 2 つあると後ろの枚数を数えない
function supplyFor(left: Fraction, operator: Operator, right: Fraction): PieceSupply[] {
  const den = leastCommonMultiple([left.den, right.den]);
  const leftUnits = (left.num * den) / left.den;
  const rightUnits = (right.num * den) / right.den;
  const pieces = new Map<string, PieceSupply>();
  const add = (piece: Fraction, count: number) => {
    const key = keyOf(piece);
    pieces.set(key, { ...piece, count: (pieces.get(key)?.count ?? 0) + count });
  };
  add(left, 1);
  add(right, 1);
  add({ num: 1, den }, operator === "+" ? leftUnits + rightUnits : leftUnits);
  return [...pieces.values()];
}

function done({ game, notice }: TileResult): TileGame {
  if (notice) throw new Error(`操作が断られた: ${notice}`);
  return game;
}

function fillTile(start: TileGame, tileId: number, value: Fraction): TileGame {
  const unit = commonUnit(start);
  if (keyOf(value) === unit.key) return start;
  let game = start;
  for (let count = 0; count < (value.num * unit.den) / value.den; count += 1) game = done(dropOnTile(game, tileId, unit.key));
  return game;
}

function solveByHand(start: TileGame): TileGame {
  const { left, right, operator } = start.problem;
  const placed = done(placeTile(start, keyOf(left)));
  const leftId = placed.tiles[0]?.id ?? -1;
  if (operator === "-") return done(dropOnTile(fillTile(placed, leftId, left), leftId, keyOf(right)));
  const both = done(placeTile(placed, keyOf(right)));
  return fillTile(fillTile(both, leftId, left), both.tiles[1]?.id ?? -1, right);
}

function answerTexts({ num, den }: Fraction): string[] {
  const texts = [`${num}/${den}`, `${num * 2}/${den * 2}`];
  if (den === 1) texts.push(String(num));
  const [whole, rest] = [Math.floor(num / den), num % den];
  if (whole > 0 && rest > 0) texts.push(`${whole} ${rest}/${den}`, `${whole}と${rest}/${den}`);
  return texts;
}

function answerProblems(answer: Fraction): string[] {
  const rejected = answerTexts(answer).filter((text) => judgeAnswer(text, answer) !== "correct");
  const accepted = judgeAnswer(`${answer.num + 1}/${answer.den}`, answer) !== "wrong";
  return [...rejected.map((text) => `正解が通らない: ${text}`), ...(accepted ? ["まちがいが通った"] : [])];
}

function boardProblems(solved: TileGame, answer: Fraction): string[] {
  const { left, right } = solved.problem;
  const placed = layoutTiles(solved).at(-1);
  const count = rulerCount(solved);
  const aligned = alignedExpression(solved);
  const [first, last] = [solved.tiles[0], solved.tiles.at(-1)];
  const checks: [boolean, string][] = [
    [isSolved(solved), "解けない"],
    [count !== null && fractionsEqual({ num: count.count, den: count.den }, answer), "数えた枚数が答えと合わない"],
    [aligned.left.den === aligned.right.den && fractionsEqual(aligned.left, left) && fractionsEqual(aligned.right, right), "そろえた式が元と合わない"],
    [placed !== undefined && placed.start + placed.size <= rulerLength(solved), "ものさしからはみ出す"],
    [solved.pieces.every((piece) => remainingCount(solved, piece.key) >= 0), "タイルの枚数が負になる"],
    [first !== undefined && last !== undefined && isSolved(moveTile(solved, last.id, 0)), "並べ替えると解けなくなる"],
  ];
  const undone = solved.tiles.map((tile) => undoOnTile(solved, tile.id)).filter((game) => game !== solved);
  checks.push([undone.every((game) => !isSolved(game)), "1段戻しても解けたままになる"]);
  return checks.filter(([isOk]) => !isOk).map(([, message]) => message);
}

function problemsOf(left: Fraction, operator: Operator, right: Fraction, supply: PieceSupply[]): string[] {
  try {
    const problem = createProblem(left, operator, right);
    const expected = expectedAnswer(left, operator, right);
    const game = createGame(supply, problem);
    guideParts(game);
    return [
      ...(problem.answer.num === expected.num && problem.answer.den === expected.den ? [] : ["答えが約分した形でない"]),
      ...answerProblems(problem.answer),
      ...boardProblems(solveByHand(game), expected),
    ];
  } catch (error) {
    return [error instanceof Error ? error.message : "例外"];
  }
}

describe("分母 12 までの全部の式", () => {
  it("受け付ける範囲の式は、答えの判定も盤の操作も合う", () => {
    const fractions = allFractions();
    const counts = { total: 0, negative: 0, overLimit: 0, checked: 0 };
    const failures: string[] = [];
    for (const left of fractions) {
      for (const right of fractions) {
        for (const operator of OPERATORS) {
          counts.total += 1;
          const supply = supplyFor(left, operator, right);
          if (calculate(left, operator, right).num < 0) counts.negative += 1;
          else if (supply.length > MAX_PIECE_TYPES || supply.some(({ count }) => count > MAX_PIECES_PER_TYPE)) counts.overLimit += 1;
          else {
            counts.checked += 1;
            const name = `${keyOf(left)} ${operator} ${keyOf(right)}`;
            failures.push(...problemsOf(left, operator, right, supply).map((problem) => `${name}: ${problem}`));
          }
        }
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
    // 範囲の絞り込みで式が抜け落ちていないことも確かめる
    expect(counts).toEqual({ total: 48672, negative: 11880, overLimit: 12158, checked: 24634 });
  });
});
