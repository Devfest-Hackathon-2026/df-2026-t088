import { describe, expect, it } from "vitest";
import { classifyWrongAnswer } from "./error-pattern";
import type { Fraction, Operator } from "./fraction";
import { calculateProblem } from "./problems";

const f = (num: number, den: number): Fraction => ({ num, den });
const problem = (left: Fraction, operator: Operator, right: Fraction) => calculateProblem(left, operator, right);

describe("classifyWrongAnswer", () => {
  it("分子どうし、分母どうしを計算した答えは sum-both", () => {
    expect(classifyWrongAnswer(problem(f(1, 3), "+", f(1, 4)), "2/7")).toBe("sum-both");
    expect(classifyWrongAnswer(problem(f(5, 6), "-", f(1, 2)), "4/4")).toBe("sum-both");
  });

  it("分子だけを計算して、分母は足さない答えは sum-num-only。分母の選び方は区別しない", () => {
    expect(classifyWrongAnswer(problem(f(1, 3), "+", f(1, 4)), "2/12")).toBe("sum-num-only");
    expect(classifyWrongAnswer(problem(f(1, 3), "+", f(1, 4)), "2/3")).toBe("sum-num-only");
    expect(classifyWrongAnswer(problem(f(1, 3), "+", f(1, 4)), "2/4")).toBe("sum-num-only");
  });

  it("分母をそろえたが、分母もたした答え（正しい答えの半分）は same-den-sum", () => {
    expect(classifyWrongAnswer(problem(f(1, 3), "+", f(1, 4)), "7/24")).toBe("same-den-sum");
  });

  it("どの規則にも合わない答えは unclassified", () => {
    expect(classifyWrongAnswer(problem(f(1, 3), "+", f(1, 4)), "1/5")).toBe("unclassified");
    expect(classifyWrongAnswer(problem(f(1, 3), "+", f(1, 4)), "3")).toBe("unclassified");
  });

  it("2つ以上の型に合う答えは、どちらとも決めず unclassified にする", () => {
    // 1/2 + 1/2 の 1/2 は、same-den-sum（正しい答え 1 の半分）とも、sum-num-only の 2/4 とも値が同じ
    expect(classifyWrongAnswer(problem(f(1, 2), "+", f(1, 2)), "1/2")).toBe("unclassified");
  });

  it("5/6 − 1/3 の 4/3 は、「分子も分母も引いた」とも「分子だけ引いて分母は 3 のまま」とも読めるので、決めない", () => {
    expect(classifyWrongAnswer(problem(f(5, 6), "-", f(1, 3)), "4/3")).toBe("unclassified");
  });

  it("読めない答えと、正しい答えは unclassified（型を付けない）", () => {
    expect(classifyWrongAnswer(problem(f(1, 3), "+", f(1, 4)), "たなか")).toBe("unclassified");
    expect(classifyWrongAnswer(problem(f(1, 3), "+", f(1, 4)), "7/12")).toBe("unclassified");
  });

  it("全角と、約分していない書き方も同じ値として扱う", () => {
    expect(classifyWrongAnswer(problem(f(1, 3), "+", f(1, 4)), "２／７")).toBe("sum-both");
    expect(classifyWrongAnswer(problem(f(1, 3), "+", f(1, 4)), "1/6")).toBe("sum-num-only");
  });

  it("分母が同じたし算で分母もたした答えは same-den-sum（sum-both と取り合わない、#264）", () => {
    expect(classifyWrongAnswer(problem(f(1, 5), "+", f(2, 5)), "3/10")).toBe("same-den-sum");
    expect(classifyWrongAnswer(problem(f(2, 7), "+", f(3, 7)), "5/14")).toBe("same-den-sum");
  });

  it("分母が同じひき算は今までどおり（sum-both は分母が 0 になり候補から外れる）", () => {
    expect(classifyWrongAnswer(problem(f(3, 5), "-", f(1, 5)), "2/0")).toBe("unclassified");
    expect(classifyWrongAnswer(problem(f(3, 5), "-", f(1, 5)), "2/10")).toBe("unclassified");
  });

  it("5 年の計算の問題で、3 つの型の代表の答えが 1 つの型に決まる（決まらないのは下の 1 つだけ）", () => {
    // sansu-5.ts の計算問題（分母はすべて異なる）。代表の間違いが別の型とぶつかると、記録から落ちる
    const cases: [Fraction, Operator, Fraction][] = [
      [f(1, 3), "+", f(1, 4)], [f(2, 3), "+", f(1, 4)], [f(2, 5), "+", f(3, 10)], [f(5, 6), "-", f(1, 3)],
      [f(2, 3), "-", f(1, 4)], [f(3, 4), "-", f(1, 6)], [f(7, 10), "-", f(1, 4)], [f(3, 2), "+", f(1, 3)],
      [f(7, 6), "+", f(2, 3)], [f(9, 4), "-", f(5, 6)], [f(2, 3), "+", f(1, 6)], [f(3, 4), "-", f(1, 3)],
      [f(3, 2), "+", f(1, 4)], [f(1, 3), "+", f(1, 6)], [f(1, 4), "+", f(1, 3)], [f(1, 4), "+", f(1, 6)],
    ];
    const lcm = (a: number, b: number): number => { let x = a; while (x % b !== 0) x += a; return x; };
    const unresolved: string[] = [];
    for (const [left, op, right] of cases) {
      const p = problem(left, op, right);
      const apply = (a: number, b: number) => (op === "+" ? a + b : a - b);
      const both = `${apply(left.num, right.num)}/${apply(left.den, right.den)}`;
      const den = lcm(left.den, right.den);
      const numOnly = `${apply(left.num, right.num)}/${den}`;
      const expression = `${left.num}/${left.den}${op}${right.num}/${right.den}`;
      if (apply(left.den, right.den) > 0 && apply(left.num, right.num) > 0 && classifyWrongAnswer(p, both) !== "sum-both") unresolved.push(`${expression} ${both}`);
      if (apply(left.num, right.num) > 0 && classifyWrongAnswer(p, numOnly) !== "sum-num-only") unresolved.push(`${expression} ${numOnly}`);
      if (op === "+") {
        const half = `${left.num * (den / left.den) + right.num * (den / right.den)}/${den * 2}`;
        if (classifyWrongAnswer(p, half) !== "same-den-sum") unresolved.push(`${expression} ${half}`);
      }
    }
    // 5/6 − 1/3 の 4/3 は、分母どうしを引いた形と、分子だけ引いて分母 3 のままの形が同じ値（上のテストのとおり、決めない）
    expect(unresolved).toEqual(["5/6-1/3 4/3"]);
  });

  it("ひき算では same-den-sum を使わない", () => {
    expect(classifyWrongAnswer(problem(f(5, 6), "-", f(1, 3)), "1/4")).toBe("unclassified");
  });
});
