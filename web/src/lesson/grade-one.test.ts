import { describe, expect, it } from "vitest";
import { chaptersOf } from "../data/courses";
import { findGradeOne, gradeOneSummary, hasGradeOne } from "./grade-one";
describe("1ねんせいのさんすう", () => {
  it("各章のすべてのマスとまとめに学びがある", () => {
    const chapters = chaptersOf(1, "sansu");
    expect(chapters).toHaveLength(6);
    for (const chapter of chapters) {
      expect(hasGradeOne(chapter.id)).toBe(true);
      chapter.items.forEach((_, index) => expect(findGradeOne(chapter.id, { kind: "main", index })).toBeDefined());
      expect(gradeOneSummary(chapter.id)).toHaveLength(chapter.items.length);
      expect(findGradeOne(chapter.id, { kind: "main", index: chapter.items.length })).toBeUndefined();
      expect(findGradeOne(chapter.id, { kind: "test" })).toBeDefined();
    }
    expect(hasGradeOne("fraction")).toBe(false);
  });
});
