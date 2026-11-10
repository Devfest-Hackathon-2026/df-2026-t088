import { describe, expect, it } from "vitest";
import type { NumberProblem } from "../number-problem";
import { problemIdOf } from "./format";
import {
  INTEGER_COMMON_DIVISORS, INTEGER_COMMON_MULTIPLE, INTEGER_DIVISORS, INTEGER_GCD, INTEGER_LCM, INTEGER_MAKERS,
  INTEGER_MULTIPLES, INTEGER_PARITY,
} from "./integer";
import type { Arg, ProblemMaker } from "./types";

const ok = (maker: ProblemMaker, args: unknown[]): boolean => maker.check(args).ok;

function made(maker: ProblemMaker, args: unknown[]): NumberProblem {
  const checked = maker.check(args);
  if (!checked.ok) throw new Error(checked.reason);
  const problem = maker.build(checked.args);
  if (problem.kind !== "number") throw new Error("数の問題ではありません");
  return problem;
}

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, index) => from + index);

describe("関数の一覧", () => {
  it("7つで、どれも数の問題", () => {
    expect(INTEGER_MAKERS.map((maker) => maker.name)).toEqual([
      "integer.parity", "integer.divisors", "integer.multiples", "integer.commonDivisors",
      "integer.gcd", "integer.commonMultiple", "integer.lcm",
    ]);
    expect(INTEGER_MAKERS.every((maker) => maker.kind === "number")).toBe(true);
  });
});

describe("integer.parity", () => {
  const maker = INTEGER_PARITY;

  it("check：0〜100 の整数", () => {
    expect(ok(maker, [0])).toBe(true);
    expect(ok(maker, [100])).toBe(true);
    expect(ok(maker, [-1])).toBe(false);
    expect(ok(maker, [101])).toBe(false);
    expect(ok(maker, [1.5])).toBe(false);
    expect(ok(maker, ["14"])).toBe(false);
    expect(ok(maker, [])).toBe(false);
    expect(ok(maker, [14, 2])).toBe(false);
  });

  it("build：0 は偶数", () => {
    expect(made(maker, [14]).answer).toEqual({ type: "choice", options: ["even", "odd"], correct: "even" });
    expect(made(maker, [14]).topic).toEqual({ t: "parity", n: 14, even: true });
    expect(made(maker, [27]).answer).toMatchObject({ correct: "odd" });
    expect(made(maker, [0]).topic).toEqual({ t: "parity", n: 0, even: true });
    expect(made(maker, [99]).topic).toEqual({ t: "parity", n: 99, even: false });
    expect(() => maker.build([101])).toThrow(RangeError);
  });

  it("problemId", () => {
    expect(problemIdOf(maker.name, [14])).toBe("integer.parity(14)");
  });

  it("verify：落ちる例", () => {
    const even = made(maker, [14]);
    expect(maker.verify(even)).toBeNull();
    expect(maker.verify({ ...even, answer: { type: "choice", options: ["even", "odd"], correct: "odd" } })).toMatch(/正解/);
    expect(maker.verify({ ...even, topic: { t: "parity", n: 14, even: false } })).toMatch(/even/);
    expect(maker.verify({ ...even, hints: [...even.hints.slice(0, 2), "[偶数|ぐうすう]です"] })).toMatch(/偶数です/);
    expect(maker.verify({ ...even, hints: [...even.hints.slice(0, 2), "[偶数|ぐうすう]は 2 でわり切れる数です"] })).toBeNull();
    const odd = made(maker, [27]);
    expect(maker.verify({ ...odd, hints: [...odd.hints.slice(0, 2), "[奇数|きすう]になります"] })).toMatch(/奇数になります/);
  });

  it("verify：範囲のすべての数で通る", () => {
    for (let n = 0; n <= 100; n += 1) expect(maker.verify(made(maker, [n])), `${n}`).toBeNull();
  });
});

describe("integer.divisors", () => {
  const maker = INTEGER_DIVISORS;

  it("check：2〜36", () => {
    expect(ok(maker, [2])).toBe(true);
    expect(ok(maker, [36])).toBe(true);
    expect(ok(maker, [1])).toBe(false);
    expect(ok(maker, [37])).toBe(false);
    expect(ok(maker, [12.5])).toBe(false);
    expect(ok(maker, ["12"])).toBe(false);
    expect(ok(maker, [12, 8])).toBe(false);
  });

  it("build：札は 1〜n、答えは約数", () => {
    const problem = made(maker, [12]);
    expect(problem.answer).toEqual({ type: "multi", cards: range(1, 12), correct: [1, 2, 3, 4, 6, 12] });
    expect(problem.topic).toEqual({ t: "divisors", n: 12, list: [1, 2, 3, 4, 6, 12] });
    expect(made(maker, [7]).answer).toMatchObject({ correct: [1, 7] });
    expect(made(maker, [36]).answer).toMatchObject({ cards: range(1, 36), correct: [1, 2, 3, 4, 6, 9, 12, 18, 36] });
    expect(() => maker.build([37])).toThrow(RangeError);
  });

  it("problemId", () => {
    expect(problemIdOf(maker.name, [12])).toBe("integer.divisors(12)");
  });

  it("verify：落ちる例。ヒントに「1」は出てよいが、答えの並び全体は出せない", () => {
    const problem = made(maker, [12]);
    expect(maker.verify(problem)).toBeNull();
    expect(problem.hints.some((hint) => hint.includes("1"))).toBe(true);
    expect(maker.verify({ ...problem, hints: [...problem.hints.slice(0, 2), "1, 2, 3, 4, 6, 12 です"] })).toMatch(/1, 2, 3, 4, 6, 12/);
    expect(maker.verify({ ...problem, answer: { type: "multi", cards: range(1, 12), correct: [1, 2, 3, 4, 6] } })).toMatch(/答え/);
    expect(maker.verify({ ...problem, answer: { type: "multi", cards: range(1, 11), correct: [1, 2, 3, 4, 6, 12] } })).toMatch(/札/);
    expect(maker.verify({ ...problem, topic: { t: "divisors", n: 12, list: [1, 2, 3] } })).toMatch(/list/);
  });

  it("verify：範囲のすべての数で通る", () => {
    for (let n = 2; n <= 36; n += 1) expect(maker.verify(made(maker, [n])), `${n}`).toBeNull();
  });
});

describe("integer.multiples", () => {
  const maker = INTEGER_MULTIPLES;

  it("check：k 2〜12、upTo 12〜36、倍数が 2 つ以上", () => {
    expect(ok(maker, [2, 12])).toBe(true);
    expect(ok(maker, [12, 36])).toBe(true);
    expect(ok(maker, [1, 12])).toBe(false);
    expect(ok(maker, [13, 36])).toBe(false);
    expect(ok(maker, [3, 11])).toBe(false);
    expect(ok(maker, [3, 37])).toBe(false);
    // 12 以下の数のうち、倍数が 1 つしか無い組
    expect(ok(maker, [7, 12])).toBe(false);
    expect(ok(maker, [6, 12])).toBe(true);
    expect(ok(maker, [3.5, 30])).toBe(false);
    expect(ok(maker, ["3", 30])).toBe(false);
    expect(ok(maker, [3])).toBe(false);
  });

  it("build：札は 1〜upTo、0 は入れない", () => {
    const problem = made(maker, [3, 30]);
    expect(problem.answer).toEqual({ type: "multi", cards: range(1, 30), correct: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30] });
    expect(problem.topic).toEqual({ t: "multiples", k: 3, upTo: 30, list: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30] });
    expect(made(maker, [8, 36]).answer).toMatchObject({ correct: [8, 16, 24, 32] });
    expect(made(maker, [4, 20]).answer).toMatchObject({ correct: [4, 8, 12, 16, 20] });
    expect(() => maker.build([7, 12])).toThrow(RangeError);
  });

  it("problemId", () => {
    expect(problemIdOf(maker.name, [3, 30])).toBe("integer.multiples(3,30)");
  });

  it("verify：落ちる例", () => {
    const problem = made(maker, [8, 36]);
    expect(maker.verify(problem)).toBeNull();
    expect(maker.verify({ ...problem, hints: [...problem.hints.slice(0, 2), "8, 16, 24, 32 です"] })).toMatch(/8, 16, 24, 32/);
    expect(maker.verify({ ...problem, answer: { type: "multi", cards: range(1, 36), correct: [0, 8, 16, 24, 32] } })).toMatch(/答え/);
    expect(maker.verify({ ...problem, answer: { type: "multi", cards: range(1, 36), correct: [8, 16, 24] } })).toMatch(/答え/);
  });

  it("verify：範囲のすべての数で通る", () => {
    for (let k = 2; k <= 12; k += 1) {
      for (let upTo = 12; upTo <= 36; upTo += 1) {
        if (!ok(maker, [k, upTo])) continue;
        expect(maker.verify(made(maker, [k, upTo])), `${k},${upTo}`).toBeNull();
      }
    }
  });
});

describe("integer.commonDivisors", () => {
  const maker = INTEGER_COMMON_DIVISORS;

  it("check：どちらも 2〜36", () => {
    expect(ok(maker, [2, 36])).toBe(true);
    expect(ok(maker, [1, 12])).toBe(false);
    expect(ok(maker, [12, 37])).toBe(false);
    expect(ok(maker, [8, 12.5])).toBe(false);
    expect(ok(maker, ["8", 12])).toBe(false);
    expect(ok(maker, [8])).toBe(false);
    expect(ok(maker, [8, 12, 2])).toBe(false);
  });

  it("build：札は 1〜小さい方", () => {
    const problem = made(maker, [8, 12]);
    expect(problem.answer).toEqual({ type: "multi", cards: range(1, 8), correct: [1, 2, 4] });
    expect(problem.topic).toEqual({ t: "commonDivisors", a: 8, b: 12, list: [1, 2, 4] });
    expect(made(maker, [12, 8]).answer).toMatchObject({ cards: range(1, 8), correct: [1, 2, 4] });
    expect(made(maker, [12, 18]).answer).toMatchObject({ correct: [1, 2, 3, 6] });
    expect(made(maker, [8, 9]).answer).toMatchObject({ correct: [1] });
    expect(() => maker.build([1, 12])).toThrow(RangeError);
  });

  it("problemId", () => {
    expect(problemIdOf(maker.name, [8, 12])).toBe("integer.commonDivisors(8,12)");
  });

  it("verify：落ちる例", () => {
    const problem = made(maker, [8, 12]);
    expect(maker.verify(problem)).toBeNull();
    expect(maker.verify({ ...problem, hints: [...problem.hints.slice(0, 2), "1, 2, 4 です"] })).toMatch(/1, 2, 4/);
    expect(maker.verify({ ...problem, answer: { type: "multi", cards: range(1, 12), correct: [1, 2, 4] } })).toMatch(/札/);
    expect(maker.verify({ ...problem, answer: { type: "multi", cards: range(1, 8), correct: [1, 2, 4, 8] } })).toMatch(/答え/);
    // 公約数が 1 だけの組では、ヒントの「1」も答え
    const coprime = made(maker, [8, 9]);
    expect(maker.verify({ ...coprime, hints: [...coprime.hints.slice(0, 2), "答えは 1 だけです"] })).toMatch(/1/);
  });

  it("verify：範囲のすべての数で通る", () => {
    for (let a = 2; a <= 36; a += 1) {
      for (let b = 2; b <= 36; b += 1) expect(maker.verify(made(maker, [a, b])), `${a},${b}`).toBeNull();
    }
  });
});

describe("integer.gcd", () => {
  const maker = INTEGER_GCD;

  it("check：どちらも 2〜100", () => {
    expect(ok(maker, [2, 100])).toBe(true);
    expect(ok(maker, [1, 24])).toBe(false);
    expect(ok(maker, [16, 101])).toBe(false);
    expect(ok(maker, [16, 24.5])).toBe(false);
    expect(ok(maker, ["16", 24])).toBe(false);
    expect(ok(maker, [16])).toBe(false);
  });

  it("build：answer は最大公約数、list は公約数", () => {
    const problem = made(maker, [16, 24]);
    expect(problem.answer).toEqual({ type: "integer", value: 8 });
    expect(problem.topic).toEqual({ t: "gcd", a: 16, b: 24, list: [1, 2, 4, 8], answer: 8 });
    expect(made(maker, [30, 45]).answer).toEqual({ type: "integer", value: 15 });
    expect(made(maker, [97, 100]).answer).toEqual({ type: "integer", value: 1 });
    expect(made(maker, [4, 8]).answer).toEqual({ type: "integer", value: 4 });
    expect(() => maker.build([16, 101])).toThrow(RangeError);
  });

  it("problemId", () => {
    expect(problemIdOf(maker.name, [16, 24])).toBe("integer.gcd(16,24)");
  });

  it("verify：落ちる例", () => {
    const problem = made(maker, [16, 24]);
    expect(maker.verify(problem)).toBeNull();
    expect(maker.verify({ ...problem, answer: { type: "integer", value: 4 } })).toMatch(/答え/);
    expect(maker.verify({ ...problem, hints: [...problem.hints.slice(0, 2), "答えは 8 です"] })).toMatch(/8/);
    expect(maker.verify({ ...problem, topic: { t: "gcd", a: 16, b: 24, list: [1, 2, 4], answer: 8 } })).toMatch(/list/);
    expect(maker.verify({ ...problem, topic: { t: "gcd", a: 16, b: 24, list: [1, 2, 4, 8], answer: 4 } })).toMatch(/answer/);
  });

  it("verify：範囲のすべての数で通る", () => {
    for (let a = 2; a <= 100; a += 1) {
      for (let b = 2; b <= 100; b += 7) expect(maker.verify(made(maker, [a, b])), `${a},${b}`).toBeNull();
    }
  });
});

describe("integer.commonMultiple", () => {
  const maker = INTEGER_COMMON_MULTIPLE;

  it("check：a・b は 2〜20、nth は 1〜3、答えは 100 以下", () => {
    expect(ok(maker, [8, 12, 1])).toBe(true);
    expect(ok(maker, [8, 12, 2])).toBe(true);
    expect(ok(maker, [8, 12, 3])).toBe(true);
    expect(ok(maker, [8, 12, 4])).toBe(false);
    expect(ok(maker, [8, 12, 0])).toBe(false);
    // 最小公倍数 24 の 4 番目は 96 だが nth は 3 まで。20 と 15 は 60 で、2 番目が 120
    expect(ok(maker, [20, 15, 1])).toBe(true);
    expect(ok(maker, [20, 15, 2])).toBe(false);
    expect(ok(maker, [1, 12, 1])).toBe(false);
    expect(ok(maker, [8, 21, 1])).toBe(false);
    expect(ok(maker, [19, 20, 1])).toBe(false);
    expect(ok(maker, [8, 12.5, 1])).toBe(false);
    expect(ok(maker, ["8", 12, 1])).toBe(false);
    expect(ok(maker, [8, 12])).toBe(false);
  });

  it("build：小さいほうから nth 番目、list は 1〜nth 番目", () => {
    const problem = made(maker, [8, 12, 2]);
    expect(problem.answer).toEqual({ type: "integer", value: 48 });
    expect(problem.topic).toEqual({ t: "commonMultiple", a: 8, b: 12, nth: 2, list: [24, 48] });
    expect(made(maker, [8, 12, 1]).answer).toEqual({ type: "integer", value: 24 });
    expect(made(maker, [8, 12, 3]).answer).toEqual({ type: "integer", value: 72 });
    expect(made(maker, [4, 8, 3]).topic).toMatchObject({ list: [8, 16, 24] });
    expect(() => maker.build([8, 12, 4])).toThrow(RangeError);
  });

  it("problemId", () => {
    expect(problemIdOf(maker.name, [8, 12, 2])).toBe("integer.commonMultiple(8,12,2)");
  });

  it("verify：落ちる例", () => {
    const problem = made(maker, [8, 12, 2]);
    expect(maker.verify(problem)).toBeNull();
    expect(maker.verify({ ...problem, answer: { type: "integer", value: 24 } })).toMatch(/答え/);
    expect(maker.verify({ ...problem, hints: [...problem.hints.slice(0, 2), "答えは 48 です"] })).toMatch(/48/);
    expect(maker.verify({ ...problem, hints: [...problem.hints.slice(0, 2), "24, 48 です"] })).toMatch(/48/);
    expect(maker.verify({ ...problem, topic: { t: "commonMultiple", a: 8, b: 12, nth: 2, list: [24] } })).toMatch(/list/);
  });

  it("verify：範囲のすべての数で通る", () => {
    for (let a = 2; a <= 20; a += 1) {
      for (let b = 2; b <= 20; b += 1) {
        for (let nth = 1; nth <= 3; nth += 1) {
          if (!ok(maker, [a, b, nth])) continue;
          expect(maker.verify(made(maker, [a, b, nth])), `${a},${b},${nth}`).toBeNull();
        }
      }
    }
  });
});

describe("integer.lcm", () => {
  const maker = INTEGER_LCM;

  it("check：どちらも 2〜20、答えは 100 以下", () => {
    expect(ok(maker, [4, 6])).toBe(true);
    expect(ok(maker, [20, 15])).toBe(true);
    expect(ok(maker, [20, 20])).toBe(true);
    expect(ok(maker, [1, 6])).toBe(false);
    expect(ok(maker, [4, 21])).toBe(false);
    // 17 と 7 は範囲内でも、119 で 100 を超える
    expect(ok(maker, [17, 7])).toBe(false);
    expect(ok(maker, [10, 10.5])).toBe(false);
    expect(ok(maker, ["4", 6])).toBe(false);
    expect(ok(maker, [4])).toBe(false);
  });

  it("build", () => {
    const problem = made(maker, [4, 6]);
    expect(problem.answer).toEqual({ type: "integer", value: 12 });
    expect(problem.topic).toEqual({ t: "lcm", a: 4, b: 6, answer: 12 });
    expect(made(maker, [10, 15]).answer).toEqual({ type: "integer", value: 30 });
    expect(made(maker, [3, 6]).answer).toEqual({ type: "integer", value: 6 });
    expect(() => maker.build([17, 7])).toThrow(RangeError);
  });

  it("problemId", () => {
    expect(problemIdOf(maker.name, [4, 6])).toBe("integer.lcm(4,6)");
  });

  it("verify：落ちる例", () => {
    const problem = made(maker, [4, 6]);
    expect(maker.verify(problem)).toBeNull();
    expect(maker.verify({ ...problem, answer: { type: "integer", value: 24 } })).toMatch(/答え/);
    expect(maker.verify({ ...problem, hints: [...problem.hints.slice(0, 2), "答えは 12 です"] })).toMatch(/12/);
    expect(maker.verify({ ...problem, topic: { t: "lcm", a: 4, b: 6, answer: 24 } })).toMatch(/answer/);
    expect(maker.verify({ ...problem, hints: problem.hints.slice(0, 1) })).toMatch(/ヒント/);
  });

  it("verify：範囲のすべての数で通る", () => {
    for (let a = 2; a <= 20; a += 1) {
      for (let b = 2; b <= 20; b += 1) {
        if (!ok(maker, [a, b])) continue;
        expect(maker.verify(made(maker, [a, b])), `${a},${b}`).toBeNull();
      }
    }
  });
});

describe("既定の出題表（default-plan.md）の行", () => {
  // main-0〜4、integer-t、テスト。範囲の端の行も含む
  const rows: [string, Arg[]][] = [
    ...[14, 27, 0, 99, 50].map((n): [string, Arg[]] => ["integer.parity", [n]]),
    ...[12, 8, 18, 7, 36].map((n): [string, Arg[]] => ["integer.divisors", [n]]),
    ["integer.multiples", [3, 30]], ["integer.multiples", [8, 36]], ["integer.multiples", [6, 36]],
    ["integer.multiples", [4, 20]], ["integer.multiples", [9, 36]],
    ["integer.commonDivisors", [8, 12]], ["integer.commonDivisors", [12, 18]],
    ["integer.gcd", [16, 24]], ["integer.gcd", [18, 27]], ["integer.gcd", [30, 45]],
    ["integer.commonMultiple", [8, 12, 1]], ["integer.commonMultiple", [8, 12, 2]],
    ["integer.lcm", [4, 6]], ["integer.lcm", [6, 9]], ["integer.lcm", [10, 15]],
    // integer-t
    ["integer.parity", [63]], ["integer.divisors", [20]], ["integer.multiples", [7, 35]],
    ["integer.divisors", [15]], ["integer.parity", [48]],
    // テスト
    ["integer.parity", [35]], ["integer.divisors", [16]], ["integer.multiples", [5, 30]],
    ["integer.gcd", [12, 20]], ["integer.lcm", [9, 12]],
  ];

  it.each(rows)("%s(%j) は check・build・verify を通り、args が変わらない", (name, args) => {
    const maker = INTEGER_MAKERS.find((entry) => entry.name === name);
    if (!maker) throw new Error(name);
    expect(maker.check(args)).toEqual({ ok: true, args });
    expect(maker.verify(maker.build(args))).toBeNull();
  });
});
