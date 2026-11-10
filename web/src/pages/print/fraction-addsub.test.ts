import { describe, expect, it } from "vitest";
import { expressionMatches, fractionExpression, fractionLessonOf, fractionRangeReason, readFractionParams } from "./fraction-addsub";
import type { FractionAddSubParams } from "./types";

const params = (l: [number, number], op: "+" | "-", r: [number, number]): FractionAddSubParams => ({ left: { num: l[0], den: l[1] }, op, right: { num: r[0], den: r[1] } });

describe("分数のたし算・ひき算の受ける範囲", () => {
  it.each([
    [params([1, 2], "+", [1, 3])],
    [params([3, 4], "-", [1, 6])],
    [params([2, 3], "+", [1, 4])],
    [params([2, 2], "+", [4, 2])], // 答えがちょうど 3
  ])("範囲の中は null: %j", (value) => expect(fractionRangeReason(value)).toBeNull());

  it.each([
    ["分母が 1", params([1, 1], "+", [1, 3])],
    ["分母が 13", params([1, 13], "+", [1, 3])],
    ["分子が 0", params([0, 2], "+", [1, 3])],
    ["分数が 2 を超える", params([5, 2], "+", [1, 3])],
    ["通分した分母が 24 を超える", params([1, 7], "+", [1, 11])],
    ["たし算の答えが 3 を超える", params([4, 2], "+", [3, 2])],
    ["ひき算で左が右より小さい", params([1, 3], "-", [1, 2])],
    ["ひき算で左右が等しい", params([1, 2], "-", [2, 4])],
  ])("範囲の外は理由が出る: %s", (_label, value) => expect(fractionRangeReason(value)).toEqual(expect.any(String)));

  it("形が合う params だけ読む。余計な項目と整数でない値は断る", () => {
    expect(readFractionParams(params([1, 2], "+", [1, 3]))).toEqual(params([1, 2], "+", [1, 3]));
    expect(readFractionParams({ ...params([1, 2], "+", [1, 3]), extra: 1 })).toBeNull();
    expect(readFractionParams({ left: { num: 1, den: 2, x: 1 }, op: "+", right: { num: 1, den: 3 } })).toBeNull();
    expect(readFractionParams({ left: { num: 1.5, den: 2 }, op: "+", right: { num: 1, den: 3 } })).toBeNull();
    expect(readFractionParams({ left: { num: 1, den: 2 }, op: "*", right: { num: 1, den: 3 } })).toBeNull();
    expect(readFractionParams(null)).toBeNull();
  });

  it("式の文は params と同じ式のときだけ合う", () => {
    const value = params([3, 4], "-", [1, 6]);
    expect(fractionExpression(value)).toBe("3/4 - 1/6");
    expect(expressionMatches("3/4 - 1/6", value)).toBe(true);
    expect(expressionMatches("3/4-1/6", value)).toBe(true);
    expect(expressionMatches("3/4 + 1/6", value)).toBe(false);
    expect(expressionMatches("3/8 - 1/6", value)).toBe(false);
    expect(expressionMatches("3/4 ひく 1/6", value)).toBe(false);
  });

  it("範囲の中は学習の定義になり、外・式の違いは null", () => {
    const lesson = fractionLessonOf("1/2 + 1/3", params([1, 2], "+", [1, 3]));
    expect(lesson?.problems).toHaveLength(1);
    expect(lesson?.problems[0]).toMatchObject({ kind: "calculate", operator: "+" });
    expect(fractionLessonOf("1/7 + 1/11", params([1, 7], "+", [1, 11]))).toBeNull();
    expect(fractionLessonOf("1/2 + 1/4", params([1, 2], "+", [1, 3]))).toBeNull();
    expect(fractionLessonOf("1/2 + 1/3", { nonsense: true })).toBeNull();
  });
});
