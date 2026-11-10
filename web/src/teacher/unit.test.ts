import { describe, expect, it } from "vitest";
import { groupByUnit, problemLabel, unitHref, unitLabel } from "./unit";
import { UNIT_COPY } from "./copy";
import type { SummaryItem } from "../research/api";

const row = (chapterId: string, lessonKey: string, problem: string, count: number, patterns: SummaryItem["patterns"] = []): SummaryItem => ({
  chapterId,
  lessonKey,
  problem,
  count,
  patterns,
});

describe("unitLabel", () => {
  it("main-N は 0 始まりなので N+1 マス目", () => {
    expect(unitLabel("fraction", "main-6")).toBe("分数 7マス目");
    expect(unitLabel("fraction", "main-0")).toBe("分数 1マス目");
  });
  it("test は章のテスト、それ以外は寄り道", () => {
    expect(unitLabel("fraction", "test")).toBe("分数 章のテスト");
    expect(unitLabel("fraction", "side-halves")).toBe("分数 寄り道");
    expect(unitLabel("fraction", "test")).toBe(UNIT_COPY.chapterTest("分数"));
  });
  it("見つからない章は chapterId をそのまま使う", () => {
    expect(unitLabel("no-such-chapter", "main-1")).toBe("no-such-chapter 2マス目");
  });
});

describe("プリントの型（#535）", () => {
  it("print: で始まる学習は、教科の id や「寄り道」を出さず、型の名前で出す", () => {
    expect(unitLabel("rika", "print:rika-lever")).toBe("プリント（てこ）");
    expect(unitLabel("rika", "print:rika-moon")).toBe("プリント（月）");
    expect(unitLabel("sansu", "print:sansu-fraction-addsub")).toBe("プリント（分数）");
    expect(unitLabel("rika", "print:new-template")).toBe("プリント");
  });
  it("てこの問題のキーを文にする。ほかの問題と、形の合わないキーはそのまま", () => {
    expect(problemLabel("print:rika-lever", "左2-30g-右3")).toBe("左の 2 の目もりに 30g、右は 3 の目もり");
    expect(problemLabel("print:rika-lever", "何かちがう形")).toBe("何かちがう形");
    expect(problemLabel("main-6", "1/3+1/4")).toBe("1/3+1/4");
  });
});

describe("groupByUnit", () => {
  it("単元ごとに件数と型を合計し、件数の多い順、同じなら章・学習の順に並べる", () => {
    const rows = groupByUnit([
      row("fraction", "main-6", "a", 5, [{ pattern: "sum-both", count: 5 }]),
      row("fraction", "main-6", "b", 9, [{ pattern: "sum-both", count: 4 }, { pattern: "unclassified", count: 5 }]),
      row("fraction", "main-2", "c", 14),
      row("decimal", "main-2", "d", 14),
      row("fraction", "main-1", "e", 5),
    ]);
    expect(rows.map((r) => `${r.chapterId}/${r.lessonKey}/${r.count}`)).toEqual([
      "decimal/main-2/14",
      "fraction/main-2/14",
      "fraction/main-6/14",
      "fraction/main-1/5",
    ]);
    const merged = rows.find((r) => r.lessonKey === "main-6");
    expect(merged?.patterns).toEqual([{ pattern: "sum-both", count: 9 }, { pattern: "unclassified", count: 5 }]);
  });
  it("章が違えば同じ lessonKey でも別の単元", () => {
    expect(groupByUnit([row("fraction", "main-1", "a", 5), row("decimal", "main-1", "a", 5)]).length).toBe(2);
  });
});

describe("unitHref", () => {
  it("今日のときだけ period を付ける", () => {
    expect(unitHref("fraction", "main-6", "7days")).toBe("?view=unit&chapter=fraction&lesson=main-6");
    expect(unitHref("fraction", "main-6", "today")).toBe("?view=unit&chapter=fraction&lesson=main-6&period=today");
  });
});
