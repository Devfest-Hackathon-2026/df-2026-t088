import { describe, expect, it } from "vitest";
import { findAnyChapter } from "../data/courses";
import { findUpperMath, hasUpperMath, UPPER_MATH, upperMathSummary } from "./upper-math";

describe("4〜6年の教材", () => {
  it("約数の問いと、分けて確かめる手順を分ける", () => {
    const { practice, test } = UPPER_MATH.integer.main[1];
    expect(practice.problem).toBe("3は12の約数ですか？「はい」か「いいえ」で答えましょう。");
    expect(practice.hints[0]).toContain("12こを3こずつ");
    expect(test.problem).toBe("3は14の約数ですか？「はい」か「いいえ」で答えましょう。");
    expect(test.hints[0]).toContain("14こを3こずつ");
    expect(UPPER_MATH.integer.main[0].practice.problem).toBe("7は偶数と奇数のどちらですか？");
    expect(UPPER_MATH.integer.main[3].practice.problem).toBe("12と18の最大公約数はいくつですか？");
    expect(UPPER_MATH.integer.main[4].practice.problem).toBe("2と3の最小公倍数はいくつですか？");
  });
  it("実装した章の全マスと別問題のまとめを接続する", () => {
    for (const [id, lesson] of Object.entries(UPPER_MATH)) {
      const chapter = findAnyChapter(id);
      expect(chapter, id).toBeDefined();
      expect(lesson.main, id).toHaveLength(chapter!.items.length);
      expect(upperMathSummary(id)).toHaveLength(lesson.main.reduce((count, item) => count + 1 + (item.test.followUps?.length ?? 0), 0));
      lesson.main.forEach((item, index) => {
        expect(findUpperMath(id, { kind: "main", index })).toBe(item.practice);
        expect(item.practice.problem).not.toBe(item.test.problem);
        expect(item.practice.hints).toHaveLength(2);
      });
      expect(findUpperMath(id, { kind: "main", index: chapter!.items.length })).toBeUndefined();
      expect(findUpperMath(id, { kind: "test" })).toBeDefined();
      for (const side of Object.keys(lesson.sides ?? {})) expect(chapter!.sides.some((item) => item.id === side)).toBe(true);
    }
    expect(hasUpperMath("fraction")).toBe(false);
    expect(findUpperMath("volume", { kind: "side", sideId: "volume-a" })).toBeUndefined();
  });
  it("図の数量と答えが一致する", () => {
    for (const chapter of Object.values(UPPER_MATH)) for (const item of chapter.main) for (const question of [item.practice, ...(item.practice.followUps ?? []), item.test, ...(item.test.followUps ?? [])]) {
      const visual = question.visual;
      const expected = Number(question.answer);
      if (visual.kind === "rectangles") expect(visual.rectangles.reduce((sum, r) => sum + r.width * r.height, 0)).toBe(expected);
      if (visual.kind === "volume") expect(visual.width * visual.height * visual.depth).toBe(expected);
      if (visual.kind === "prism") expect(visual.baseArea * visual.height).toBe(expected);
      if (visual.kind === "circle-area") expect(Math.round(visual.radius * visual.radius * 3.14 * 100) / 100).toBe(expected);
      if (visual.kind === "part-whole") {
        const value = visual.revealRestPercent ? visual.whole - visual.part : question.unit === "%" ? visual.part / visual.whole * 100 : visual.part / visual.whole;
        expect(value).toBe(expected);
      }
      if (visual.kind === "split-bars") {
        if (visual.rows.length === 1) expect(visual.rows[0].total / visual.rows[0].parts).toBe(expected);
        else {
          const [a, b] = visual.rows;
          expect(a.total / a.parts < b.total / b.parts ? "A" : "B").toBe(question.answer);
        }
      }
      if (visual.kind === "area-shape") {
        const area = visual.shape === "parallelogram" ? visual.base * visual.height : visual.shape === "trapezoid" ? (visual.base + visual.top!) * visual.height / 2 : visual.base * visual.height / 2;
        expect(area).toBe(expected);
      }
      if (visual.kind === "bars") expect(visual.values.reduce((sum, value) => sum + value, 0) / visual.values.length).toBe(expected);
      if (visual.kind === "ratio") {
        const [a, b] = visual.values;
        if (question.answer.includes(":")) { const [x, y] = question.answer.split(":").map(Number); expect(a * y).toBe(b * x); }
        else expect(b / a).toBe(expected);
      }
      if (visual.kind === "number-lines") expect(visual.lines.reduce((sum, line) => sum + (line.value < (line.low + line.high) / 2 ? line.low : line.high), 0)).toBe(expected);
      if (visual.kind === "bundles") {
        const amount: Record<string, number> = { "1万": 10000, "1000": 1000, "1億": 100000000, "1000万": 10000000 };
        expect(visual.groups.reduce((sum, group) => sum + amount[group.label] * group.count, 0)).toBe(expected);
      }
      if (visual.kind === "collection") {
        if (question.title === "偶数と奇数") expect(visual.count % 2 === 0 ? "偶数" : "奇数").toBe(question.answer);
        if (question.title === "約数") expect(visual.count % visual.size === 0 ? "はい" : "いいえ").toBe(question.answer);
        if (question.title === "倍数") expect(visual.count).toBe(expected);
      }
      if (visual.kind === "number-lists") {
        const common = visual.rows[0].values.filter((value) => visual.rows[1].values.includes(value));
        expect(question.title === "最小公倍数" ? Math.min(...common) : Math.max(...common)).toBe(expected);
      }
      if (visual.kind === "function-table") {
        expect(visual.ys.filter((value) => value === null)).toHaveLength(1);
        visual.xs.forEach((x, index) => {
          const value = visual.operation === "multiply" ? x * visual.factor : visual.factor / x;
          expect(visual.ys[index] ?? expected).toBe(value);
          if (visual.increment && index > 0) expect(x - visual.xs[index - 1]).toBe(1);
        });
      }
    }
  });
});
