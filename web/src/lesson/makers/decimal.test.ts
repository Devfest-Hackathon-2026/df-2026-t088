import { describe, expect, it } from "vitest";
import type { NumberProblem } from "../number-problem";
import { DECIMAL_MAKERS } from "./decimal";
import { problemIdOf } from "./format";
import type { Arg, ProblemMaker } from "./types";

const maker = (name: string): ProblemMaker => {
  const found = DECIMAL_MAKERS.find((entry) => entry.name === name);
  if (!found) throw new Error(`関数がありません: ${name}`);
  return found;
};

const ok = (name: string, args: unknown[]): boolean => maker(name).check(args).ok;

function reasonOf(name: string, args: unknown[]): string {
  const result = maker(name).check(args);
  if (result.ok) throw new Error("check が通ってしまいました");
  return result.reason;
}

function built(name: string, args: Arg[]): NumberProblem {
  const problem = maker(name).build(args);
  if (problem.kind !== "number") throw new Error("数の問題ではありません");
  return problem;
}

const f = (num: number, den: number) => ({ num, den });
const tenth = f(1, 10);
const hundredth = f(1, 100);
const thousandth = f(1, 1000);

describe("関数の一覧", () => {
  it("小数の7つで、どれも数の問題", () => {
    expect(DECIMAL_MAKERS.map((entry) => entry.name)).toEqual([
      "decimal.shift", "decimal.compareProduct", "decimal.multiply", "decimal.compareQuotient", "decimal.divide", "decimal.divideRemainder", "decimal.distributive",
    ]);
    expect(DECIMAL_MAKERS.every((entry) => entry.kind === "number")).toBe(true);
  });
});

describe("check の境目", () => {
  it("shift：x は 1000 未満・小数第2位まで、答えは小数第4位まで", () => {
    expect(ok("decimal.shift", ["999.99", 10])).toBe(true);
    expect(ok("decimal.shift", ["1000", 10])).toBe(false);
    expect(ok("decimal.shift", ["0.01", 10])).toBe(true);
    expect(ok("decimal.shift", ["0", 10])).toBe(false);
    expect(ok("decimal.shift", ["1.234", 10])).toBe(false);
    expect(ok("decimal.shift", ["1.50", 10])).toBe(false); // 余分な 0
    expect(ok("decimal.shift", [".5", 10])).toBe(false);
    // 0.52 ÷ 100 = 0.0052（4位）は通り、0.52 ÷ 1000 = 0.00052（5位）は落ちる
    expect(ok("decimal.shift", ["0.52", hundredth])).toBe(true);
    expect(ok("decimal.shift", ["0.52", thousandth])).toBe(false);
    expect(reasonOf("decimal.shift", ["0.52", thousandth])).toContain("小数第4位");
    expect(ok("decimal.shift", ["24.85", hundredth])).toBe(true);
  });

  it("shift：factor は 10・100・1000・1/10・1/100・1/1000 だけ", () => {
    for (const factor of [10, 100, 1000, tenth, hundredth, thousandth]) expect(ok("decimal.shift", ["3.1", factor])).toBe(true);
    for (const factor of [1, 2, 10000, f(1, 2), f(2, 10), f(1, 10000), "10", 0.1, null]) expect(ok("decimal.shift", ["3.1", factor])).toBe(false);
    expect(ok("decimal.shift", ["3.14"])).toBe(false);
    expect(ok("decimal.shift", [3.14, 10])).toBe(false); // 小数は文字で
    expect(ok("decimal.shift", [5, 10])).toBe(true);
  });

  it("shift：ヒントは power の数を書かないので、答えが 10 になる組も通る", () => {
    expect(ok("decimal.shift", ["1", 10])).toBe(true);
    expect(ok("decimal.shift", ["0.01", 1000])).toBe(true);
  });

  it("compareProduct / compareQuotient：a は 100 以下・小数第1位まで、b は 0.1〜9.9 で 1 以外", () => {
    for (const name of ["decimal.compareProduct", "decimal.compareQuotient"]) {
      expect(ok(name, [100, "0.8"])).toBe(true);
      expect(ok(name, [101, "0.8"])).toBe(false);
      expect(ok(name, ["100.1", "0.8"])).toBe(false);
      expect(ok(name, ["99.9", "9.9"])).toBe(true);
      expect(ok(name, ["3.65", "0.9"])).toBe(false);
      expect(ok(name, ["0.1", "0.1"])).toBe(true);
      expect(ok(name, [0, "0.8"])).toBe(false);
      expect(ok(name, [50, "0"])).toBe(false);
      expect(ok(name, [50, "10"])).toBe(false);
      expect(ok(name, [50, "9.9"])).toBe(true);
      expect(ok(name, [50, "1"])).toBe(false);
      expect(ok(name, [50, "1.0"])).toBe(false);
      expect(ok(name, [50, "1.1"])).toBe(true);
      expect(ok(name, [50, "0.85"])).toBe(false);
      expect(ok(name, [50, 2])).toBe(false); // b は文字
      expect(ok(name, [50])).toBe(false);
    }
  });

  it("compareProduct：a の整数は文字にそろえる", () => {
    const result = maker("decimal.compareProduct").check([80, "0.8"]);
    expect(result).toEqual({ ok: true, args: ["80", "0.8"] });
  });

  it("multiply：整数の部分2けたまで、a は小数第2位まで、b は小数第1位か第2位", () => {
    expect(ok("decimal.multiply", [12, "4.3"])).toBe(true);
    expect(ok("decimal.multiply", ["99.99", "99.99"])).toBe(true);
    expect(ok("decimal.multiply", [100, "4.3"])).toBe(false);
    expect(ok("decimal.multiply", [12, "100.3"])).toBe(false);
    expect(ok("decimal.multiply", ["1.234", "4.3"])).toBe(false);
    expect(ok("decimal.multiply", [12, "0.432"])).toBe(false);
    expect(ok("decimal.multiply", [12, "0.43"])).toBe(true);
    expect(ok("decimal.multiply", [12, 4])).toBe(false); // b に小数点が無い
    expect(ok("decimal.multiply", [12, "4"])).toBe(false);
    expect(ok("decimal.multiply", [0, "0.4"])).toBe(false);
    expect(ok("decimal.multiply", [12])).toBe(false);
  });

  it("divide：整数の部分2けたまで・小数第2位まで、わり切れて商は小数第2位まで", () => {
    expect(ok("decimal.divide", ["7.2", "2.4"])).toBe(true);
    expect(ok("decimal.divide", ["7.2", "2.5"])).toBe(true); // 2.88（2位）
    expect(ok("decimal.divide", ["7.3", "2.4"])).toBe(false); // 73÷24 はわり切れない
    expect(ok("decimal.divide", ["1", "0.3"])).toBe(false); // わり切れない
    expect(ok("decimal.divide", ["1", "0.16"])).toBe(true); // 6.25（2位）
    expect(ok("decimal.divide", ["1", "0.32"])).toBe(false); // 3.125（3位）
    expect(ok("decimal.divide", ["1", "0.25"])).toBe(true); // 4
    expect(ok("decimal.divide", ["100", "0.5"])).toBe(false); // 整数の部分 3 けた
    expect(ok("decimal.divide", ["99.99", "9.8"])).toBe(false);
    expect(ok("decimal.divide", ["0.5", "0.123"])).toBe(false);
    expect(ok("decimal.divide", [9, 2])).toBe(false); // b に小数点が無い
    expect(ok("decimal.divide", ["0.1", "0.04"])).toBe(true);
  });

  it("divideRemainder：a は小数第1位まで、b は小数第1位、商は 1 以上でわり切れない", () => {
    expect(ok("decimal.divideRemainder", ["7.5", "2.3"])).toBe(true);
    expect(ok("decimal.divideRemainder", [75, "2.3"])).toBe(true);
    expect(ok("decimal.divideRemainder", ["99.9", "0.7"])).toBe(true);
    expect(ok("decimal.divideRemainder", ["100", "2.3"])).toBe(false);
    expect(ok("decimal.divideRemainder", ["7.55", "2.3"])).toBe(false);
    expect(ok("decimal.divideRemainder", ["7.5", "2.35"])).toBe(false);
    expect(ok("decimal.divideRemainder", ["7.5", "2"])).toBe(false);
    expect(ok("decimal.divideRemainder", ["2.2", "2.3"])).toBe(false); // 商が 0
    expect(ok("decimal.divideRemainder", ["2.3", "2.3"])).toBe(false); // あまり 0
    expect(ok("decimal.divideRemainder", ["2.4", "2.3"])).toBe(true); // 商 1
    expect(ok("decimal.divideRemainder", ["7.2", "2.4"])).toBe(false); // わり切れる
  });

  it("distributive：a は 2 けた以下の整数、b は 1 けたの整数、c は 0.1〜0.9", () => {
    expect(ok("decimal.distributive", [30, 2, "0.5"])).toBe(true);
    expect(ok("decimal.distributive", [99, 9, "0.9"])).toBe(true);
    expect(ok("decimal.distributive", [1, 1, "0.1"])).toBe(true);
    expect(ok("decimal.distributive", [100, 2, "0.5"])).toBe(false);
    expect(ok("decimal.distributive", [0, 2, "0.5"])).toBe(false);
    expect(ok("decimal.distributive", [30, 10, "0.5"])).toBe(false);
    expect(ok("decimal.distributive", [30, 0, "0.5"])).toBe(false);
    expect(ok("decimal.distributive", [30, 2, "1"])).toBe(false);
    expect(ok("decimal.distributive", [30, 2, "0"])).toBe(false);
    expect(ok("decimal.distributive", [30, 2, "0.55"])).toBe(false);
    expect(ok("decimal.distributive", [30, 2, 0.5])).toBe(false);
    expect(ok("decimal.distributive", ["30", 2, "0.5"])).toBe(false);
    expect(ok("decimal.distributive", [30, 2.5, "0.5"])).toBe(false);
  });

  it("build は check を通らない args で RangeError", () => {
    expect(() => maker("decimal.shift").build(["1000", 10])).toThrow(RangeError);
    expect(() => maker("decimal.divide").build(["1", "0.3"])).toThrow(RangeError);
    expect(() => maker("decimal.distributive").build([30, 2, "1"])).toThrow(RangeError);
    expect(() => maker("decimal.multiply").build([12])).toThrow(RangeError);
  });
});

describe("build の answer と topic", () => {
  it("shift", () => {
    const up = built("decimal.shift", ["3.14", 10]);
    expect(up.answer).toEqual({ type: "decimal", value: "31.4" });
    expect(up.topic).toEqual({ t: "shift", x: "3.14", direction: "up", power: 10, places: 1, answer: "31.4" });
    expect(built("decimal.shift", ["0.52", 100]).answer).toEqual({ type: "decimal", value: "52" });
    expect(built("decimal.shift", ["2.5", 1000]).answer).toEqual({ type: "decimal", value: "2500" });
    const down = built("decimal.shift", ["24.85", hundredth]);
    expect(down.answer).toEqual({ type: "decimal", value: "0.2485" });
    expect(down.topic).toEqual({ t: "shift", x: "24.85", direction: "down", power: 100, places: 2, answer: "0.2485" });
    expect(built("decimal.shift", ["7.6", tenth]).answer).toEqual({ type: "decimal", value: "0.76" });
    expect(built("decimal.shift", ["5", thousandth]).answer).toEqual({ type: "decimal", value: "0.005" });
    // 浮動小数の誤差が出る値：0.07 × 100 = 7.000000000000001、4.35 × 100 = 434.99999999999994
    expect(built("decimal.shift", ["0.07", 100]).answer).toEqual({ type: "decimal", value: "7" });
    expect(built("decimal.shift", ["4.35", 100]).answer).toEqual({ type: "decimal", value: "435" });
    expect(built("decimal.shift", ["0.7", 1000]).answer).toEqual({ type: "decimal", value: "700" });
  });

  it("compareProduct と compareQuotient", () => {
    const small = built("decimal.compareProduct", [80, "0.8"]);
    expect(small.topic).toEqual({ t: "compareProduct", a: "80", b: "0.8", bigger: false });
    expect(small.answer).toEqual({ type: "choice", options: ["above", "below"], correct: "below" });
    expect(built("decimal.compareProduct", [80, "2.5"]).answer).toMatchObject({ correct: "above" });
    expect(built("decimal.compareProduct", ["3.6", "0.9"]).topic).toMatchObject({ a: "3.6", bigger: false });
    expect(built("decimal.compareQuotient", [9, "1.8"]).answer).toMatchObject({ correct: "below" });
    expect(built("decimal.compareQuotient", [9, "1.8"]).topic).toEqual({ t: "compareQuotient", a: "9", b: "1.8", bigger: false });
    expect(built("decimal.compareQuotient", [6, "0.4"]).answer).toMatchObject({ correct: "above" });
    expect(built("decimal.compareQuotient", [3, "0.5"]).topic).toMatchObject({ bigger: true });
  });

  it("multiply：小数点を取った整数の積と、けた数の和", () => {
    const problem = built("decimal.multiply", [12, "4.3"]);
    expect(problem.topic).toEqual({ t: "multiply", a: "12", b: "4.3", intA: 12, intB: 43, intProduct: 516, places: 1, answer: "51.6" });
    expect(problem.answer).toEqual({ type: "decimal", value: "51.6" });
    expect(built("decimal.multiply", [12, "0.43"]).topic).toMatchObject({ intProduct: 516, places: 2, answer: "5.16" });
    expect(built("decimal.multiply", ["0.8", "0.6"]).answer).toEqual({ type: "decimal", value: "0.48" });
    // 積の末尾の 0 は付けない：1.25 × 0.4 = 0.500
    expect(built("decimal.multiply", ["1.25", "0.4"]).topic).toMatchObject({ intA: 125, intB: 4, intProduct: 500, places: 3, answer: "0.5" });
    // 浮動小数の誤差：0.1 × 0.2 = 0.020000000000000004、1.1 × 1.1 = 1.2100000000000002、0.7 × 0.1 = 0.06999999999999999
    expect(built("decimal.multiply", ["0.1", "0.2"]).answer).toEqual({ type: "decimal", value: "0.02" });
    expect(built("decimal.multiply", ["1.1", "1.1"]).answer).toEqual({ type: "decimal", value: "1.21" });
    expect(built("decimal.multiply", ["0.7", "0.1"]).answer).toEqual({ type: "decimal", value: "0.07" });
    expect(built("decimal.multiply", ["99.99", "99.99"]).answer).toEqual({ type: "decimal", value: "9998.0001" });
  });

  it("divide：factor は、わられる数もわる数も整数になる 10 の累乗", () => {
    expect(built("decimal.divide", ["7.2", "2.4"]).topic).toEqual({ t: "divide", a: "7.2", b: "2.4", factor: 10, intA: 72, intB: 24, answer: "3" });
    expect(built("decimal.divide", ["0.1", "0.04"]).topic).toEqual({ t: "divide", a: "0.1", b: "0.04", factor: 100, intA: 10, intB: 4, answer: "2.5" });
    expect(built("decimal.divide", ["0.5", "0.4"]).topic).toMatchObject({ factor: 10, intA: 5, intB: 4, answer: "1.25" });
    // 1.25÷0.5 は ×10 だと 12.5÷5 でわられる数が整数にならないので、×100 の 125÷50
    expect(built("decimal.divide", ["1.25", "0.5"]).topic).toMatchObject({ factor: 100, intA: 125, intB: 50, answer: "2.5" });
    expect(ok("decimal.divide", ["1.25", "0.4"])).toBe(false); // 3.125（3位）
  });

  it("divide：浮動小数の誤差が出る例（0.3÷0.1、0.6÷0.2）でも正しい", () => {
    expect(built("decimal.divide", ["0.3", "0.1"]).answer).toEqual({ type: "decimal", value: "3" });
    expect(built("decimal.divide", ["0.6", "0.2"]).answer).toEqual({ type: "decimal", value: "3" });
    expect(built("decimal.divide", ["4.35", "0.15"]).answer).toEqual({ type: "decimal", value: "29" });
    expect(built("decimal.divide", [9, "1.8"]).answer).toEqual({ type: "decimal", value: "5" });
    expect(built("decimal.divide", ["6.3", "0.9"]).answer).toEqual({ type: "decimal", value: "7" });
  });

  it("divideRemainder：商は整数、あまりは小数の文字", () => {
    const problem = built("decimal.divideRemainder", ["7.5", "2.3"]);
    expect(problem.answer).toEqual({ type: "remainder", quotient: 3, remainder: "0.6" });
    expect(problem.topic).toEqual({ t: "divideRemainder", a: "7.5", b: "2.3", quotient: 3, remainder: "0.6" });
    expect(built("decimal.divideRemainder", ["6.5", "0.8"]).answer).toEqual({ type: "remainder", quotient: 8, remainder: "0.1" });
    // 浮動小数の誤差：7.5 − 2.3×3 = 0.6000000000000005、8.3 − 2.5×3 = 0.7999999999999998
    expect(built("decimal.divideRemainder", ["8.3", "2.5"]).answer).toEqual({ type: "remainder", quotient: 3, remainder: "0.8" });
    expect(built("decimal.divideRemainder", ["9.4", "2.2"]).answer).toEqual({ type: "remainder", quotient: 4, remainder: "0.6" });
    // あまりが 1 以上になることもある（わる数が大きい時）
    expect(built("decimal.divideRemainder", ["99.9", "10.9"]).answer).toEqual({ type: "remainder", quotient: 9, remainder: "1.8" });
    expect(built("decimal.divideRemainder", [75, "2.3"]).topic).toMatchObject({ a: "75", quotient: 32, remainder: "1.4" });
  });

  it("distributive：□ は c", () => {
    const problem = built("decimal.distributive", [30, 2, "0.5"]);
    expect(problem.topic).toEqual({ t: "distributive", a: 30, b: 2, c: "0.5" });
    expect(problem.answer).toEqual({ type: "decimal", value: "0.5" });
  });

  it("どの問題もタイルを使わず、ヒントは 2〜3 個で、漢字にふりがなが付く", () => {
    const samples: [string, Arg[]][] = [
      ["decimal.shift", ["3.14", 10]], ["decimal.compareProduct", [80, "0.8"]], ["decimal.multiply", [12, "4.3"]], ["decimal.compareQuotient", [9, "1.8"]],
      ["decimal.divide", ["7.2", "2.4"]], ["decimal.divideRemainder", ["7.5", "2.3"]], ["decimal.distributive", [30, 2, "0.5"]],
    ];
    for (const [name, args] of samples) {
      const problem = built(name, args);
      expect(problem.pieces).toEqual([]);
      expect(problem.hints.length).toBeGreaterThanOrEqual(2);
      expect(problem.hints.length).toBeLessThanOrEqual(3);
      // ふりがなの無い漢字が残っていないこと（[漢字|よみ] の外に漢字が無い）
      for (const hint of problem.hints) expect(hint.replace(/\[[^\]|]+\|[^\]]+\]/g, "")).not.toMatch(/[二-龠々]/u);
    }
  });

  it("ヒントの文の例", () => {
    expect(built("decimal.shift", ["3.14", 10]).hints).toEqual([
      "3.14 の[小数点|しょうすうてん]を、[右|みぎ]へうつして[考|かんが]えましょう",
      "[右|みぎ]へ一けた、うつします",
      "[位|くらい]が[足|た]りない[所|ところ]は、0 を[書|か]いてうめましょう",
    ]);
    expect(built("decimal.multiply", [12, "4.3"]).hints[1]).toBe("12×43 を[計算|けいさん]しましょう");
    expect(built("decimal.distributive", [30, 2, "0.5"]).hints[1]).toBe("30×2.5 は、30×2 と 30×□ をたした[数|かず]になります");
    expect(built("decimal.divideRemainder", ["7.5", "2.3"]).hints[0]).toContain("7.5 の[中|なか]に、2.3 がいくつ[入|はい]るか");
  });
});

describe("問題の id", () => {
  it("小数は文字のまま、1/100 などは分数の形で入る", () => {
    const result = maker("decimal.shift").check(["24.85", hundredth]);
    if (!result.ok) throw new Error(result.reason);
    expect(problemIdOf("decimal.shift", result.args)).toBe("decimal.shift(24.85,1/100)");
    const up = maker("decimal.shift").check(["3.14", 10]);
    if (!up.ok) throw new Error(up.reason);
    expect(problemIdOf("decimal.shift", up.args)).toBe("decimal.shift(3.14,10)");
    const multiply = maker("decimal.multiply").check([12, "4.3"]);
    if (!multiply.ok) throw new Error(multiply.reason);
    expect(problemIdOf("decimal.multiply", multiply.args)).toBe("decimal.multiply(12,4.3)");
    const distributive = maker("decimal.distributive").check([30, 2, "0.5"]);
    if (!distributive.ok) throw new Error(distributive.reason);
    expect(problemIdOf("decimal.distributive", distributive.args)).toBe("decimal.distributive(30,2,0.5)");
  });
});

describe("verify が落ちる例", () => {
  const verifyOf = (name: string, problem: NumberProblem) => maker(name).verify(problem);
  const base = (name: string, args: Arg[]) => built(name, args);

  it("正しい問題は null", () => {
    expect(verifyOf("decimal.shift", base("decimal.shift", ["3.14", 10]))).toBeNull();
    expect(verifyOf("decimal.divide", base("decimal.divide", ["0.1", "0.04"]))).toBeNull();
  });

  it("答えがちがう", () => {
    const shift = base("decimal.shift", ["3.14", 10]);
    expect(verifyOf("decimal.shift", { ...shift, answer: { type: "decimal", value: "314" } })).toContain("31.4");
    expect(verifyOf("decimal.shift", { ...shift, topic: { ...shift.topic, answer: "314" } as NumberProblem["topic"] })).toContain("31.4");
    const multiply = base("decimal.multiply", [12, "4.3"]);
    expect(verifyOf("decimal.multiply", { ...multiply, answer: { type: "decimal", value: "5.16" } })).toContain("51.6");
    const divide = base("decimal.divide", ["7.2", "2.4"]);
    expect(verifyOf("decimal.divide", { ...divide, answer: { type: "decimal", value: "30" } })).toContain("3");
    const remainder = base("decimal.divideRemainder", ["7.5", "2.3"]);
    expect(verifyOf("decimal.divideRemainder", { ...remainder, answer: { type: "remainder", quotient: 3, remainder: "6" } })).toContain("0.6");
    const distributive = base("decimal.distributive", [30, 2, "0.5"]);
    expect(verifyOf("decimal.distributive", { ...distributive, answer: { type: "decimal", value: "2.5" } })).toContain("0.5");
    const compare = base("decimal.compareProduct", [80, "0.8"]);
    expect(verifyOf("decimal.compareProduct", { ...compare, answer: { type: "choice", options: ["above", "below"], correct: "above" } })).toContain("below");
    expect(verifyOf("decimal.compareProduct", { ...compare, topic: { t: "compareProduct", a: "80", b: "0.8", bigger: true } })).toContain("bigger");
  });

  it("topic の中間の数がちがう", () => {
    const multiply = base("decimal.multiply", [12, "4.3"]);
    expect(verifyOf("decimal.multiply", { ...multiply, topic: { ...(multiply.topic as object), intProduct: 515 } as NumberProblem["topic"] })).toContain("516");
    expect(verifyOf("decimal.multiply", { ...multiply, topic: { ...(multiply.topic as object), places: 2 } as NumberProblem["topic"] })).toContain("places");
    const divide = base("decimal.divide", ["0.1", "0.04"]);
    expect(verifyOf("decimal.divide", { ...divide, topic: { ...(divide.topic as object), factor: 10 } as NumberProblem["topic"] })).toContain("factor");
  });

  it("ヒントに答えの数が入っている（12 の中の 2 は数えない）", () => {
    const shift = base("decimal.shift", ["3.14", 10]);
    expect(verifyOf("decimal.shift", { ...shift, hints: [...shift.hints.slice(0, 2), "答えは 31.4 です"] })).toContain("31.4");
    // 答え 31.4 に対して 131.4 や 31.45 は別の数
    expect(verifyOf("decimal.shift", { ...shift, hints: [shift.hints[0], "131.4 と 31.45 は別の数です"] })).toBeNull();
    const remainder = base("decimal.divideRemainder", ["7.5", "2.3"]);
    expect(verifyOf("decimal.divideRemainder", { ...remainder, hints: [...remainder.hints.slice(0, 2), "あまりは 0.6 です"] })).toContain("0.6");
    expect(verifyOf("decimal.divideRemainder", { ...remainder, hints: [...remainder.hints.slice(0, 2), "商は 3 です"] })).toContain("3");
    const multiply = base("decimal.multiply", [12, "4.3"]);
    expect(verifyOf("decimal.multiply", { ...multiply, hints: [multiply.hints[0], "12×43 = 516 です"] })).toContain("516");
    const distributive = base("decimal.distributive", [30, 2, "0.5"]);
    expect(verifyOf("decimal.distributive", { ...distributive, hints: [distributive.hints[0], "□ は 0.5 です"] })).toContain("0.5");
  });

  it("ヒントの数がふつうでない、タイルが入っている", () => {
    const shift = base("decimal.shift", ["3.14", 10]);
    expect(verifyOf("decimal.shift", { ...shift, hints: ["ひとつだけ"] })).toContain("2〜3");
    expect(verifyOf("decimal.shift", { ...shift, hints: ["a", "b", "c", "d"] })).toContain("2〜3");
    expect(verifyOf("decimal.shift", { ...shift, hints: ["a", " "] })).toContain("空");
    expect(maker("decimal.shift").verify({ ...shift, pieces: [{ num: 1, den: 2, count: 1 }] as unknown as [] })).toContain("タイル");
  });

  it("別の関数の問題や、タイルの問題は落ちる", () => {
    const shift = base("decimal.shift", ["3.14", 10]);
    expect(verifyOf("decimal.multiply", shift)).toContain("multiply");
    expect(maker("decimal.shift").verify({ kind: "reduce", value: { num: 2, den: 4 }, pieces: [], hints: [] })).toContain("数の問題");
  });

  it("ヒントに答えの数が入ってしまう組は check で落ちる", () => {
    // 0.5 ÷ 0.25 → 2 だが、ヒントは b と a だけを書くので落ちない。a ÷ b = b になる 0.64 ÷ 0.8 = 0.8 は、b を書くヒントに答えが出る
    expect(ok("decimal.divide", ["0.64", "0.8"])).toBe(false);
    expect(reasonOf("decimal.divide", ["0.64", "0.8"])).toContain("0.8");
  });
});

describe("既定の出題表（default-plan.md の小数の行）", () => {
  const rows: [string, Arg[]][] = [
    ["decimal.shift", ["3.14", 10]], ["decimal.shift", ["0.52", 100]], ["decimal.shift", ["2.5", 1000]], ["decimal.shift", ["24.85", hundredth]], ["decimal.shift", ["7.6", tenth]],
    ["decimal.compareProduct", [80, "0.8"]], ["decimal.compareProduct", [80, "2.5"]], ["decimal.compareProduct", [12, "1.5"]], ["decimal.compareProduct", [45, "0.6"]], ["decimal.compareProduct", ["3.6", "0.9"]],
    ["decimal.multiply", [12, "4.3"]], ["decimal.multiply", [12, "0.43"]], ["decimal.multiply", ["2.3", "1.4"]], ["decimal.multiply", ["0.8", "0.6"]], ["decimal.multiply", ["1.25", "0.4"]],
    ["decimal.compareQuotient", [9, "1.8"]], ["decimal.compareQuotient", [80, "2.5"]], ["decimal.compareQuotient", [6, "0.4"]], ["decimal.compareQuotient", ["4.8", "0.6"]], ["decimal.compareQuotient", [3, "0.5"]],
    ["decimal.divide", ["7.2", "2.4"]], ["decimal.divide", ["0.1", "0.04"]], ["decimal.divide", ["0.5", "0.4"]], ["decimal.divide", [9, "1.8"]], ["decimal.divide", ["6.3", "0.9"]],
    ["decimal.divideRemainder", ["7.5", "2.3"]], ["decimal.divideRemainder", ["5.2", "1.5"]], ["decimal.divideRemainder", ["9.4", "2.2"]], ["decimal.divideRemainder", ["6.5", "0.8"]], ["decimal.divideRemainder", ["3.7", "1.2"]],
    ["decimal.distributive", [30, 2, "0.5"]], ["decimal.distributive", [12, 4, "0.3"]], ["decimal.distributive", [25, 3, "0.4"]], ["decimal.distributive", [40, 1, "0.2"]], ["decimal.distributive", [16, 2, "0.5"]],
    // decimal-t
    ["decimal.shift", ["3.75", 100]], ["decimal.multiply", [15, "0.6"]], ["decimal.compareProduct", [50, "1.2"]], ["decimal.multiply", ["3.4", "2.5"]], ["decimal.shift", ["46.2", tenth]],
    // テスト
    ["decimal.shift", ["5.08", 10]], ["decimal.compareProduct", [60, "0.7"]], ["decimal.multiply", ["2.6", "3.5"]], ["decimal.compareQuotient", [8, "0.5"]], ["decimal.divide", ["8.4", "1.2"]],
    ["decimal.divideRemainder", ["8.3", "2.5"]], ["decimal.distributive", [20, 3, "0.5"]],
  ];

  it.each(rows.map((row) => [problemIdOf(row[0], row[1]), row] as const))("%s は check・build・verify を通る", (_id, [name, args]) => {
    const target = maker(name);
    const checked = target.check(args);
    if (!checked.ok) throw new Error(checked.reason);
    const problem = target.build(checked.args);
    expect(target.verify(problem)).toBeNull();
  });

  it("表の答え（計算し直した値）", () => {
    const answers = rows.map(([name, args]) => {
      const problem = built(name, args);
      return problem.answer.type === "decimal" ? problem.answer.value : problem.answer.type === "choice" ? problem.answer.correct : `${(problem.answer as { quotient: number }).quotient}あまり${(problem.answer as { remainder: string }).remainder}`;
    });
    expect(answers).toEqual([
      "31.4", "52", "2500", "0.2485", "0.76",
      "below", "above", "above", "below", "below",
      "51.6", "5.16", "3.22", "0.48", "0.5",
      "below", "below", "above", "above", "above",
      "3", "2.5", "1.25", "5", "7",
      "3あまり0.6", "3あまり0.7", "4あまり0.6", "8あまり0.1", "3あまり0.1",
      "0.5", "0.3", "0.4", "0.2", "0.5",
      "375", "9", "above", "8.5", "4.62",
      "50.8", "below", "9.1", "above", "7",
      "3あまり0.8", "0.5",
    ]);
  });
});
