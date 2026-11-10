import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../data";
import type { Chapter } from "../data";
import { fractionsEqual } from "./fraction";
import type { Fraction } from "./fraction";
import { findLesson, hasLessons, lessonKey } from "./fraction-lessons";
import { gameOf, hasTiles } from "./problems";
import type { LessonDefinition } from "./problems";
import type { LessonProblem } from "./problems";
import { canAnswer, correctChoice, createSession, submitAnswer, submitChoice, toReview, typeAnswer, typePart } from "./session";
import type { LessonSession } from "./session";
import { alignedExpression, commonUnit, dropOnTile, isSolved, placeTile, pressOnRuler, remainingCount, stacksOnPress } from "./tiles";
import type { TileGame, TileResult } from "./tiles";
import { guideParts } from "./wording";

const chapter = CHAPTERS.find((candidate) => candidate.id === "fraction") as Chapter;

const keyOf = ({ num, den }: Fraction): string => `${num}/${den}`;

function done({ game, notice }: TileResult): TileGame {
  if (notice) throw new Error(`操作が断られた: ${notice}`);
  return game;
}

function fill(start: TileGame, tileId: number, value: Fraction): TileGame {
  const unit = commonUnit(start);
  if (keyOf(value) === unit.key) return start;
  let game = start;
  for (let count = 0; count < (value.num * unit.den) / value.den; count += 1) game = done(dropOnTile(game, tileId, unit.key));
  return game;
}

// 子どもと同じ操作で解く。用意した枚数で足りないと、途中で断られて失敗する
function solveByHand(start: TileGame): TileGame {
  const { left, right, operator, isRewrite } = start.problem;
  const placed = done(placeTile(start, keyOf(left)));
  const leftId = placed.tiles[0]?.id ?? -1;
  if (isRewrite) return fill(placed, leftId, left);
  if (operator === "-") return done(dropOnTile(fill(placed, leftId, left), leftId, keyOf(right)));
  const both = done(placeTile(placed, keyOf(right)));
  return fill(fill(both, leftId, left), both.tiles[1]?.id ?? -1, right);
}

// タイルで解く学習は、解いて式にもどり、□ を確かめてから答える
function reviewed(session: LessonSession): LessonSession {
  if (canAnswer(session)) return session;
  const solved = toReview({ ...session, game: solveByHand(session.game) });
  const { left, right } = alignedExpression(solved.game);
  return submitAnswer(typePart(typePart(solved, 0, String(left.num)), 1, String(right.num)));
}

function answered(start: LessonSession, problem: LessonProblem): LessonSession {
  const session = reviewed(start);
  if (problem.kind === "compare" || problem.kind === "estimate") return submitChoice(session, correctChoice(session) ?? "same");
  if (problem.kind === "common") {
    const { left, right } = alignedExpression(solveByHand(session.game));
    return submitAnswer(typePart(typePart(session, 0, keyOf(left)), 1, keyOf(right)));
  }
  return submitAnswer(typeAnswer(session, keyOf(session.game.problem.answer)));
}

const FRACTION_LESSONS: LessonDefinition[] = [
  ...[3, 4, 5, 6, 7, 8].map((index) => findLesson("fraction", { kind: "main", index })),
  findLesson("fraction", { kind: "test" }),
  ...chapter.sides.map((side) => findLesson("fraction", { kind: "side", sideId: side.id })),
].filter((lesson): lesson is LessonDefinition => lesson !== undefined);

// 章のテストには、わり算と分数・同じ大きさの分数・数の問題も入る。この解き方（タイルの手順）は、それ以外の分数の問題用なので除く。
// 新しい種類の問題の解き方は、それぞれの関数のテスト（makers/）と、画面の通しのテストで確かめる
const NEW_KINDS: string[] = ["divide", "equivalent", "number"];
const allProblems = FRACTION_LESSONS.flatMap((lesson) => lesson.problems.map((problem, index) => ({ lesson, problem, index })))
  .filter(({ problem }) => !NEW_KINDS.includes(problem.kind));

describe("分数の章の学習", () => {
  it("まだ終えていないマス、章のテスト、寄り道の全部に学習がある", () => {
    const openIndexes = [3, 4, 5, 6, 7, 8];
    for (const index of openIndexes) expect(findLesson("fraction", { kind: "main", index })?.id).toBe(`main-${index}`);
    expect(findLesson("fraction", { kind: "test" })).toBeDefined();
    for (const side of chapter.sides) expect(findLesson("fraction", { kind: "side", sideId: side.id })?.id).toBe(side.id);
  });

  it("分数の本線の最初の3マスも学習がある", () => {
    for (const index of [0, 1, 2]) expect(findLesson("fraction", { kind: "main", index })?.problems).toHaveLength(5);
    expect(findLesson("fraction", { kind: "test" })?.problems).toHaveLength(9);
  });

  it("分数の最初の3マスは、問題の前に図解を見せる。ほかの学習には図解が無い", () => {
    expect([0, 1, 2].map((index) => findLesson("fraction", { kind: "main", index })?.intro)).toEqual(["division", "decimal", "equivalent"]);
    expect(findLesson("fraction", { kind: "main", index: 3 })?.intro).toBeUndefined();
    expect(findLesson("fraction", { kind: "test" })?.intro).toBeUndefined();
    expect(findLesson("integer", { kind: "main", index: 0 })?.intro).toBeUndefined();
  });

  it("整数・小数・□と△の式も、本線の全マス・章のテスト・かくにんの寄り道に学習がある", () => {
    for (const chapterId of ["integer", "decimal", "expression"]) {
      const target = CHAPTERS.find((candidate) => candidate.id === chapterId) as Chapter;
      target.items.forEach((_, index) => expect(findLesson(chapterId, { kind: "main", index })?.id, `${chapterId} ${index}`).toBe(`main-${index}`));
      expect(findLesson(chapterId, { kind: "test" })?.problems).toHaveLength(target.items.length);
      for (const side of target.sides.filter((candidate) => candidate.type === "training")) {
        expect(findLesson(chapterId, { kind: "side", sideId: side.id })?.id, side.id).toBe(side.id);
      }
      expect(hasLessons(chapterId)).toBe(true);
    }
  });

  it("整数と小数の応用、ほかの章、存在しないマスは undefined", () => {
    expect(findLesson("integer", { kind: "side", sideId: "integer-a" })).toBeUndefined();
    expect(findLesson("decimal", { kind: "side", sideId: "decimal-a" })).toBeUndefined();
    expect(findLesson("plane", { kind: "main", index: 0 })).toBeUndefined();
    expect(findLesson("fraction", { kind: "main", index: 9 })).toBeUndefined();
    expect(hasLessons("plane")).toBe(false);
    expect(hasLessons("fraction")).toBe(true);
  });

  it("学習の名前は重ならず、道に使える形", () => {
    const ids = FRACTION_LESSONS.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    expect(lessonKey({ kind: "main", index: 3 })).toBe("main-3");
    expect(lessonKey({ kind: "test" })).toBe("test");
    expect(lessonKey({ kind: "side", sideId: "fraction-a" })).toBe("fraction-a");
  });

  it("問題は毎回同じで、どの学習にも1問以上ある", () => {
    for (const lesson of FRACTION_LESSONS) expect(lesson.problems.length).toBeGreaterThan(0);
    expect(findLesson("fraction", { kind: "main", index: 3 })).toBe(findLesson("fraction", { kind: "main", index: 3 }));
  });

  it("分母はタイルの幅が狭くなりすぎない 24 まで（タイルの上限 PB-21 と同じ）", () => {
    for (const { problem } of allProblems) for (const piece of problem.pieces) expect(piece.den).toBeLessThanOrEqual(24);
  });
});

describe("分数の章の全部の問題", () => {
  it.each(allProblems.map(({ lesson, problem, index }) => [`${lesson.id} の ${index + 1}問目`, lesson, problem, index] as const))(
    "%s は正解できる", (_name, lesson, problem, index) => {
      const session = answered(createSession(lesson, index), problem);
      expect(session.message).toBe("correct");
      expect(session.isCorrect).toBe(true);
      expect(session.isCleared).toBe(index === lesson.problems.length - 1);
    },
  );

  const tileProblems = allProblems.filter(({ problem }) => hasTiles(problem));

  it.each(tileProblems.map(({ lesson, problem, index }) => [`${lesson.id} の ${index + 1}問目`, problem] as const))(
    "%s は用意したタイルで解ける", (_name, problem) => {
      const game = gameOf(problem);
      guideParts(game);
      const solved = solveByHand(game);
      expect(isSolved(solved)).toBe(true);
      for (const piece of solved.pieces) expect(remainingCount(solved, piece.key)).toBeGreaterThanOrEqual(0);
      const aligned = alignedExpression(solved);
      expect(fractionsEqual(aligned.left, solved.problem.left)).toBe(true);
    },
  );

  it("ヒントはどの問題にも1つ以上あり、案内のくり返しにならない", () => {
    for (const { problem } of allProblems) {
      expect(problem.hints.length).toBeGreaterThan(0);
      expect(new Set(problem.hints).size).toBe(problem.hints.length);
    }
  });

  it("タイルのある問題は、用意したタイルだけで「ものさしに置く」を押して解ける", () => {
    for (const { problem } of allProblems.filter((entry) => hasTiles(entry.problem))) {
      let game = gameOf(problem);
      const { left, right, operator, isRewrite } = game.problem;
      game = done(pressOnRuler(game, keyOf(left)));
      if (!isRewrite && operator === "+") game = done(pressOnRuler(game, keyOf(right)));
      const unit = commonUnit(game).key;
      while (stacksOnPress(game, unit) && !isSolved(game)) game = done(pressOnRuler(game, unit));
      if (operator === "-" && !isRewrite && !isSolved(game)) game = done(pressOnRuler(game, keyOf(right)));
      expect(isSolved(game)).toBe(true);
    }
  });

  it("類題は、前の問題で答えが出た式をくり返さない", () => {
    for (const lesson of FRACTION_LESSONS) {
      const expressions = lesson.problems.map((problem) => ("operator" in problem ? `${keyOf(problem.left)}${problem.operator}${keyOf(problem.right)}` : null)).filter(Boolean);
      expect(new Set(expressions).size).toBe(expressions.length);
    }
  });

  it("見積もりのヒントは、その式の分数を見て考えられる", () => {
    for (const { problem } of allProblems) {
      if (problem.kind === "estimate") expect(problem.hints[0]).toContain(keyOf(problem.left));
    }
  });

  it("タイルで解く学習の問題は、たし算だけ", () => {
    const lesson = findLesson("fraction", { kind: "side", sideId: "fraction-t2" });
    for (const problem of lesson?.problems ?? []) expect(problem.kind === "calculate" && problem.operator).toBe("+");
  });
});

describe("寄り道の問題は、その時点で習った範囲", () => {
  const sideAfter = (id: string): number => chapter.sides.find((side) => side.id === id)?.after ?? -1;
  // マス（0 始まり）の番号。通分は 4、たし算は 6、ひき算は 7
  const FIRST_ADD = 6;
  const FIRST_SUBTRACT = 7;

  it("約分と通分のかくにん（after:5）は、約分と通分だけで、答えの表の通り", () => {
    const lesson = findLesson("fraction", { kind: "side", sideId: "fraction-t1" });
    expect(sideAfter("fraction-t1")).toBeLessThan(FIRST_ADD);
    expect(lesson?.problems.map((problem) => problem.kind)).toEqual(["reduce", "common", "common", "reduce", "common"]);
    const [reduce, common, third] = lesson?.problems ?? [];
    expect(reduce?.kind === "reduce" && keyOf(gameOf(reduce).problem.answer)).toBe("3/4");
    expect(common?.kind === "common" && [keyOf(alignedExpression(solveByHand(gameOf(common))).left), keyOf(alignedExpression(solveByHand(gameOf(common))).right)]).toEqual(["9/12", "2/12"]);
    expect(third?.kind === "common" && [keyOf(alignedExpression(solveByHand(gameOf(third))).left), keyOf(alignedExpression(solveByHand(gameOf(third))).right)]).toEqual(["10/12", "9/12"]);
  });

  it("答えを見積もる（after:7）は、見積もりだけで、答えがしきい値と等しくならない", () => {
    const lesson = findLesson("fraction", { kind: "side", sideId: "fraction-a" });
    expect(sideAfter("fraction-a")).toBeGreaterThan(FIRST_ADD);
    expect(sideAfter("fraction-a")).toBeLessThan(FIRST_SUBTRACT + 1);
    const answers = (lesson?.problems ?? []).map((problem) => {
      if (problem.kind !== "estimate") throw new Error("見積もりではない問題がある");
      const session = createSession(lesson as NonNullable<typeof lesson>, lesson?.problems.indexOf(problem) ?? 0);
      return correctChoice(session);
    });
    expect(answers).toEqual(["above", "below", "above", "above", "above"]);
  });
});
