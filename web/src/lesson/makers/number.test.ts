import { describe, expect, it } from "vitest";
import type { NumberProblem } from "../number-problem";
import { problemIdOf } from "./format";
import {
  NUMBER_DECIMAL_TO_FRACTION, NUMBER_FRACTION_TO_DECIMAL, NUMBER_INT_TO_FRACTION, NUMBER_MAKERS, NUMBER_TERMINATES, stripRuby,
} from "./number";
import type { Arg, ProblemMaker } from "./types";

const ok = (maker: ProblemMaker, args: unknown[]): boolean => maker.check(args).ok;

/** check を通して build する */
function made(maker: ProblemMaker, args: unknown[]): NumberProblem {
  const checked = maker.check(args);
  if (!checked.ok) throw new Error(checked.reason);
  const problem = maker.build(checked.args);
  if (problem.kind !== "number") throw new Error("数の問題ではありません");
  return problem;
}

describe("関数の一覧", () => {
  it("4つで、どれも数の問題", () => {
    expect(NUMBER_MAKERS.map((maker) => maker.name)).toEqual([
      "number.fractionToDecimal", "number.decimalToFraction", "number.intToFraction", "number.terminates",
    ]);
    expect(NUMBER_MAKERS.every((maker) => maker.kind === "number")).toBe(true);
  });
});

describe("number.fractionToDecimal", () => {
  const maker = NUMBER_FRACTION_TO_DECIMAL;

  it("check：分母は 2・4・5・8・10・20 だけ、値は 3 以下の整数でない数", () => {
    expect(ok(maker, [1, 4])).toBe(true);
    expect(ok(maker, [3, 8])).toBe(true);
    expect(ok(maker, [3, 5])).toBe(true);
    expect(ok(maker, [1, 20])).toBe(true);
    expect(ok(maker, [1, 3])).toBe(false);
    expect(ok(maker, [1, 16])).toBe(false);
    expect(ok(maker, [1, 1])).toBe(false);
    expect(ok(maker, [1, 21])).toBe(false);
    expect(ok(maker, [0, 4])).toBe(false);
  });

  it("check：値の上限と、整数になる分数", () => {
    expect(ok(maker, [11, 4])).toBe(true);
    expect(ok(maker, [12, 4])).toBe(false);
    expect(ok(maker, [5, 2])).toBe(true);
    expect(ok(maker, [7, 2])).toBe(false);
    expect(ok(maker, [4, 2])).toBe(false);
  });

  it("check：型違いと個数", () => {
    expect(ok(maker, ["1", 4])).toBe(false);
    expect(ok(maker, [1.5, 4])).toBe(false);
    expect(ok(maker, [{ num: 1, den: 4 }])).toBe(false);
    expect(ok(maker, [1])).toBe(false);
    expect(ok(maker, [1, 4, 1])).toBe(false);
    expect(ok(maker, [Number.NaN, 4])).toBe(false);
  });

  it("build：答えと topic", () => {
    const problem = made(maker, [1, 4]);
    expect(problem.answer).toEqual({ type: "decimal", value: "0.25" });
    expect(problem.topic).toEqual({ t: "fractionToDecimal", value: { num: 1, den: 4 }, decimal: "0.25" });
    expect(problem.pieces).toEqual([]);
    expect(made(maker, [5, 2]).answer).toEqual({ type: "decimal", value: "2.5" });
    expect(made(maker, [3, 8]).answer).toEqual({ type: "decimal", value: "0.375" });
    expect(made(maker, [1, 20]).answer).toEqual({ type: "decimal", value: "0.05" });
  });

  it("build：check を通らない数は RangeError", () => {
    expect(() => maker.build([1, 3])).toThrow(RangeError);
  });

  it("problemId", () => {
    expect(problemIdOf(maker.name, [3, 8])).toBe("number.fractionToDecimal(3,8)");
  });

  it("verify：落ちる例", () => {
    const problem = made(maker, [1, 4]);
    expect(maker.verify(problem)).toBeNull();
    expect(maker.verify({ ...problem, answer: { type: "decimal", value: "0.3" } })).toMatch(/答え/);
    expect(maker.verify({ ...problem, hints: [...problem.hints.slice(0, 2), "答えは 0.25 です"] })).toMatch(/0\.25/);
    expect(maker.verify({ ...problem, hints: ["1 つだけ"] })).toMatch(/ヒント/);
    expect(maker.verify({ ...problem, topic: { t: "fractionToDecimal", value: { num: 1, den: 4 }, decimal: "0.3" } })).toMatch(/decimal/);
    expect(maker.verify(made(NUMBER_INT_TO_FRACTION, [2, 3]))).toMatch(/fractionToDecimal/);
  });

  it("verify：範囲のすべての数で通る（ヒントが答えを言わない）", () => {
    for (const den of [2, 4, 5, 8, 10, 20]) {
      for (let num = 1; num <= den * 3; num += 1) {
        if (!ok(maker, [num, den])) continue;
        expect(maker.verify(made(maker, [num, den])), `${num}/${den}`).toBeNull();
      }
    }
  });
});

describe("number.decimalToFraction", () => {
  const maker = NUMBER_DECIMAL_TO_FRACTION;

  it("check：小数第1〜3位、0 より大きく 10 より小さい、余分な 0 は付けない", () => {
    expect(ok(maker, ["0.13"])).toBe(true);
    expect(ok(maker, ["0.1"])).toBe(true);
    expect(ok(maker, ["0.001"])).toBe(true);
    expect(ok(maker, ["9.999"])).toBe(true);
    expect(ok(maker, ["0.0001"])).toBe(false);
    expect(ok(maker, ["3"])).toBe(false);
    expect(ok(maker, ["0"])).toBe(false);
    expect(ok(maker, ["0.0"])).toBe(false);
    expect(ok(maker, ["10.5"])).toBe(false);
    expect(ok(maker, ["10"])).toBe(false);
    expect(ok(maker, ["0.50"])).toBe(false);
    expect(ok(maker, [".5"])).toBe(false);
    expect(ok(maker, ["1.2.3"])).toBe(false);
  });

  it("check：型違いと個数", () => {
    expect(ok(maker, [0.13])).toBe(false);
    expect(ok(maker, [{ num: 13, den: 100 }])).toBe(false);
    expect(ok(maker, [])).toBe(false);
    expect(ok(maker, ["0.13", "0.2"])).toBe(false);
  });

  it("build：答えは約分しない {整数, 10^k}、topic は 1/10^k の個数", () => {
    const problem = made(maker, ["0.13"]);
    expect(problem.answer).toEqual({ type: "fraction", value: { num: 13, den: 100 } });
    expect(problem.topic).toEqual({
      t: "decimalToFraction", decimal: "0.13", unit: { num: 1, den: 100 }, count: 13, value: { num: 13, den: 100 },
    });
    expect(made(maker, ["0.5"]).answer).toEqual({ type: "fraction", value: { num: 5, den: 10 } });
    expect(made(maker, ["2.25"]).answer).toEqual({ type: "fraction", value: { num: 225, den: 100 } });
    expect(made(maker, ["0.007"]).topic).toMatchObject({ unit: { num: 1, den: 1000 }, count: 7 });
  });

  it("build：check を通らない数は RangeError", () => {
    expect(() => maker.build(["0.50"])).toThrow(RangeError);
    expect(() => maker.build([0.5])).toThrow(RangeError);
  });

  it("problemId：小数は文字のまま", () => {
    expect(problemIdOf(maker.name, ["0.13"])).toBe("number.decimalToFraction(0.13)");
  });

  it("verify：落ちる例", () => {
    const problem = made(maker, ["0.13"]);
    expect(maker.verify(problem)).toBeNull();
    expect(maker.verify({ ...problem, answer: { type: "fraction", value: { num: 13, den: 10 } } })).toMatch(/答え/);
    expect(maker.verify({ ...problem, hints: [...problem.hints.slice(0, 2), "13/100 です"] })).toMatch(/13\/100/);
    // 約分した形が答えでもある
    const half = made(maker, ["0.5"]);
    expect(maker.verify({ ...half, hints: [...half.hints.slice(0, 2), "1/2 です"] })).toMatch(/1\/2/);
    expect(maker.verify({
      ...problem,
      topic: { t: "decimalToFraction", decimal: "0.13", unit: { num: 1, den: 100 }, count: 12, value: { num: 13, den: 100 } },
    })).toMatch(/count/);
  });

  it("verify：1/10 の個数が 1 の数でも、ヒントが単位分数を言わない", () => {
    for (const decimal of ["0.1", "0.01", "0.001", "0.7", "9.999", "0.25"]) {
      expect(maker.verify(made(maker, [decimal])), decimal).toBeNull();
    }
  });
});

describe("number.intToFraction", () => {
  const maker = NUMBER_INT_TO_FRACTION;

  it("check：n は 1〜9、den は 1〜20", () => {
    expect(ok(maker, [1, 1])).toBe(true);
    expect(ok(maker, [9, 20])).toBe(true);
    expect(ok(maker, [0, 3])).toBe(false);
    expect(ok(maker, [10, 3])).toBe(false);
    expect(ok(maker, [2, 0])).toBe(false);
    expect(ok(maker, [2, 21])).toBe(false);
    expect(ok(maker, [2.5, 3])).toBe(false);
    expect(ok(maker, ["2", 3])).toBe(false);
    expect(ok(maker, [2])).toBe(false);
  });

  it("build：答えは分子 n × den", () => {
    const problem = made(maker, [2, 3]);
    expect(problem.answer).toEqual({ type: "numerator", value: 6 });
    expect(problem.topic).toEqual({ t: "intToFraction", n: 2, den: 3, count: 6 });
    expect(() => maker.build([0, 3])).toThrow(RangeError);
  });

  it("problemId", () => {
    expect(problemIdOf(maker.name, [2, 3])).toBe("number.intToFraction(2,3)");
  });

  it("verify：落ちる例", () => {
    const problem = made(maker, [2, 3]);
    expect(maker.verify(problem)).toBeNull();
    expect(maker.verify({ ...problem, answer: { type: "numerator", value: 5 } })).toMatch(/答え/);
    expect(maker.verify({ ...problem, hints: [...problem.hints.slice(0, 2), "分子は 6 です"] })).toMatch(/6/);
    expect(maker.verify({ ...problem, hints: [...problem.hints.slice(0, 2), "6/3 です"] })).toBeNull();
    expect(maker.verify({ ...problem, topic: { t: "intToFraction", n: 2, den: 3, count: 5 } })).toMatch(/count/);
  });

  it("verify：範囲のすべての数で通る（den = 1 や n = 1 でも答えを言わない）", () => {
    for (let n = 1; n <= 9; n += 1) {
      for (let den = 1; den <= 20; den += 1) {
        expect(maker.verify(made(maker, [n, den])), `${n},${den}`).toBeNull();
      }
    }
  });
});

describe("number.terminates", () => {
  const maker = NUMBER_TERMINATES;

  it("check：den 2〜20、num は 1 以上 den 未満", () => {
    expect(ok(maker, [1, 3])).toBe(true);
    expect(ok(maker, [1, 2])).toBe(true);
    expect(ok(maker, [19, 20])).toBe(true);
    expect(ok(maker, [1, 1])).toBe(false);
    expect(ok(maker, [1, 21])).toBe(false);
    expect(ok(maker, [0, 3])).toBe(false);
    expect(ok(maker, [3, 3])).toBe(false);
    expect(ok(maker, [4, 3])).toBe(false);
    expect(ok(maker, [1.5, 3])).toBe(false);
    expect(ok(maker, ["1", 3])).toBe(false);
    expect(ok(maker, [1])).toBe(false);
  });

  it("build：わり切れる時は商、わり切れない時は小数第3位までを切り捨てる", () => {
    const yes = made(maker, [1, 4]);
    expect(yes.answer).toEqual({ type: "choice", options: ["yes", "no"], correct: "yes" });
    expect(yes.topic).toEqual({ t: "terminates", value: { num: 1, den: 4 }, decimal: "0.25", terminates: true });
    const no = made(maker, [1, 3]);
    expect(no.answer).toEqual({ type: "choice", options: ["yes", "no"], correct: "no" });
    expect(no.topic).toEqual({ t: "terminates", value: { num: 1, den: 3 }, decimal: "0.333", terminates: false });
    // 切り捨て（2/3 は 0.666…、0.667 にしない）。0 のけたが入る
    expect(made(maker, [2, 3]).topic).toMatchObject({ decimal: "0.666" });
    expect(made(maker, [1, 12]).topic).toMatchObject({ decimal: "0.083" });
    expect(made(maker, [1, 11]).topic).toMatchObject({ decimal: "0.090" });
  });

  it("build：約分すると分母が 2 と 5 だけになる分数はわり切れる", () => {
    expect(made(maker, [3, 6]).topic).toMatchObject({ decimal: "0.5", terminates: true });
    expect(made(maker, [3, 12]).topic).toMatchObject({ decimal: "0.25", terminates: true });
    expect(made(maker, [2, 6]).topic).toMatchObject({ decimal: "0.333", terminates: false });
    expect(made(maker, [1, 16]).topic).toMatchObject({ decimal: "0.0625", terminates: true });
    expect(() => maker.build([3, 3])).toThrow(RangeError);
  });

  it("problemId", () => {
    expect(problemIdOf(maker.name, [1, 3])).toBe("number.terminates(1,3)");
  });

  it("verify：落ちる例", () => {
    const problem = made(maker, [1, 3]);
    expect(maker.verify(problem)).toBeNull();
    expect(maker.verify({ ...problem, answer: { type: "choice", options: ["yes", "no"], correct: "yes" } })).toMatch(/正解/);
    expect(maker.verify({ ...problem, answer: { type: "choice", options: ["no", "yes"], correct: "no" } })).toMatch(/選択肢/);
    expect(maker.verify({ ...problem, topic: { t: "terminates", value: { num: 1, den: 3 }, decimal: "0.333", terminates: true } })).toMatch(/terminates/);
    expect(maker.verify({ ...problem, topic: { t: "terminates", value: { num: 1, den: 3 }, decimal: "0.334", terminates: false } })).toMatch(/decimal/);
    expect(maker.verify({ ...problem, hints: [...problem.hints.slice(0, 2), "これは[割|わ]り切れません"] })).toBeNull();
    expect(maker.verify({ ...problem, hints: [...problem.hints.slice(0, 2), "これは、わり[切|き]れません"] })).toMatch(/わり切れません/);
    const yes = made(maker, [1, 4]);
    expect(maker.verify({ ...yes, hints: [...yes.hints.slice(0, 2), "わり切れます"] })).toMatch(/わり切れます/);
  });

  it("verify：範囲のすべての数で通る", () => {
    for (let den = 2; den <= 20; den += 1) {
      for (let num = 1; num < den; num += 1) {
        expect(maker.verify(made(maker, [num, den])), `${num}/${den}`).toBeNull();
      }
    }
  });
});

describe("ふりがなを外す", () => {
  it("[語|よみ] を語だけにする", () => {
    expect(stripRuby("[偶数|ぐうすう]です")).toBe("偶数です");
    expect(stripRuby("わり[切|き]れます")).toBe("わり切れます");
  });
});

describe("既定の出題表（default-plan.md）の行", () => {
  const rows: [string, Arg[]][] = [
    ["number.fractionToDecimal", [1, 4]],
    ["number.decimalToFraction", ["0.13"]],
    ["number.intToFraction", [2, 3]],
    ["number.fractionToDecimal", [3, 8]],
    ["number.terminates", [1, 3]],
    // テスト（既定の出題表の最後の学習）
    ["number.fractionToDecimal", [3, 5]],
  ];

  it.each(rows)("%s(%j) は check・build・verify を通り、args が変わらない", (name, args) => {
    const maker = NUMBER_MAKERS.find((entry) => entry.name === name);
    if (!maker) throw new Error(name);
    const checked = maker.check(args);
    expect(checked).toEqual({ ok: true, args });
    const problem = maker.build(args);
    expect(maker.verify(problem)).toBeNull();
  });
});
