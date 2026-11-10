import { describe, expect, it } from "vitest";
import { AVAILABLE_EXPLANATION_LANGUAGES, EXPLANATION_LOCALES, explanationTemplateFor, missingTemplateStrings } from "./locales";

describe("説明の言語", () => {
  it("確認済みの言語だけを選択肢として出す", () => {
    expect(AVAILABLE_EXPLANATION_LANGUAGES.map((locale) => locale.code)).toEqual(["ja"]);
  });

  it("未確認の訳や文が足りない訳は日本語の全文へ戻す", () => {
    expect(explanationTemplateFor("en", "rika-lever")).toEqual(EXPLANATION_LOCALES.ja.templates["rika-lever"]);
    expect(explanationTemplateFor("vi", "rika-moon")).toEqual(EXPLANATION_LOCALES.ja.templates["rika-moon"]);
  });

  it("必要な文が不足した言語ファイルの項目を列挙し、日本語台本は完全", () => {
    expect(missingTemplateStrings(EXPLANATION_LOCALES.ja)).toEqual([]);
    expect(missingTemplateStrings(EXPLANATION_LOCALES.en)).toContain("rika-lever.title");
    expect(missingTemplateStrings(EXPLANATION_LOCALES["pt-BR"])).toContain("rika-moon.steps[2]");
    expect(missingTemplateStrings(EXPLANATION_LOCALES.vi)).toContain("rika-moon.conclusion");
  });

  it("分数の型は題名だけを持ち、手順と結びの文は要らない", () => {
    expect(EXPLANATION_LOCALES.ja.templates["sansu-fraction-addsub"].title).toBeTruthy();
    expect(missingTemplateStrings(EXPLANATION_LOCALES.ja)).toEqual([]);
    expect(missingTemplateStrings(EXPLANATION_LOCALES.en)).toContain("sansu-fraction-addsub.title");
    expect(explanationTemplateFor("en", "sansu-fraction-addsub")).toEqual(EXPLANATION_LOCALES.ja.templates["sansu-fraction-addsub"]);
  });
});
