import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../../data";
import { problemIdOf } from "../makers/format";
import { findMaker } from "../makers/index";
import { buildLesson, defaultPlanIds } from "../plan";
import { DEFAULT_PLANS } from "./sansu-5";

const CHAPTER_IDS = ["fraction", "integer", "decimal", "expression"];

/** 応用はまだ作らない（盤面ではじゅんび中。PB-14）。分数の応用（fraction-a）は今までどおり出題表がある */
const NO_PLAN_SIDES = ["integer-a", "decimal-a"];

/** その章の学習の名前（`{章 id}:{key}`）を、本線のマスの順・テスト・寄り道の順で返す */
function expectedPlanIds(chapterId: string): string[] {
  const chapter = CHAPTERS.find((candidate) => candidate.id === chapterId);
  if (!chapter) throw new Error(`章がありません: ${chapterId}`);
  const sides = chapter.sides.map((side) => side.id).filter((id) => !NO_PLAN_SIDES.includes(id));
  return [...chapter.items.map((_, index) => `main-${index}`), "test", ...sides].map((key) => `${chapterId}:${key}`);
}

const cases = Object.entries(DEFAULT_PLANS).flatMap(([planId, plan]) => plan.entries.map((entry, index) => ({ planId, index, entry })));

describe("既定の出題表の学習", () => {
  it("4つの章の、本線・テスト・寄り道（応用を除く）が過不足なく入っている", () => {
    const expected = CHAPTER_IDS.flatMap(expectedPlanIds);
    expect([...defaultPlanIds()].sort()).toEqual([...expected].sort());
    expect(defaultPlanIds()).toHaveLength(34);
  });

  it("本線と寄り道は5行、章のテストは本線のマスの数（分数9・整数5・小数7・式3）", () => {
    for (const chapterId of CHAPTER_IDS) {
      const mainCount = CHAPTERS.find((chapter) => chapter.id === chapterId)?.items.length ?? 0;
      for (const planId of expectedPlanIds(chapterId)) {
        const expected = planId.endsWith(":test") ? mainCount : 5;
        expect(DEFAULT_PLANS[planId]?.entries, planId).toHaveLength(expected);
      }
    }
    expect(DEFAULT_PLANS["fraction:test"]?.entries).toHaveLength(9);
    expect(DEFAULT_PLANS["integer:test"]?.entries).toHaveLength(5);
    expect(DEFAULT_PLANS["decimal:test"]?.entries).toHaveLength(7);
    expect(DEFAULT_PLANS["expression:test"]?.entries).toHaveLength(3);
  });

  it("全部で 174 行ある", () => {
    expect(cases).toHaveLength(174);
  });

  it.each(cases)("$planId の $index 行目は check・build・verify を通る", ({ planId, entry }) => {
    const maker = findMaker(entry.maker);
    expect(maker, `${planId} ${entry.maker}`).toBeDefined();
    if (!maker) return;
    const checked = maker.check(entry.args);
    expect(checked, `${planId} ${entry.maker}`).toEqual({ ok: true, args: entry.args });
    if (!checked.ok) return;
    expect(maker.verify(maker.build(checked.args))).toBeNull();
    expect(problemIdOf(maker.name, checked.args)).toMatch(/^[a-z]+\.[A-Za-z]+\(.+\)$/);
  });

  it("学習の中で problemId が重ならない", () => {
    for (const [planId, plan] of Object.entries(DEFAULT_PLANS)) {
      const ids = plan.entries.map((entry) => problemIdOf(entry.maker, entry.args));
      expect(new Set(ids).size, planId).toBe(ids.length);
    }
  });

  it("組み立てると全行が問題になる", () => {
    for (const [planId, plan] of Object.entries(DEFAULT_PLANS)) {
      expect(buildLesson(planId, {})?.problems, planId).toHaveLength(plan.entries.length);
    }
  });

  it("テストの各行は、同じ順のマスの問題と同じ関数の族（PB-12）", () => {
    for (const chapterId of CHAPTER_IDS) {
      const test = DEFAULT_PLANS[`${chapterId}:test`];
      test?.entries.forEach((entry, index) => {
        const mainNames = DEFAULT_PLANS[`${chapterId}:main-${index}`]?.entries.map((row) => row.maker) ?? [];
        expect(mainNames, `${chapterId} テスト ${index} 行目 ${entry.maker}`).toContain(entry.maker);
      });
    }
  });

  it("先にタイルで解くのは fraction-t2 だけ", () => {
    const tilesFirst = Object.entries(DEFAULT_PLANS).filter(([, plan]) => plan.tilesFirst === true).map(([planId]) => planId);
    expect(tilesFirst).toEqual(["fraction:fraction-t2"]);
  });
});
