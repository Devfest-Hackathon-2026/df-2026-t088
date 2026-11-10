import { describe, expect, it } from "vitest";
import { findMaker } from "./makers/index";
import { problemIdOf } from "./makers/format";
import type { PlanEntry, PlanOverrides } from "./makers/types";
import { buildLesson, defaultPlanIds } from "./plan";
import { DEFAULT_PLANS } from "./plans/sansu-5";

const f = (num: number, den: number) => ({ num, den });
const reduceEntry = (num: number, den: number, wrong: [number, number]): PlanEntry => ({ maker: "fraction.reduce", args: [f(num, den), f(...wrong)] });
const ids = (planId: string, overrides: PlanOverrides): string[] => (buildLesson(planId, overrides)?.problems.map((problem) => problem.id ?? "") ?? []);

const DEFAULT_MAIN_3 = ["fraction.reduce(4/6,1/2)", "fraction.reduce(6/8,1/3)", "fraction.reduce(8/12,1/5)", "fraction.reduce(6/10,1/3)", "fraction.reduce(12/16,1/3)"];

describe("既定の出題表", () => {
  it("本線と寄り道は5行、テストは本線のマスの数", () => {
    const testRows: Record<string, number> = { "fraction:test": 9, "integer:test": 5, "decimal:test": 7, "expression:test": 3 };
    for (const [planId, plan] of Object.entries(DEFAULT_PLANS)) expect(plan.entries).toHaveLength(testRows[planId] ?? 5);
    expect(defaultPlanIds()).toHaveLength(34);
  });

  it("全行が check・verify を通り、学習の中で problemId が重ならない", () => {
    for (const [planId, plan] of Object.entries(DEFAULT_PLANS)) {
      const seen = new Set<string>();
      for (const entry of plan.entries) {
        const maker = findMaker(entry.maker);
        expect(maker, `${planId} ${entry.maker}`).toBeDefined();
        const checked = maker?.check(entry.args);
        expect(checked?.ok, `${planId} ${entry.maker}`).toBe(true);
        if (!maker || !checked?.ok) continue;
        expect(maker.verify(maker.build(checked.args))).toBeNull();
        const id = problemIdOf(maker.name, checked.args);
        expect(seen.has(id), `${planId} ${id}`).toBe(false);
        seen.add(id);
      }
    }
  });

  it("組み立てると全行が問題になる。planId・id・isTilesFirst が入る", () => {
    for (const [planId, plan] of Object.entries(DEFAULT_PLANS)) {
      const lesson = buildLesson(planId, {});
      expect(lesson?.problems).toHaveLength(plan.entries.length);
      expect(lesson?.planId).toBe(planId);
      expect(lesson?.id).toBe(planId.slice(planId.indexOf(":") + 1));
      expect(lesson?.isTilesFirst).toBe(plan.tilesFirst === true);
    }
    expect(buildLesson("fraction:fraction-t2", {})?.isTilesFirst).toBe(true);
    expect(buildLesson("fraction:main-6", {})?.isTilesFirst).toBe(false);
    expect(ids("fraction:main-3", {})).toEqual(DEFAULT_MAIN_3);
    expect(ids("fraction:main-8", {})[0]).toBe("fraction.calculate(5/4,+,1/2,m)");
    expect(ids("fraction:fraction-a", {})[4]).toBe("fraction.estimate(1/3,+,1/4,1/2)");
  });

  it("既定にも無い学習は undefined", () => {
    expect(buildLesson("fraction:main-0", {})?.problems).toHaveLength(5);
    expect(buildLesson("integer:main-3", {})?.problems).toHaveLength(5);
    expect(buildLesson("integer:integer-a", {})).toBeUndefined();
    expect(buildLesson("decimal:decimal-a", {})).toBeUndefined();
    expect(buildLesson("plane:main-0", {})).toBeUndefined();
    expect(buildLesson("fraction:nothing", { "fraction:nothing": [reduceEntry(4, 6, [1, 2])] })).toBeUndefined();
  });

  it("同じ overrides なら同じオブジェクトを返す", () => {
    const overrides: PlanOverrides = {};
    expect(buildLesson("fraction:main-3", overrides)).toBe(buildLesson("fraction:main-3", overrides));
    expect(buildLesson("fraction:main-3", {})).not.toBe(buildLesson("fraction:main-3", {}));
  });
});

describe("差し込み", () => {
  const planId = "fraction:main-3";

  it("差し込みの無い学習は既定。別の学習の差し込みは影響しない", () => {
    expect(ids(planId, { "fraction:main-4": [reduceEntry(4, 6, [1, 2])] })).toEqual(DEFAULT_MAIN_3);
  });

  it("並べ替え・数の変更・行を足す・減らす", () => {
    expect(ids(planId, { [planId]: [reduceEntry(8, 12, [1, 5]), reduceEntry(4, 6, [1, 2])] })).toEqual(["fraction.reduce(8/12,1/5)", "fraction.reduce(4/6,1/2)"]);
    expect(ids(planId, { [planId]: [reduceEntry(10, 15, [1, 2])] })).toEqual(["fraction.reduce(10/15,1/2)"]);
    expect(ids(planId, { [planId]: [...DEFAULT_PLANS[planId]?.entries ?? [], reduceEntry(10, 15, [1, 2])] })).toHaveLength(6);
  });

  it("落ちる行（名前が無い・範囲の外・形が違う・既約）は捨てる", () => {
    const overrides: PlanOverrides = {
      [planId]: [
        { maker: "fraction.nothing", args: [] },
        reduceEntry(4, 6, [1, 2]),
        reduceEntry(4, 40, [1, 2]),
        { maker: "fraction.reduce", args: ["x", 1] },
        { maker: "fraction.reduce", args: [] },
        reduceEntry(3, 7, [1, 2]),
        reduceEntry(6, 8, [1, 3]),
      ],
    };
    expect(ids(planId, overrides)).toEqual(["fraction.reduce(4/6,1/2)", "fraction.reduce(6/8,1/3)"]);
  });

  it("同じ id の後の行を捨てる（既定の行でも同じ）", () => {
    expect(ids(planId, { [planId]: [reduceEntry(4, 6, [1, 2]), reduceEntry(6, 8, [1, 3]), reduceEntry(4, 6, [1, 2])] })).toEqual(["fraction.reduce(4/6,1/2)", "fraction.reduce(6/8,1/3)"]);
    expect(ids(planId, { [planId]: [] })).toEqual(DEFAULT_MAIN_3);
  });

  it("11行以上なら先頭 10 行", () => {
    const entries = Array.from({ length: 12 }, (_, index) => ({ maker: "fraction.compare", args: [f(1, 2), f(1, index + 3)] }));
    const built = ids(planId, { [planId]: entries });
    expect(built).toHaveLength(10);
    expect(built[0]).toBe("fraction.compare(1/2,1/3)");
    expect(built[9]).toBe("fraction.compare(1/2,1/12)");
  });

  it("全部落ちたら既定に戻す", () => {
    expect(ids(planId, { [planId]: [{ maker: "x", args: [] }] })).toEqual(DEFAULT_MAIN_3);
    expect(ids(planId, { [planId]: [] })).toEqual(DEFAULT_MAIN_3);
  });

  it("差し込みの tilesFirst は既定のまま", () => {
    const side = "fraction:fraction-t2";
    expect(buildLesson(side, { [side]: [{ maker: "fraction.calculate", args: [f(1, 2), "+", f(1, 3)] }] })?.isTilesFirst).toBe(true);
  });
});
