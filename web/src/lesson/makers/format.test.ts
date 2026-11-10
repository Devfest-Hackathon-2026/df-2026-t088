import { describe, expect, it } from "vitest";
import { formatArgs, mentionsFraction, problemIdOf } from "./format";

const f = (num: number, den: number) => ({ num, den });

describe("problemIdOf", () => {
  it("決めた書き方の例", () => {
    expect(problemIdOf("fraction.calculate", [f(1, 3), "+", f(1, 4)])).toBe("fraction.calculate(1/3,+,1/4)");
    expect(problemIdOf("fraction.calculate", [f(5, 4), "+", f(1, 2), true])).toBe("fraction.calculate(5/4,+,1/2,m)");
    expect(problemIdOf("fraction.estimate", [f(3, 4), "+", f(1, 2), f(1, 1)])).toBe("fraction.estimate(3/4,+,1/2,1)");
    expect(problemIdOf("fraction.reduce", [f(4, 6), f(1, 2)])).toBe("fraction.reduce(4/6,1/2)");
  });

  it("約分せず、偽は省き、数は String で書く", () => {
    expect(formatArgs([f(2, 4), false, 7])).toBe("2/4,7");
  });
});

describe("mentionsFraction", () => {
  it("前後が数字でも / でもない所だけ数える", () => {
    expect(mentionsFraction("1/2 を使う", f(1, 2))).toBe(true);
    expect(mentionsFraction("1/12 を使う", f(1, 2))).toBe(false);
    expect(mentionsFraction("11/2 を使う", f(1, 2))).toBe(false);
    expect(mentionsFraction("3/4 から 1/2 を引く", f(1, 2))).toBe(true);
  });
});
