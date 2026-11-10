import { describe, expect, it } from "vitest";
import { calculate, fractionsEqual } from "./fraction";
import type { Fraction, Operator } from "./fraction";
import { judgeAnswer } from "./judge";
import { calculateProblem, divideProblem, equivalentProblem, gameOf as lessonGameOf } from "./problems";
import type { CalculateProblem } from "./problems";
import {
  alignedExpression, clearBoard, commonUnit, createGame, createProblem, createRewriteProblem, dropOnTile, isSolved, layoutTiles, moveTile, placeTile,
  pressOnRuler, remainingCount, removeTile, revealNextHint, rulerCount, rulerLength, rulerWholes, scrollBehaviorFor, takenUnits, undoOnTile,
} from "./tiles";
import type { PieceSupply, TileGame, TileResult } from "./tiles";
import { tileLimitReason } from "./makers/limits";

const f = (num: number, den: number): Fraction => ({ num, den });
const LESSON_PROBLEMS = [calculateProblem(f(1, 2), "+", f(1, 3)), calculateProblem(f(1, 2), "+", f(3, 4)), calculateProblem(f(5, 6), "-", f(1, 3))];
const [ADD, OVER_ONE, SUBTRACT] = LESSON_PROBLEMS as [CalculateProblem, CalculateProblem, CalculateProblem];

function gameOf({ left, operator, right, pieces }: CalculateProblem): TileGame {
  return createGame(pieces, createProblem(left, operator, right));
}

function customGame(left: Fraction, operator: Operator, right: Fraction, pieces: PieceSupply[]): TileGame {
  return createGame(pieces, createProblem(left, operator, right));
}

function apply({ game, notice }: TileResult): TileGame {
  expect(notice).toBeUndefined();
  return game;
}

const keyOf = (game: TileGame, value: Fraction): string => {
  const piece = game.pieces.find((candidate) => fractionsEqual(candidate, value));
  if (!piece) throw new Error("タイルがありません");
  return piece.key;
};

const tileIdAt = (game: TileGame, index: number): number => game.tiles[index]?.id ?? -1;

function fillTile(start: TileGame, tileId: number, value: Fraction): TileGame {
  const unit = commonUnit(start);
  let game = start;
  for (let count = 0; count < (value.num * unit.den) / value.den; count += 1) game = apply(dropOnTile(game, tileId, unit.key));
  return game;
}

// 子どもと同じ操作だけで解く。枚数が足りなければ途中で止まる
function solveByHand(start: TileGame): TileGame {
  const { left, right, operator } = start.problem;
  const unit = commonUnit(start);
  let game = apply(placeTile(start, keyOf(start, left)));
  const leftId = tileIdAt(game, 0);
  if (operator === "-") {
    game = fillTile(game, leftId, left);
    return apply(dropOnTile(game, leftId, keyOf(game, right)));
  }
  game = apply(placeTile(game, keyOf(game, right)));
  const rightId = tileIdAt(game, 1);
  if (keyOf(game, left) !== unit.key) game = fillTile(game, leftId, left);
  if (keyOf(game, right) !== unit.key) game = fillTile(game, rightId, right);
  return game;
}

describe("分数の計算", () => {
  it("小数にすると等しく見える大きな分数を、別の値として比べる", () => {
    const big = 9007199254740991;
    expect(fractionsEqual(f(big, big - 1), f(big - 1, big - 2))).toBe(false);
    expect(fractionsEqual(f(1, 3), f(2, 6))).toBe(true);
  });

  it("答えは整数のまま約分される", () => {
    expect(calculate(f(1, 2), "+", f(1, 3))).toEqual(f(5, 6));
    expect(calculate(f(1, 2), "+", f(1, 6))).toEqual(f(2, 3));
    expect(calculate(f(1, 2), "-", f(1, 2))).toEqual(f(0, 1));
  });

  it("安全な整数を超える結果は RangeError にする", () => {
    const big = 9007199254740991;
    expect(() => calculate(f(big, 1), "+", f(big, 1))).toThrow(RangeError);
  });
});

describe("答えの判定", () => {
  it("約分前、全角、帯分数、整数を値で判定する", () => {
    expect(judgeAnswer("5/6", f(5, 6))).toBe("correct");
    expect(judgeAnswer("10/12", f(5, 6))).toBe("correct");
    expect(judgeAnswer("５／６", f(5, 6))).toBe("correct");
    expect(judgeAnswer(" 5 / 6 ", f(5, 6))).toBe("correct");
    expect(judgeAnswer("2/5", f(5, 6))).toBe("wrong");
    expect(judgeAnswer("1 1/4", f(5, 4))).toBe("correct");
    expect(judgeAnswer("1と1/4", f(5, 4))).toBe("correct");
    expect(judgeAnswer("2", f(2, 1))).toBe("correct");
    expect(judgeAnswer("0", f(0, 1))).toBe("correct");
  });

  it.each(["", "1/0", "わからない", "0.5", "1/2/3", "9".repeat(41)])("%s は答えとして読まない", (input) => {
    expect(judgeAnswer(input, f(5, 6))).toBe("invalid");
  });

  it("帯分数が安全な整数を超えても止まらない", () => {
    expect(judgeAnswer("9007199254740991 9007199254740991/2", f(5, 6))).toBe("invalid");
  });
});

describe("用意した問題", () => {
  it("たし算、1を超えるたし算、ひき算の順に並ぶ", () => {
    expect(LESSON_PROBLEMS.map(({ left, operator, right }) => createProblem(left, operator, right).answer)).toEqual([f(5, 6), f(5, 4), f(1, 2)]);
    expect(ADD.left).toEqual(f(1, 2));
    expect(ADD.right).toEqual(f(1, 3));
  });

  it.each(LESSON_PROBLEMS.map((problem) => [`${problem.left.num}/${problem.left.den} ${problem.operator} ${problem.right.num}/${problem.right.den}`, problem] as const))(
    "%s は手の操作で解け、ヒントは3つある",
    (_name, problem) => {
      expect(isSolved(solveByHand(gameOf(problem)))).toBe(true);
      expect(problem.hints).toHaveLength(3);
    },
  );

  it("ものさしは1を超える問題だけ2までのびる", () => {
    expect(LESSON_PROBLEMS.map((problem) => rulerWholes(gameOf(problem).problem))).toEqual([1, 2, 1]);
    expect(rulerLength(gameOf(OVER_ONE))).toBe(8);
  });
});

describe("約分の盤", () => {
  const rewrite = (pieces: PieceSupply[]): TileGame => createGame(pieces, createRewriteProblem(f(4, 6)));
  const supply = [{ num: 4, den: 6, count: 1 }, { num: 1, den: 3, count: 2 }, { num: 1, den: 6, count: 4 }, { num: 1, den: 2, count: 2 }];

  it("答えは約分した形で、うめるタイルはその分母", () => {
    const game = rewrite(supply);
    expect(game.problem.answer).toEqual(f(2, 3));
    expect(commonUnit(game).key).toBe("1/3");
    expect(rulerWholes(game.problem)).toBe(1);
  });

  it("もとのタイルと同じ細かさでうめても解けず、大きいタイルでうめると解ける", () => {
    const placed = apply(placeTile(rewrite(supply), "4/6"));
    const tileId = placed.tiles[0]?.id ?? -1;
    let fine = placed;
    for (let count = 0; count < 4; count += 1) fine = apply(dropOnTile(fine, tileId, "1/6"));
    expect(isSolved(fine)).toBe(false);
    const coarse = apply(dropOnTile(apply(dropOnTile(placed, tileId, "1/3")), tileId, "1/3"));
    expect(isSolved(coarse)).toBe(true);
    expect(alignedExpression(coarse).left).toEqual(f(2, 3));
    expect(rulerCount(coarse)).toEqual({ den: 3, count: 2 });
  });

  it("ものさしには、もとのタイルしか置けない", () => {
    expect(placeTile(rewrite(supply), "1/3").notice).toBe("cover_tile");
  });

  it("うまらないタイルは重ねず、続きにも置かない", () => {
    const placed = apply(placeTile(rewrite(supply), "4/6"));
    const result = dropOnTile(placed, placed.tiles[0]?.id ?? -1, "1/2");
    expect(result.notice).toBe("no_fit");
    expect(result.game).toBe(placed);
  });
});

describe("タイルの生成", () => {
  it("用意したタイルから、分母の最小公倍数を目盛りにした盤を作る", () => {
    const game = gameOf(ADD);
    expect(game.pieces.map((piece) => piece.key)).toEqual(["1/2", "1/3", "1/6"]);
    expect(game.scale).toBe(6);
    expect(rulerLength(game)).toBe(6);
  });

  it("うめる単位分数は、いちばん細かいものを選ぶ", () => {
    const game = customGame(f(2, 4), "+", f(1, 2), [{ ...f(2, 4), count: 1 }, { ...f(1, 2), count: 1 }, { ...f(1, 4), count: 4 }]);
    expect(commonUnit(game).key).toBe("1/4");
    expect(commonUnit(gameOf(ADD)).key).toBe("1/6");
  });

  it("タイルの位置は整数の目盛りで決まり、並べ替えられる", () => {
    let game = gameOf(ADD);
    game = apply(placeTile(game, "1/2"));
    game = apply(placeTile(game, "1/3", 0));
    expect(layoutTiles(game).map(({ start, size }) => [start, size])).toEqual([[0, 2], [2, 3]]);
    game = moveTile(game, tileIdAt(game, 1), 0);
    expect(layoutTiles(game).map(({ start, size }) => [start, size])).toEqual([[0, 3], [3, 2]]);
    expect(clearBoard(game).tiles).toHaveLength(0);
  });
});

describe("組み合わせの判定", () => {
  it("1/2 + 1/3 は両方を 1/6 で埋めたときだけ解けたことになる", () => {
    let game = gameOf(ADD);
    game = apply(placeTile(game, "1/2"));
    game = apply(placeTile(game, "1/3"));
    expect(isSolved(game)).toBe(false);
    const [half, third] = [tileIdAt(game, 0), tileIdAt(game, 1)];
    for (let count = 0; count < 3; count += 1) game = apply(dropOnTile(game, half, "1/6"));
    expect(isSolved(game)).toBe(false);
    expect(rulerCount(game)).toEqual({ den: 6, count: 3 });
    expect(dropOnTile(game, half, "1/6").notice).toBe("already_full");
    for (let count = 0; count < 2; count += 1) game = apply(dropOnTile(game, third, "1/6"));
    expect(isSolved(game)).toBe(true);
    expect(rulerCount(game)).toEqual({ den: 6, count: 5 });
    expect(alignedExpression(game)).toEqual({ left: f(3, 6), right: f(2, 6) });
    expect(remainingCount(game, "1/6")).toBe(1);
  });

  it("よぶんなタイルがあると解けたことにならない", () => {
    let game = solveByHand(gameOf(ADD));
    game = apply(placeTile(game, "1/6"));
    expect(isSolved(game)).toBe(false);
    expect(isSolved(removeTile(game, tileIdAt(game, 2)))).toBe(true);
  });

  it("別の大きさの単位分数で埋めると解けたことにならない", () => {
    let game = customGame(f(1, 2), "+", f(1, 3), [...ADD.pieces, { ...f(1, 12), count: 4 }]);
    game = apply(placeTile(game, "1/2"));
    game = apply(placeTile(game, "1/3"));
    const [half, third] = [tileIdAt(game, 0), tileIdAt(game, 1)];
    for (let count = 0; count < 3; count += 1) game = apply(dropOnTile(game, half, "1/6"));
    for (let count = 0; count < 4; count += 1) game = apply(dropOnTile(game, third, "1/12"));
    expect(isSolved(game)).toBe(false);
    expect(dropOnTile(game, half, "1/12").notice).toBe("mixed_unit");
  });

  it("重ねずに解ける式でも、解けたら枚数を数える", () => {
    const start = customGame(f(1, 4), "+", f(1, 4), [{ ...f(1, 4), count: 2 }]);
    const first = apply(placeTile(start, "1/4"));
    expect(rulerCount(first)).toBeNull();
    const solved = apply(placeTile(first, "1/4"));
    expect(isSolved(solved)).toBe(true);
    expect(rulerCount(solved)).toEqual({ den: 4, count: 2 });
  });

  it("ものさしより長くは置けず、枚数を超えては出せない", () => {
    let game = gameOf(ADD);
    game = apply(placeTile(game, "1/2"));
    expect(placeTile(game, "1/2").notice).toBe("none_left");
    game = apply(placeTile(game, "1/3"));
    game = apply(placeTile(game, "1/6"));
    expect(placeTile(game, "1/6").notice).toBe("ruler_full");
  });

  it("操作は元の盤を書き換えない", () => {
    const game = gameOf(ADD);
    const placed = apply(placeTile(game, "1/2"));
    expect(game.tiles).toHaveLength(0);
    const covered = apply(dropOnTile(placed, tileIdAt(placed, 0), "1/6"));
    expect(placed.tiles[0]?.coverCount).toBe(0);
    expect(covered.tiles[0]?.coverCount).toBe(1);
  });
});

describe("ひき算", () => {
  it("引かれる数を埋めてから、引く数を上に重ねる", () => {
    let game = gameOf(SUBTRACT);
    expect(placeTile(game, "1/3").notice).toBe("take_on_left");
    game = apply(placeTile(game, "5/6"));
    const tileId = tileIdAt(game, 0);
    expect(dropOnTile(game, tileId, "1/3").notice).toBe("fill_first");
    for (let count = 0; count < 5; count += 1) game = apply(dropOnTile(game, tileId, "1/6"));
    game = apply(dropOnTile(game, tileId, "1/3"));
    expect(isSolved(game)).toBe(true);
    expect(takenUnits(game, game.tiles[0] as TileGame["tiles"][number])).toBe(2);
    expect(rulerCount(game)).toEqual({ den: 6, count: 3 });
    expect(alignedExpression(game)).toEqual({ left: f(5, 6), right: f(2, 6) });
    expect(dropOnTile(game, tileId, "1/3").notice).toBe("already_taken");
  });

  it("引く数が単位分数と同じなら、うまるまでは重ね、うまったら取る", () => {
    let game = customGame(f(1, 2), "-", f(1, 6), [{ ...f(1, 2), count: 1 }, { ...f(1, 6), count: 4 }]);
    game = apply(placeTile(game, "1/2"));
    const tileId = tileIdAt(game, 0);
    for (let count = 1; count <= 3; count += 1) {
      game = apply(dropOnTile(game, tileId, "1/6"));
      expect(game.tiles[0]?.coverCount).toBe(count);
      expect(game.tiles[0]?.takenKey).toBeNull();
    }
    game = apply(dropOnTile(game, tileId, "1/6"));
    expect(game.tiles[0]?.takenKey).toBe("1/6");
    expect(isSolved(game)).toBe(true);
  });

  it("全部取ったひき算は 0 まいぶんと数える", () => {
    let game = customGame(f(1, 2), "-", f(1, 2), [{ ...f(1, 2), count: 2 }]);
    game = apply(placeTile(game, "1/2"));
    game = apply(dropOnTile(game, tileIdAt(game, 0), "1/2"));
    expect(isSolved(game)).toBe(true);
    expect(rulerCount(game)).toEqual({ den: 2, count: 0 });
  });

  it("undoOnTile は取ったタイル、重ねたタイルの順に戻す", () => {
    let game = solveByHand(gameOf(SUBTRACT));
    const tileId = tileIdAt(game, 0);
    game = undoOnTile(game, tileId);
    expect(game.tiles[0]?.takenKey).toBeNull();
    expect(game.tiles[0]?.coverCount).toBe(5);
    game = undoOnTile(game, tileId);
    expect(game.tiles[0]?.coverCount).toBe(4);
    const plain = apply(placeTile(gameOf(ADD), "1/2"));
    expect(undoOnTile(plain, tileIdAt(plain, 0))).toBe(plain);
  });
});

describe("ヒントと動き", () => {
  it("ヒントは順に1つずつ増え、最後で止まる", () => {
    const hints = ["一", "二"];
    expect(revealNextHint(hints, 0)).toBe(1);
    expect(revealNextHint(hints, 1)).toBe(2);
    expect(revealNextHint(hints, 2)).toBe(2);
  });

  it("動きを減らす設定では、スクロールをすべらせない", () => {
    expect(scrollBehaviorFor(true)).toBe("auto");
    expect(scrollBehaviorFor(false)).toBe("smooth");
  });
});

describe("わり算と分数の盤", () => {
  // 子どもと同じ操作：1/b のタイルを a まい、ものさしに置く
  function solveDivide(dividend: number, divisor: number): TileGame {
    let game = lessonGameOf(divideProblem(dividend, divisor));
    for (let count = 0; count < dividend; count += 1) game = apply(placeTile(game, `1/${divisor}`));
    return game;
  }

  it.each([[3, 4], [7, 3], [6, 3], [5, 2]])("%i÷%i は 1/b を a まい並べると解けて、上限に収まる", (dividend, divisor) => {
    const problem = divideProblem(dividend, divisor);
    expect(tileLimitReason(problem)).toBeNull();
    expect(problem.pieces).toEqual([{ num: 1, den: divisor, count: dividend + 1 }]);
    const start = lessonGameOf(problem);
    expect(start.problem.answer).toEqual(f(dividend, divisor)); // 約分しない
    expect(commonUnit(start).key).toBe(`1/${divisor}`);
    expect(isSolved(start)).toBe(false);
    const solved = solveDivide(dividend, divisor);
    expect(isSolved(solved)).toBe(true);
    expect(rulerCount(solved)).toEqual({ den: divisor, count: dividend });
    expect(rulerWholes(solved.problem)).toBe(Math.ceil(dividend / divisor));
  });

  it("1まい足りなくても、1まい多くても解けていない。多い1まいは外すと解ける", () => {
    const solved = solveDivide(3, 4);
    expect(isSolved(removeTile(solved, tileIdAt(solved, 0)))).toBe(false);
    const extra = apply(placeTile(solved, "1/4"));
    expect(isSolved(extra)).toBe(false);
    expect(isSolved(removeTile(extra, tileIdAt(extra, 3)))).toBe(true);
  });

  it("押して置く操作でも、a まいまで続けて置ける", () => {
    let game = lessonGameOf(divideProblem(7, 3));
    for (let count = 0; count < 7; count += 1) game = apply(pressOnRuler(game, "1/3"));
    expect(isSolved(game)).toBe(true);
    expect(pressOnRuler(game, "1/3").notice).toBe("already_full");
  });

  it("重ねる操作はできず、ものさしの続きに置かれる", () => {
    const placed = apply(placeTile(lessonGameOf(divideProblem(3, 4)), "1/4"));
    const dropped = apply(dropOnTile(placed, tileIdAt(placed, 0), "1/4"));
    expect(dropped.tiles.map((tile) => tile.coverKey)).toEqual([null, null]);
  });
});

describe("同じ大きさの分数の盤", () => {
  // 子どもと同じ操作：もとのタイルを置いて、1/target のタイルを重ねてうめる
  function solveEquivalent(num: number, den: number, target: number): TileGame {
    let game = apply(placeTile(lessonGameOf(equivalentProblem(f(num, den), target)), `${num}/${den}`));
    const tileId = tileIdAt(game, 0);
    for (let count = 0; count < (num * target) / den; count += 1) game = apply(dropOnTile(game, tileId, `1/${target}`));
    return game;
  }

  it.each([[1, 2, 4, 2], [4, 6, 3, 2], [3, 4, 12, 9], [6, 8, 4, 3]])("%i/%i = □/%i は、1/target で数まいうめると解けて、上限に収まる", (num, den, target, answerNum) => {
    const problem = equivalentProblem(f(num, den), target);
    expect(tileLimitReason(problem)).toBeNull();
    const start = lessonGameOf(problem);
    expect(start.problem.answer).toEqual(f(answerNum, target)); // 約分しない
    expect(commonUnit(start).key).toBe(`1/${target}`);
    expect(isSolved(start)).toBe(false);
    const solved = solveEquivalent(num, den, target);
    expect(isSolved(solved)).toBe(true);
    expect(alignedExpression(solved).left).toEqual(f(answerNum, target));
    expect(rulerCount(solved)).toEqual({ den: target, count: answerNum });
  });

  it("うめ終わるまでは解けず、多く重ねられない", () => {
    const solved = solveEquivalent(1, 2, 4);
    const half = lessonGameOf(equivalentProblem(f(1, 2), 4));
    const once = apply(dropOnTile(apply(placeTile(half, "1/2")), 1, "1/4"));
    expect(isSolved(once)).toBe(false);
    expect(dropOnTile(solved, 1, "1/4").notice).toBe("already_full");
  });

  it("1枚でうまる大きいタイルでも解ける（2/6 を 1/3 で）", () => {
    const solved = solveEquivalent(2, 6, 3);
    expect(isSolved(solved)).toBe(true);
    expect(alignedExpression(solved).left).toEqual(f(1, 3));
  });

  it("ものさしには、もとのタイルしか置けない", () => {
    expect(placeTile(lessonGameOf(equivalentProblem(f(4, 6), 3)), "1/3").notice).toBe("cover_tile");
  });
});
