import { describe, expect, it } from "vitest";
import { GRADES, KANJI_BY_GRADE, kanjiGrade } from "./kanji-grades";

describe("学年別漢字配当表", () => {
  it("学年ごとの字数は 80/160/200/202/193/191 で、合わせて 1026字", () => {
    expect(GRADES.map((grade) => [...KANJI_BY_GRADE[grade]].length)).toEqual([80, 160, 200, 202, 193, 191]);
    expect(GRADES.reduce((sum, grade) => sum + [...KANJI_BY_GRADE[grade]].length, 0)).toBe(1026);
  });

  it("学年どうしで字が重ならない", () => {
    const all = GRADES.flatMap((grade) => [...KANJI_BY_GRADE[grade]]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("字の学年を返し、表に無い字は null", () => {
    expect(kanjiGrade("一")).toBe(1);
    expect(kanjiGrade("前")).toBe(2);
    expect(kanjiGrade("胃")).toBe(6);
    expect(kanjiGrade("盤")).toBeNull();
    expect(kanjiGrade("あ")).toBeNull();
    expect(kanjiGrade("")).toBeNull();
  });
});
