import { describe, expect, it } from "vitest";
import { ANSWER_MAX_LENGTH } from "./judge";
import { judgeChoice, judgeDecimal, judgeInteger, judgeMulti, judgeNumberText, judgeRemainder, readDecimal } from "./number-judge";

describe("小数の答え（FR-006）", () => {
  it("値が同じなら正解。0.5 と 0.50、3 と 3.0 は同じ", () => {
    expect(judgeDecimal("0.5", "0.5")).toBe("correct");
    expect(judgeDecimal("0.50", "0.5")).toBe("correct");
    expect(judgeDecimal("3.0", "3")).toBe("correct");
    expect(judgeDecimal(" 1.25 ", "1.25")).toBe("correct");
  });

  it("全角の数字と小数点も読む", () => {
    expect(judgeDecimal("０．５", "0.5")).toBe("correct");
    expect(judgeDecimal("１２", "12")).toBe("correct");
  });

  it("値がちがえば wrong。桁の近い値も同じにしない", () => {
    expect(judgeDecimal("0.05", "0.5")).toBe("wrong");
    expect(judgeDecimal("0.51", "0.5")).toBe("wrong");
    expect(judgeDecimal("0.10000000000001", "0.1")).toBe("wrong");
  });

  it("読めない入力は invalidDecimal で、間違いにしない", () => {
    for (const text of ["1.2.3", ".5", "5.", "-1", "1/2", "abc", "1,5", "0.5 0", ""]) {
      expect(judgeDecimal(text, "0.5")).toBe("invalidDecimal");
    }
  });

  it("長さは 40 字まで。41 字は読まない", () => {
    expect(ANSWER_MAX_LENGTH).toBe(40);
    expect(readDecimal(`0.${"0".repeat(38)}`)).toBeNull();
    expect(judgeDecimal(`0.${"0".repeat(ANSWER_MAX_LENGTH - 1)}`, "0")).toBe("invalidDecimal");
    expect(judgeDecimal("1".repeat(ANSWER_MAX_LENGTH + 1), "1")).toBe("invalidDecimal");
  });
});

describe("整数・分子だけの答え", () => {
  it("値が同じなら正解。全角も読む", () => {
    expect(judgeInteger("12", 12)).toBe("correct");
    expect(judgeInteger("１２", 12)).toBe("correct");
    expect(judgeInteger("012", 12)).toBe("correct");
    expect(judgeInteger("13", 12)).toBe("wrong");
  });

  it("小数や文字は invalidInteger", () => {
    for (const text of ["1.5", "12/1", "あ", "", "1".repeat(ANSWER_MAX_LENGTH + 1)]) {
      expect(judgeInteger(text, 12)).toBe("invalidInteger");
    }
  });
});

describe("分数の答え", () => {
  it("約分していなくても、値が同じなら正解。読めなければ invalid", () => {
    const answer = { type: "fraction", value: { num: 13, den: 100 } } as const;
    expect(judgeNumberText(["13/100", ""], answer)).toBe("correct");
    expect(judgeNumberText(["26/200", ""], answer)).toBe("correct");
    expect(judgeNumberText(["13/10", ""], answer)).toBe("wrong");
    expect(judgeNumberText(["0.13", ""], answer)).toBe("invalid");
    expect(judgeNumberText([`1/${"1".repeat(ANSWER_MAX_LENGTH)}`, ""], answer)).toBe("invalid");
  });
});

describe("商とあまり", () => {
  const expected = { quotient: 3, remainder: "0.6" };

  it("商が同じで、あまりの値が同じなら正解", () => {
    expect(judgeRemainder(["3", "0.6"], expected)).toBe("correct");
    expect(judgeRemainder(["３", "０．６０"], expected)).toBe("correct");
  });

  it("どちらかが違えば wrong", () => {
    expect(judgeRemainder(["2", "0.6"], expected)).toBe("wrong");
    expect(judgeRemainder(["3", "0.5"], expected)).toBe("wrong");
  });

  it("どちらかが空なら remainderEmpty、読めなければ欄に合わせた結果", () => {
    expect(judgeRemainder(["3", " "], expected)).toBe("remainderEmpty");
    expect(judgeRemainder(["", "0.6"], expected)).toBe("remainderEmpty");
    expect(judgeRemainder(["3.5", "0.6"], expected)).toBe("invalidInteger");
    expect(judgeRemainder(["3", "1.2.3"], expected)).toBe("invalidDecimal");
  });

  it("文字で答える形の入口でも同じ", () => {
    expect(judgeNumberText(["3", "0.6"], { type: "remainder", ...expected })).toBe("correct");
  });
});

describe("選ぶ", () => {
  it("1つ選ぶ：同じ選択肢なら正解", () => {
    expect(judgeChoice("even", "even")).toBe("correct");
    expect(judgeChoice("odd", "even")).toBe("wrong");
  });

  it("全部えらぶ：組が同じなら正解。順は問わない", () => {
    expect(judgeMulti([6, 1, 3, 2], [1, 2, 3, 6])).toBe("correct");
  });

  it("何も選ばなければ multiEmpty、足りなければ multiMissing、入らない数があれば multiExtra", () => {
    expect(judgeMulti([], [1, 2])).toBe("multiEmpty");
    expect(judgeMulti([1], [1, 2])).toBe("multiMissing");
    expect(judgeMulti([1, 2, 5], [1, 2])).toBe("multiExtra");
  });

  it("足りなくて、入らない数もまじる時は multiExtra", () => {
    expect(judgeMulti([1, 5], [1, 2])).toBe("multiExtra");
  });
});
