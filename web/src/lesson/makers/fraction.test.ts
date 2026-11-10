import { describe, expect, it } from "vitest";
import type { Fraction } from "../fraction";
import { DEFAULT_PLANS } from "../plans/sansu-5";
import {
  calculateProblem, commonProblem, compareProblem, divideProblem, equivalentProblem, estimateProblem, plainProblem, reduceProblem,
} from "../problems";
import type { TileProblem } from "../problems";
import { FRACTION_DIVIDE, FRACTION_EQUIVALENT, FRACTION_MAKERS } from "./fraction";
import { problemIdOf } from "./format";
import { findMaker, MAKERS } from "./index";
import type { Arg, ProblemMaker } from "./types";

const f = (num: number, den: number): Fraction => ({ num, den });
const ONE = f(1, 1);

function maker(name: string): ProblemMaker {
  const found = findMaker(name);
  if (!found) throw new Error(`関数がありません: ${name}`);
  return found;
}

const ok = (name: string, args: unknown[]): boolean => maker(name).check(args).ok;

describe("関数の一覧", () => {
  it("全部の関数（29個）を名前で引ける。分数はタイル、ほかは数の問題", () => {
    const names = MAKERS.map((entry) => entry.name);
    expect(names).toHaveLength(29);
    expect(new Set(names).size).toBe(29);
    expect(names.filter((name) => name.startsWith("fraction."))).toEqual([
      "fraction.reduce", "fraction.common", "fraction.compare", "fraction.calculate", "fraction.plain", "fraction.estimate",
      "fraction.divide", "fraction.equivalent",
    ]);
    for (const entry of MAKERS) expect(findMaker(entry.name)).toBe(entry);
    expect(findMaker("fraction.nothing")).toBeUndefined();
    expect(MAKERS.filter((entry) => entry.name.startsWith("fraction.")).every((entry) => entry.kind === "tile")).toBe(true);
    expect(MAKERS.filter((entry) => !entry.name.startsWith("fraction.")).every((entry) => entry.kind === "number")).toBe(true);
  });
});

describe("check の境目", () => {
  // 分母 1 と 21 は落ち、2 と 20 は通る。タイルの上限に当たらない 2 と 20 の組み合わせを使う
  it("分母の範囲", () => {
    expect(ok("fraction.calculate", [f(1, 2), "+", f(1, 3)])).toBe(true);
    expect(ok("fraction.calculate", [f(1, 1), "+", f(1, 3)])).toBe(false);
    expect(ok("fraction.calculate", [f(1, 21), "+", f(1, 3)])).toBe(false);
    expect(ok("fraction.calculate", [f(1, 2), "+", f(1, 1)])).toBe(false);
    expect(ok("fraction.calculate", [f(1, 2), "+", f(1, 21)])).toBe(false);
    expect(ok("fraction.calculate", [f(1, 20), "+", f(1, 2)])).toBe(true);
    expect(ok("fraction.plain", [f(1, 20), "+", f(1, 2)])).toBe(true);
    expect(ok("fraction.plain", [f(1, 21), "+", f(1, 2)])).toBe(false);
    expect(ok("fraction.common", [f(1, 2), f(1, 4)])).toBe(true);
    expect(ok("fraction.common", [f(1, 1), f(1, 4)])).toBe(false);
    expect(ok("fraction.common", [f(1, 21), f(1, 4)])).toBe(false);
    expect(ok("fraction.compare", [f(1, 2), f(1, 4)])).toBe(true);
    expect(ok("fraction.compare", [f(1, 2), f(1, 21)])).toBe(false);
    expect(ok("fraction.compare", [f(1, 1), f(1, 4)])).toBe(false);
    expect(ok("fraction.reduce", [f(2, 4), f(1, 3)])).toBe(true);
    expect(ok("fraction.reduce", [f(2, 20), f(1, 3)])).toBe(true);
    expect(ok("fraction.reduce", [f(1, 1), f(1, 3)])).toBe(false);
    expect(ok("fraction.reduce", [f(2, 21), f(1, 3)])).toBe(false);
    expect(ok("fraction.reduce", [f(2, 4), f(1, 21)])).toBe(false);
    // 約分できない分数は check で落とす（TBL-001「value は約分できる」）
    expect(ok("fraction.reduce", [f(2, 3), f(1, 2)])).toBe(false);
    expect(ok("fraction.estimate", [f(1, 2), "+", f(1, 20), ONE])).toBe(true);
    expect(ok("fraction.estimate", [f(1, 21), "+", f(1, 2), ONE])).toBe(false);
    expect(ok("fraction.estimate", [f(1, 2), "+", f(1, 1), ONE])).toBe(false);
  });

  it("op が + - 以外は落ちる", () => {
    for (const name of ["fraction.calculate", "fraction.plain"]) {
      expect(ok(name, [f(1, 3), "*", f(1, 4)])).toBe(false);
      expect(ok(name, [f(1, 3), "−", f(1, 4)])).toBe(false);
      expect(ok(name, [f(1, 3), 1, f(1, 4)])).toBe(false);
      expect(ok(name, [f(1, 3), "-", f(1, 4)])).toBe(true);
    }
    expect(ok("fraction.estimate", [f(1, 3), "x", f(1, 4), ONE])).toBe(false);
  });

  it("ひき算で left < right は落ちる", () => {
    for (const name of ["fraction.calculate", "fraction.plain"]) {
      expect(ok(name, [f(1, 4), "-", f(1, 3)])).toBe(false);
      expect(ok(name, [f(1, 3), "-", f(1, 3)])).toBe(true);
      expect(ok(name, [f(1, 4), "+", f(1, 3)])).toBe(true);
    }
    expect(ok("fraction.estimate", [f(1, 4), "-", f(1, 3), ONE])).toBe(false);
    expect(ok("fraction.estimate", [f(3, 4), "-", f(1, 3), ONE])).toBe(true);
  });

  it("threshold は 1 と 1/2 だけで、1 は数でも分数でも受けて正規化する", () => {
    const expression = [f(3, 4), "+", f(1, 2)];
    expect(maker("fraction.estimate").check([...expression, 1])).toEqual({ ok: true, args: [...expression, f(1, 1)] });
    expect(maker("fraction.estimate").check([...expression, f(1, 1)])).toEqual({ ok: true, args: [...expression, f(1, 1)] });
    expect(maker("fraction.estimate").check([...expression, f(1, 2)])).toEqual({ ok: true, args: [...expression, f(1, 2)] });
    for (const threshold of [2, 0, f(1, 3), f(2, 1), f(2, 4), "1", null, true]) {
      expect(ok("fraction.estimate", [...expression, threshold])).toBe(false);
    }
  });

  it("args の数と型が違うと落ちる", () => {
    expect(ok("fraction.calculate", [f(1, 3), "+"])).toBe(false);
    expect(ok("fraction.calculate", [f(1, 3), "+", f(1, 4), true, true])).toBe(false);
    expect(ok("fraction.calculate", [f(1, 3), "+", f(1, 4), "m"])).toBe(false);
    expect(ok("fraction.calculate", [f(1, 3), "+", f(1, 4), 1])).toBe(false);
    expect(ok("fraction.calculate", [1, "+", f(1, 4)])).toBe(false);
    expect(ok("fraction.calculate", ["1/3", "+", f(1, 4)])).toBe(false);
    expect(ok("fraction.calculate", [{ num: 1 }, "+", f(1, 4)])).toBe(false);
    expect(ok("fraction.calculate", [f(1.5, 4), "+", f(1, 4)])).toBe(false);
    expect(ok("fraction.calculate", [{ num: "1", den: 3 }, "+", f(1, 4)])).toBe(false);
    expect(ok("fraction.calculate", [null, "+", f(1, 4)])).toBe(false);
    expect(ok("fraction.calculate", [f(0, 3), "+", f(1, 4)])).toBe(false);
    expect(ok("fraction.plain", [f(1, 3), "+", f(1, 4), true])).toBe(false);
    expect(ok("fraction.plain", [f(1, 3), "+"])).toBe(false);
    expect(ok("fraction.common", [f(1, 2)])).toBe(false);
    expect(ok("fraction.common", [f(1, 2), f(1, 3), f(1, 4)])).toBe(false);
    expect(ok("fraction.common", [])).toBe(false);
    expect(ok("fraction.compare", [f(1, 2), 3])).toBe(false);
    expect(ok("fraction.reduce", [f(4, 6)])).toBe(false);
    expect(ok("fraction.reduce", [f(4, 6), "1/2"])).toBe(false);
    expect(ok("fraction.estimate", [f(3, 4), "+", f(1, 2)])).toBe(false);
  });

  it("正規化した args は省ける値を省く", () => {
    expect(maker("fraction.calculate").check([f(5, 4), "+", f(1, 2), false])).toEqual({ ok: true, args: [f(5, 4), "+", f(1, 2)] });
    expect(maker("fraction.calculate").check([f(5, 4), "+", f(1, 2), true])).toEqual({ ok: true, args: [f(5, 4), "+", f(1, 2), true] });
    expect(maker("fraction.calculate").check([{ num: 5, den: 4, extra: 1 }, "+", f(1, 2)])).toEqual({ ok: true, args: [f(5, 4), "+", f(1, 2)] });
  });

  it("タイルの上限（盤の1の数 3、1の数 × 分母 48、タイルの分母 24）", () => {
    // 答えが 3 になる盤は通り、3 を超えると落ちる
    expect(ok("fraction.calculate", [f(5, 2), "+", f(1, 2)])).toBe(true);
    expect(ok("fraction.calculate", [f(5, 2), "+", f(3, 2)])).toBe(false);
    // 1の数 × 分母 = 48 は通る（3 × 16）、超えると落ちる（3 × 17）
    expect(ok("fraction.calculate", [f(5, 2), "+", f(1, 16)])).toBe(true);
    expect(ok("fraction.calculate", [f(5, 2), "+", f(1, 17)])).toBe(false);
    // 通分のタイルの分母が 24 を超える（1/20 と 1/3 → 60）
    expect(ok("fraction.common", [f(1, 20), f(1, 3)])).toBe(false);
    // ちょうど 24
    expect(ok("fraction.common", [f(1, 8), f(1, 3)])).toBe(true);
    // 約分の問題も同じ上限
    expect(ok("fraction.reduce", [f(20, 8), f(1, 3)])).toBe(true);
    expect(ok("fraction.reduce", [f(40, 8), f(1, 3)])).toBe(false);
    // estimate はタイルを出さないので、分母の範囲だけ見る
    expect(ok("fraction.estimate", [f(5, 2), "+", f(3, 2), ONE])).toBe(true);
  });
});

describe("build は今の組み立て関数と同じ", () => {
  it("6つ", () => {
    const calc = [f(5, 4), "+", f(1, 2), true] satisfies Arg[];
    expect(maker("fraction.calculate").build(calc)).toEqual(calculateProblem(f(5, 4), "+", f(1, 2), true));
    expect(maker("fraction.calculate").build([f(1, 3), "+", f(1, 4)])).toEqual(calculateProblem(f(1, 3), "+", f(1, 4)));
    expect(maker("fraction.plain").build([f(2, 3), "+", f(1, 4)])).toEqual(plainProblem(f(2, 3), "+", f(1, 4)));
    expect(maker("fraction.reduce").build([f(4, 6), f(1, 2)])).toEqual(reduceProblem(f(4, 6), f(1, 2)));
    expect(maker("fraction.common").build([f(1, 2), f(1, 3)])).toEqual(commonProblem(f(1, 2), f(1, 3)));
    expect(maker("fraction.compare").build([f(1, 2), f(2, 5)])).toEqual(compareProblem(f(1, 2), f(2, 5)));
    expect(maker("fraction.estimate").build([f(3, 4), "+", f(1, 2), ONE])).toEqual(estimateProblem(f(3, 4), "+", f(1, 2), ONE));
  });

  it("check を通らない args では RangeError", () => {
    expect(() => maker("fraction.common").build([f(1, 2)])).toThrow(RangeError);
  });
});

describe("verify が落ちる例", () => {
  it("ヒントに答えの分数が入っている", () => {
    const calc = calculateProblem(f(1, 3), "+", f(1, 4));
    expect(maker("fraction.calculate").verify({ ...calc, hints: ["答えは 7/12 です"] })).toMatch(/7\/12/);
    expect(maker("fraction.calculate").verify({ ...calc, hints: ["答えは 1/12 です"] })).toBeNull();
    const reduce = reduceProblem(f(4, 6), f(1, 2));
    expect(maker("fraction.reduce").verify({ ...reduce, hints: ["2/3 にできます"] })).toMatch(/2\/3/);
    const common = commonProblem(f(1, 2), f(1, 3));
    expect(maker("fraction.common").verify({ ...common, hints: ["3/6 と 2/6 です"] })).toMatch(/3\/6/);
  });

  it("答えが 1 のとき n/1 の形も見つける", () => {
    const calc = calculateProblem(f(1, 2), "+", f(1, 2));
    expect(maker("fraction.calculate").verify({ ...calc, hints: ["答えは 1/1 です"] })).toMatch(/1\/1/);
  });

  it("関数と問題の kind が合わない", () => {
    expect(maker("fraction.calculate").verify(reduceProblem(f(4, 6), f(1, 2)))).not.toBeNull();
    expect(maker("fraction.reduce").verify(commonProblem(f(1, 2), f(1, 3)))).not.toBeNull();
    expect(maker("fraction.common").verify(compareProblem(f(1, 2), f(1, 3)))).not.toBeNull();
    expect(maker("fraction.estimate").verify(calculateProblem(f(1, 2), "+", f(1, 3)))).not.toBeNull();
  });

  it("plain と calculate は hintsBeforeTiles で見分ける", () => {
    expect(maker("fraction.plain").verify(calculateProblem(f(1, 2), "+", f(1, 3)))).not.toBeNull();
    expect(maker("fraction.calculate").verify(plainProblem(f(1, 2), "+", f(1, 3)))).not.toBeNull();
  });

  it("ひき算の答えが負・盤が作れない", () => {
    const negative = { ...calculateProblem(f(1, 3), "+", f(1, 4)), operator: "-" as const, right: f(1, 2) };
    expect(maker("fraction.calculate").verify(negative)).not.toBeNull();
    const tooBig = calculateProblem(f(5, 2), "+", f(3, 2));
    expect(maker("fraction.calculate").verify(tooBig)).not.toBeNull();
    const noPieces = { ...calculateProblem(f(1, 3), "+", f(1, 4)), pieces: [{ num: 1, den: 3, count: 1 }] };
    expect(maker("fraction.calculate").verify(noPieces)).not.toBeNull();
  });

  it("reduce：約分できない・wrongUnit でうまる・単位分数でない", () => {
    expect(maker("fraction.reduce").verify(reduceProblem(f(2, 3), f(1, 2)))).toMatch(/約分/);
    // 4/6 は 1/2 でうまらないが 1/6 ではうまる
    expect(maker("fraction.reduce").verify(reduceProblem(f(4, 6), f(1, 6)))).not.toBeNull();
    expect(maker("fraction.reduce").verify(reduceProblem(f(4, 6), f(2, 5)))).toMatch(/単位分数/);
    // 4/6 は 1/2 でうまらない（OK）。1/3 は約分した形の単位分数と同じで、うまらないタイルが無い
    expect(maker("fraction.reduce").verify(reduceProblem(f(4, 6), f(1, 3)))).not.toBeNull();
    expect(maker("fraction.reduce").verify(reduceProblem(f(4, 6), f(1, 4)))).toBeNull();
  });

  it("common/compare：分母が同じ", () => {
    expect(maker("fraction.common").verify(commonProblem(f(1, 3), f(2, 3)))).not.toBeNull();
    expect(maker("fraction.compare").verify(compareProblem(f(1, 3), f(2, 3)))).not.toBeNull();
  });
});

// 今の問題を、関数の名前と args の呼び出しに直す
function callOf(problem: TileProblem): { name: string; args: Arg[] } {
  if (problem.kind === "reduce") {
    const wrongUnit = problem.pieces[problem.pieces.length - 1];
    return { name: "fraction.reduce", args: [problem.value, { num: wrongUnit.num, den: wrongUnit.den }] };
  }
  if (problem.kind === "common") return { name: "fraction.common", args: [problem.left, problem.right] };
  if (problem.kind === "compare") return { name: "fraction.compare", args: [problem.left, problem.right] };
  if (problem.kind === "divide") return { name: "fraction.divide", args: [problem.dividend, problem.divisor] };
  if (problem.kind === "equivalent") return { name: "fraction.equivalent", args: [problem.value.num, problem.value.den, problem.target] };
  if (problem.kind === "estimate") return { name: "fraction.estimate", args: [problem.left, problem.operator, problem.right, problem.threshold] };
  const expression: Arg[] = [problem.left, problem.operator, problem.right];
  if (problem.hintsBeforeTiles !== undefined) return { name: "fraction.plain", args: expression };
  return { name: "fraction.calculate", args: problem.showMixed ? [...expression, true] : expression };
}

// 全部の章の全行は plans/sansu-5.test.ts が見る。ここはタイルの問題（fraction.*）を、今の問題の作り方に戻して確かめる
describe("既定の出題表の分数のタイルの行", () => {
  const cases = Object.entries(DEFAULT_PLANS)
    .flatMap(([planId, plan]) => plan.entries.map((entry, index) => ({ planId, index, entry })))
    .filter(({ entry }) => entry.maker.startsWith("fraction."));

  it("行がある", () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
  });

  it.each(cases)("$planId の $index 行目は check・build・verify を通り、問題から呼び出しに戻せる", ({ entry }) => {
    const found = maker(entry.maker);
    const checked = found.check(entry.args);
    expect(checked).toEqual({ ok: true, args: entry.args });
    if (!checked.ok) return;
    const built = found.build(checked.args);
    expect(found.verify(built)).toBeNull();
    if (built.kind === "number") throw new Error(`分数のタイルの関数が数の問題を作った: ${entry.maker}`);
    expect(callOf(built)).toEqual({ name: entry.maker, args: checked.args });
    expect(problemIdOf(entry.maker, checked.args)).toMatch(/^fraction\.[a-z]+\(.+\)$/);
  });

  it("どの学習の中でも id が重ならない", () => {
    for (const plan of Object.values(DEFAULT_PLANS)) {
      const ids = plan.entries.map((entry) => problemIdOf(entry.maker, entry.args));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

/* ---------- わり算と分数、同じ大きさの分数（FR-007） ---------- */

const divide = FRACTION_DIVIDE;
const equivalent = FRACTION_EQUIVALENT;

describe("fraction.divide の check", () => {
  const passes = (...args: unknown[]): boolean => divide.check(args).ok;

  it("b は 2〜20、a は 1 以上", () => {
    expect(passes(3, 4)).toBe(true);
    expect(passes(3, 2)).toBe(true);
    expect(passes(3, 1)).toBe(false);
    expect(passes(3, 0)).toBe(false);
    expect(passes(1, 20)).toBe(true);
    expect(passes(3, 21)).toBe(false);
    expect(passes(1, 2)).toBe(true);
    expect(passes(0, 4)).toBe(false);
    expect(passes(-1, 4)).toBe(false);
  });

  it("整数でない値と個数のちがいは理由つきで落とす", () => {
    expect(passes(1.5, 4)).toBe(false);
    expect(passes("3", 4)).toBe(false);
    expect(passes(f(3, 1), 4)).toBe(false);
    expect(passes(3)).toBe(false);
    expect(passes(3, 4, 5)).toBe(false);
    expect(divide.check([3, 1])).toEqual({ ok: false, reason: expect.stringContaining("2〜20") });
  });

  it("盤の上限（1の数 3、1の数 × 分母 48）で落とす", () => {
    expect(passes(9, 3)).toBe(true); // 1の数 3、3×3
    expect(passes(10, 3)).toBe(false); // 1の数 4
    expect(passes(6, 20)).toBe(true); // 1の数 1
    expect(passes(41, 20)).toBe(false); // 1の数 3 × 20 = 60
    expect(passes(40, 20)).toBe(true); // 1の数 2 × 20 = 40
    expect(passes(60, 20)).toBe(false); // 1の数 3 × 20 = 60
  });

  it("args は正規化して返す", () => {
    expect(divide.check([3, 4])).toEqual({ ok: true, args: [3, 4] });
  });

  it("build は check を通らない args で RangeError", () => {
    expect(() => divide.build([3, 1])).toThrow(RangeError);
    expect(() => divide.build([0, 4])).toThrow(RangeError);
  });
});

describe("fraction.equivalent の check", () => {
  const passes = (...args: unknown[]): boolean => equivalent.check(args).ok;

  it("den と target は 2〜20、num は 1 以上", () => {
    expect(passes(1, 2, 4)).toBe(true);
    expect(passes(1, 1, 4)).toBe(false);
    expect(passes(1, 2, 1)).toBe(false);
    expect(passes(1, 20, 20)).toBe(false); // 同じ分母
    expect(passes(1, 2, 20)).toBe(true);
    expect(passes(1, 2, 21)).toBe(false);
    expect(passes(1, 21, 3)).toBe(false);
    expect(passes(0, 2, 4)).toBe(false);
  });

  it("target は den の倍数か約数", () => {
    expect(passes(1, 2, 6)).toBe(true); // 倍数
    expect(passes(4, 6, 3)).toBe(true); // 約数
    expect(passes(1, 2, 3)).toBe(false);
    expect(passes(2, 6, 4)).toBe(false);
    expect(passes(1, 2, 2)).toBe(false); // 同じ分母は問題にならない
  });

  it("num × target ÷ den が整数", () => {
    expect(passes(2, 6, 3)).toBe(true); // 1
    expect(passes(1, 6, 3)).toBe(false); // 1/2
    expect(passes(3, 6, 2)).toBe(true);
    expect(passes(1, 4, 2)).toBe(false);
  });

  it("盤の上限で落とす", () => {
    expect(passes(3, 4, 12)).toBe(true);
    expect(passes(7, 4, 20)).toBe(true); // 1の数 2 × 20 = 40
    expect(passes(5, 2, 20)).toBe(false); // 1の数 3 × 20 = 60
    expect(passes(60, 2, 20)).toBe(false); // 1の数が 3 を超える
  });

  it("build は check を通らない args で RangeError", () => {
    expect(() => equivalent.build([1, 2, 3])).toThrow(RangeError);
    expect(equivalent.check([1, 2, 4])).toEqual({ ok: true, args: [1, 2, 4] });
  });
});

describe("default-plan.md の行", () => {
  const rows: [ProblemMaker, Arg[]][] = [
    ...[[3, 4], [2, 5], [7, 3], [5, 2], [6, 3], [4, 3]].map((args): [ProblemMaker, Arg[]] => [divide, args]),
    ...[[1, 2, 4], [2, 3, 6], [3, 4, 12], [4, 6, 3], [6, 8, 4], [3, 5, 10]].map((args): [ProblemMaker, Arg[]] => [equivalent, args]),
  ];

  it.each(rows)("%# 行目は check・build・verify を通る", (found, args) => {
    const checked = found.check(args);
    expect(checked).toEqual({ ok: true, args });
    if (!checked.ok) return;
    const built = found.build(checked.args);
    expect(found.verify(built)).toBeNull();
    if (built.kind === "number") throw new Error("数の問題です");
    expect(callOf(built)).toEqual({ name: found.name, args });
    expect(problemIdOf(found.name, args)).toMatch(/^fraction\.(divide|equivalent)\([\d,]+\)$/);
  });

  it("FRACTION_MAKERS は名前が重ならず、8つ", () => {
    expect(FRACTION_MAKERS.map((entry) => entry.name)).toEqual(MAKERS.map((entry) => entry.name).filter((name) => name.startsWith("fraction.")));
    expect(FRACTION_MAKERS).toHaveLength(8);
  });
});

describe("divide・equivalent の verify が落ちる例", () => {
  it("ヒントに答えが入っている", () => {
    const leaky = { ...divideProblem(3, 4), hints: ["答えは 3/4 です"] };
    expect(divide.verify(leaky)).toMatch(/3\/4/);
    const whole = { ...divideProblem(6, 3), hints: ["答えは 2 です"] };
    expect(divide.verify(whole)).toMatch(/2/);
    // 3÷3 の答え 1 は、ヒントの「3」と混ざらない。問題に書いてある数は伏せなくてよい
    expect(divide.verify({ ...divideProblem(4, 2), hints: ["2 こに分けます"] })).toBeNull();
    expect(equivalent.verify({ ...equivalentProblem(f(1, 2), 4), hints: ["2 まいです"] })).toMatch(/2/);
    expect(equivalent.verify({ ...equivalentProblem(f(1, 2), 4), hints: ["2/4 です"] })).toMatch(/2/);
  });

  it("ほかの種類の問題や、タイルの足りない問題は落とす", () => {
    expect(divide.verify(reduceProblem(f(2, 4), f(1, 3)))).toMatch(/divide/);
    expect(equivalent.verify(divideProblem(3, 4))).toMatch(/equivalent/);
    expect(divide.verify({ ...divideProblem(3, 4), pieces: [{ num: 1, den: 4, count: 2 }] })).not.toBeNull();
    expect(equivalent.verify({ ...equivalentProblem(f(1, 2), 4), pieces: [f(1, 2) as never] })).not.toBeNull();
  });
});
