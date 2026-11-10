import { describe, expect, it } from "vitest";
import { chaptersOf } from "../data/courses";
import { findGradeTwo, gradeTwoSummary, hasGradeTwo } from "./grade-two";

describe("2年生の算数", () => {
  it("すべての学習マスと章のまとめに対応する", () => {
    const chapters = chaptersOf(2, "sansu");
    expect(chapters).toHaveLength(7);
    for (const chapter of chapters) {
      expect(hasGradeTwo(chapter.id)).toBe(true);
      chapter.items.forEach((_, index) => {
        const lesson = findGradeTwo(chapter.id, { kind: "main", index });
        expect(lesson).toBeDefined();
        expect(lesson?.practice.problem).not.toBe(lesson?.test.problem);
      });
      expect(findGradeTwo(chapter.id, { kind: "main", index: chapter.items.length })).toBeUndefined();
      expect(gradeTwoSummary(chapter.id)).toHaveLength(chapter.items.length);
    }
    expect(hasGradeTwo("sansu-1-01")).toBe(false);
  });
});
