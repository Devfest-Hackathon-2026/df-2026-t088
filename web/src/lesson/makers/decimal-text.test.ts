import { describe, expect, it } from "vitest";
import { decimalPlaces, formatDecimal, isCanonicalDecimal, parseDecimal } from "./decimal-text";
import { mentionsNumber } from "./format";

describe("小数の文字", () => {
  it("読む", () => {
    expect(parseDecimal("12.34")).toEqual({ num: 1234, den: 100 });
    expect(parseDecimal("3")).toEqual({ num: 3, den: 1 });
    expect(parseDecimal(".5")).toBeNull();
    expect(parseDecimal("1.2.3")).toBeNull();
    expect(decimalPlaces("0.125")).toBe(3);
  });

  it("書く。余分な 0 を付けず、小数で終わらない分数は null", () => {
    expect(formatDecimal({ num: 1, den: 4 })).toBe("0.25");
    expect(formatDecimal({ num: 50, den: 100 })).toBe("0.5");
    expect(formatDecimal({ num: 6, den: 3 })).toBe("2");
    expect(formatDecimal({ num: 2485, den: 100000 })).toBe("0.02485");
    expect(formatDecimal({ num: 1, den: 3 })).toBeNull();
    expect(isCanonicalDecimal("0.50")).toBe(false);
    expect(isCanonicalDecimal("0.5")).toBe(true);
  });

  it("ヒントの中の数を、ほかの数の一部とまちがえない", () => {
    expect(mentionsNumber("12 の約数", "2")).toBe(false);
    expect(mentionsNumber("0.25 です", "2")).toBe(false);
    expect(mentionsNumber("0.25 です", "0.25")).toBe(true);
    expect(mentionsNumber("答えは 2 です", "2")).toBe(true);
    expect(mentionsNumber("2. つぎに", "2")).toBe(true);
    expect(mentionsNumber("1/2 の", "2")).toBe(false);
  });
});
