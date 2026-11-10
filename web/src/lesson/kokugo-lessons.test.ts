import { describe, expect, it } from "vitest";
import { kanjiGrade } from "../data/kanji-grades";
import { KOKUGO_COURSE, findKokugoLesson } from "./kokugo-lessons";
import { isKanaOnly } from "./quiz";

const chapterId = "kokugo-kanji-5";
const lessons = [
  { key: "main-0", target: { kind: "main" as const, index: 0 }, count: 4 },
  { key: "main-1", target: { kind: "main" as const, index: 1 }, count: 4 },
  { key: "main-2", target: { kind: "main" as const, index: 2 }, count: 4 },
  { key: "main-3", target: { kind: "main" as const, index: 3 }, count: 4 },
  { key: "test", target: { kind: "test" as const }, count: 6 },
];

const kanjiIn = (text: string) => [...text].filter((character) => kanjiGrade(character) !== null);

describe("国語5年の漢字レッスン", () => {
  it("5つのレッスンを開ける", () => {
    for (const { target } of lessons) expect(KOKUGO_COURSE.hasLesson(chapterId, target)).toBe(true);
  });

  it("表の問題数とIDを保ち、IDを重ねない", () => {
    const ids: string[] = [];
    for (const { key, count } of lessons) {
      const lesson = findKokugoLesson(chapterId, key);
      expect(lesson?.problems).toHaveLength(count);
      ids.push(...(lesson?.problems.map(({ id }) => id) ?? []));
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("学年配当、答え、選択肢が表の条件を満たす", () => {
    for (const { key } of lessons) {
      const lesson = findKokugoLesson(chapterId, key)!;
      for (const problem of lesson.problems) {
        const subjectKanji = kanjiIn(problem.subject);
        expect(subjectKanji.every((character) => (kanjiGrade(character) ?? 7) <= 5)).toBe(true);
        if (problem.prompt === "reading") {
          expect(subjectKanji.some((character) => kanjiGrade(character) === 5)).toBe(true);
          if (problem.kind === "input") expect(isKanaOnly(problem.answer)).toBe(true);
          else {
            expect(problem.choices).toContain(problem.answer);
            expect(problem.choices).toHaveLength(3);
            expect(new Set(problem.choices).size).toBe(3);
          }
        } else {
          expect(problem.kind).toBe("choice");
          expect(kanjiGrade(problem.answer)).toBe(4);
          expect(problem.choices).toContain(problem.answer);
          expect(problem.choices).toHaveLength(3);
          expect(new Set(problem.choices).size).toBe(3);
        }
      }
    }
  });
});
