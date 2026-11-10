import { describe, expect, it } from "vitest";
import { isKanaOnly, judgeInput, normalizeAnswer } from "./quiz";

describe("答えを整える", () => {
  it("全角・半角、カタカナ、前後の空白をそろえる", () => {
    expect(normalizeAnswer("  ｶﾞｯｺｳ　")).toBe("がっこう");
    expect(normalizeAnswer("ガッコウ")).toBe("がっこう");
    expect(normalizeAnswer("  ねん  ")).toBe("ねん");
  });

  it("かな以外を含む入力を判定する", () => {
    expect(isKanaOnly("ひらがなー")).toBe(true);
    expect(isKanaOnly("かな1")).toBe(false);
    expect(judgeInput("漢字", "かんじ")).toBe("notKana");
    expect(judgeInput(" ｶﾝｼﾞ ", "かんじ")).toBe("correct");
  });
});
