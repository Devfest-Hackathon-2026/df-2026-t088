import { describe, expect, it } from "vitest";
import { displayText, parseRuby, plainText } from "./ruby-text";

describe("ふりがな記法", () => {
  it("[漢字|よみ] と <wbr> を分ける", () => {
    expect(parseRuby("[約数|やくすう]と<wbr>倍数")).toEqual([
      { type: "ruby", base: "約数", reading: "やくすう" },
      { type: "text", text: "と" },
      { type: "wbr" },
      { type: "text", text: "倍数" },
    ]);
  });

  it("読み上げ用の文はふりがなと <wbr> を除く", () => {
    expect(plainText("[最大|さいだい][公約数|こうやくすう]")).toBe("最大公約数");
    expect(plainText("10倍・100倍と<wbr>小数点")).toBe("10倍・100倍と小数点");
  });
});

describe("学年に合わせた文字列（D-91）", () => {
  it("語の漢字が全部学年以下なら漢字、1字でも上ならよみ", () => {
    // 前=2年、数=2年、整=3年、分=2年
    expect(displayText("[前|まえ]に[進|すす]む", 1)).toBe("まえにすすむ");
    expect(displayText("[前|まえ]", 2)).toBe("前");
    expect(displayText("[整数|せいすう]", 2)).toBe("せいすう");
    expect(displayText("[整数|せいすう]", 3)).toBe("整数");
    // 語の中に上の学年の字が1字でもあれば、語ごとひらがな（交ぜ書きにしない）
    expect(displayText("[分数|ぶんすう]", 1)).toBe("ぶんすう");
    expect(displayText("[分数|ぶんすう]", 2)).toBe("分数");
  });

  it("学年 1〜6 で、1年の字は 1年から、6年の字は 6年でだけ漢字になる", () => {
    for (const grade of [1, 2, 3, 4, 5, 6] as const) {
      expect(displayText("[一|いち]", grade)).toBe("一");
      expect(displayText("[胃|い]", grade)).toBe(grade === 6 ? "胃" : "い");
    }
  });

  it("配当表に無い字を含む語は、どの学年でもひらがな。6年までの字だけなら6年で漢字", () => {
    expect(displayText("[経験値|けいけんち]", 5)).toBe("けいけんち");
    expect(displayText("[経験値|けいけんち]", 6)).toBe("経験値");
    for (const grade of [1, 2, 3, 4, 5, 6] as const) {
      expect(displayText("[盤面|ばんめん]", grade)).toBe("ばんめん");
    }
  });

  it("注記の外の文字はそのまま。<wbr> は除く", () => {
    expect(displayText("10[倍|ばい]・100[倍|ばい]と<wbr>[小数点|しょうすうてん]", 1)).toBe("10ばい・100ばいとしょうすうてん");
    expect(displayText("1/2 のタイル", 1)).toBe("1/2 のタイル");
  });

  it("学年が null（設定の外）なら注記を外して漢字のまま。plainText と同じ", () => {
    const text = "[盤面|ばんめん]に[戻|もど]る<wbr>[今日|きょう]";
    expect(displayText(text, null)).toBe("盤面に戻る今日");
    expect(displayText(text, null)).toBe(plainText(text));
  });
});
