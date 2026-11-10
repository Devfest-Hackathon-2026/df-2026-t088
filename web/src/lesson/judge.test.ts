import { describe, expect, it } from "vitest";
import { judgeAnswer, judgeCommon, judgeReduced, readAnswer } from "./judge";

describe("帯分数の答えの読み方", () => {
  it.each(["1と3/4", "1 と 3/4", "1　と　3/4", "1 3/4", "１と３／４", " 1と 3/4 "])("「%s」は 7/4 として正解", (text) => {
    expect(judgeAnswer(text, { num: 7, den: 4 })).toBe("correct");
  });

  it("「と」だけや、分数のない帯分数は読めない", () => {
    expect(judgeAnswer("1と", { num: 7, den: 4 })).toBe("invalid");
    expect(judgeAnswer("と3/4", { num: 7, den: 4 })).toBe("invalid");
  });
});

describe("帯分数は約分せずに読む（#125）", () => {
  it("「0と4/6」は 4/6 のまま読む", () => {
    expect(readAnswer("0と4/6")).toEqual({ num: 4, den: 6 });
    expect(readAnswer("1と3/4")).toEqual({ num: 7, den: 4 });
  });

  it("約分の答えが「0と4/6」なら、まだ約分できる", () => {
    expect(judgeReduced("0と4/6", { num: 2, den: 3 })).toBe("not_lowest");
    expect(judgeReduced("4/6", { num: 2, den: 3 })).toBe("not_lowest");
    expect(judgeReduced("0と2/3", { num: 2, den: 3 })).toBe("correct");
    expect(judgeReduced("1と1/2", { num: 3, den: 2 })).toBe("correct");
  });

  it("通分の答えが「0と3/6」「0と2/6」なら、分母がそろっている", () => {
    expect(judgeCommon(["0と3/6", "0と2/6"], { num: 1, den: 2 }, { num: 1, den: 3 })).toBe("correct");
    expect(judgeCommon(["0と3/6", "0と1/3"], { num: 1, den: 2 }, { num: 1, den: 3 })).toBe("not_common");
  });

  it("大きすぎる帯分数は読まない", () => {
    expect(readAnswer("9007199254740991と1/2")).toBeNull();
    expect(judgeAnswer("9007199254740991と1/2", { num: 1, den: 2 })).toBe("invalid");
  });
});
