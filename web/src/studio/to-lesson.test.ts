import { describe, expect, it } from "vitest";
import { gameOf } from "../lesson/problems";
import { STUDIO_FIXTURES } from "./api";
import { toLesson } from "./to-lesson";

describe("toLesson", () => {
  it("IR の問題を既存の学習教材にし、ヒントだけを置き換える", () => {
    const lesson = toLesson(STUDIO_FIXTURES.valid);
    expect(lesson.id).toBe("studio-preview");
    expect(lesson.problems).toHaveLength(STUDIO_FIXTURES.valid.problems.length);
    expect(lesson.problems[0]?.hints).toEqual(STUDIO_FIXTURES.valid.problems[0]?.hints);
    expect(() => gameOf(lesson.problems[0]!)).not.toThrow();
  });

  it("calculate、common、compare を既存の組み立て関数へ渡す", () => {
    for (const kind of ["calculate", "common", "compare"] as const) {
      const ir = { ...STUDIO_FIXTURES.valid, problems: [{ ...STUDIO_FIXTURES.valid.problems[0]!, kind }] };
      expect(() => gameOf(toLesson(ir).problems[0]!)).not.toThrow();
    }
  });
});
