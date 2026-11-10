import { describe, expect, it } from "vitest";
import { CHAPTERS } from "./chapters";

const DOMAIN_DIGIT: Record<string, string> = { A: "1", B: "2", C: "3", D: "4" };
const KANA_DIGIT: Record<string, string> = { ア: "1", イ: "2", ウ: "3", エ: "4" };

/** A(4)ア(イ) の形の記号を、学習指導要領コードに直す。それ以外の形は null */
function codeOf(source: string): string | null {
  const match = /^([A-D])\((\d)\)([アイ])\(([アイウエ])\)$/.exec(source);
  if (!match) return null;
  const [, domain = "", section = "", part = "", item = ""] = match;
  return `8250253${DOMAIN_DIGIT[domain]}${section}${KANA_DIGIT[part]}${KANA_DIGIT[item]}00000`;
}

const SOURCED = CHAPTERS.flatMap((chapter) => [...chapter.items, ...chapter.sides]).filter((item) => item.source);

describe("章のデータ", () => {
  it("章は学習指導要領の記号の順に並べ、順番を付けない（D-130）", () => {
    expect(CHAPTERS.map((chapter) => chapter.id)).toEqual([
      "integer", "decimal", "fraction", "expression", "plane", "solid", "area", "volume", "proportion", "unit", "ratio", "graph", "average",
    ]);
    expect(CHAPTERS.every((chapter) => !chapter.ordered)).toBe(true);
  });

  it("出典の記号があるマスと寄り道は、5年の算数の学習指導要領コードを持つ（D-80）", () => {
    expect(SOURCED.length).toBeGreaterThan(0);
    for (const { codes } of SOURCED) {
      expect(codes?.length).toBeGreaterThan(0);
      for (const code of codes ?? []) expect(code).toMatch(/^825025[35]\d{9}$/);
    }
  });

  it("コードは出典の記号と一致する", () => {
    for (const { source, codes } of SOURCED) {
      const expected = codeOf(source ?? "");
      if (expected) expect(codes).toEqual([expected]);
    }
  });
});
