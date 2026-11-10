import { beforeEach, describe, expect, it } from "vitest";
import { clearAllResume, clearResume, loadAttempt, loadResume, saveResume } from "../game/lesson-resume";
import { gameOf } from "./problems";
import { findMaker } from "./makers/index";
import type { PlanOverrides } from "./makers/types";
import { buildLesson, defaultPlanIds } from "./plan";
import { DEFAULT_PLANS } from "./plans/sansu-5";
import { mulberry32, randomOf } from "./vary-random";
import { VARIES } from "./vary";

// 差し込みが無い時の出題表。同じオブジェクトなら同じ学習が返る（plan.ts のキャッシュ）
const NONE: PlanOverrides = {};
const idsOf = (planId: string, attempt: number, overrides: PlanOverrides = NONE): string[] =>
  buildLesson(planId, overrides, attempt)?.problems.map((problem) => problem.id ?? "") ?? [];

beforeEach(() => localStorage.clear());

describe("種つきの乱数", () => {
  it("同じ種なら同じ数が出る", () => {
    const [a, b] = [mulberry32(7), mulberry32(7)];
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(randomOf(1).int(3, 5)).toBe(randomOf(1).int(3, 5));
  });
});

describe("数の入れ替え", () => {
  it("0 回目は出題表のままで、attempt を省いた時と同じ", () => {
    for (const [planId, plan] of Object.entries(DEFAULT_PLANS)) {
      expect(buildLesson(planId, NONE, 0)).toBe(buildLesson(planId, NONE));
      expect(idsOf(planId, 0), planId).toHaveLength(plan.entries.length);
    }
  });

  it("同じ attempt なら同じ問題になり、別の attempt では数が変わる", () => {
    for (const planId of defaultPlanIds()) {
      expect(idsOf(planId, 3)).toEqual(idsOf(planId, 3));
      const changed = [1, 2, 3, 4, 5].filter((attempt) => idsOf(planId, attempt).join() !== idsOf(planId, 0).join());
      expect(changed, planId).toHaveLength(5);
      expect(idsOf(planId, 1).join(), planId).not.toBe(idsOf(planId, 2).join());
    }
  });

  it("全部の学習の attempt 1〜50 の問題が、行の数のまま verify を通り、盤が作れ、問題の id が重ならない", () => {
    const failures: string[] = [];
    for (const [planId, plan] of Object.entries(DEFAULT_PLANS)) {
      for (let attempt = 1; attempt <= 50; attempt += 1) {
        const lesson = buildLesson(planId, NONE, attempt);
        const problems = lesson?.problems ?? [];
        if (problems.length !== plan.entries.length) failures.push(`${planId}#${attempt}: ${problems.length} 問`);
        if (new Set(problems.map((problem) => problem.id)).size !== problems.length) failures.push(`${planId}#${attempt}: id が重なる`);
        if (lesson?.intro !== plan.intro || lesson?.isTilesFirst !== (plan.tilesFirst === true)) failures.push(`${planId}#${attempt}: 図解かタイル先が変わった`);
        for (const problem of problems) {
          const maker = findMaker((problem.id ?? "").split("(")[0] ?? "");
          const reason = maker ? maker.verify(problem) : "関数が無い";
          if (reason !== null) failures.push(`${planId}#${attempt} ${problem.id}: ${reason}`);
          if (problem.pieces.length > 0) expect(() => gameOf(problem)).not.toThrow();
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it("行ごとに、関数と形（行の関数・本線のタイルの有無）が出題表のまま", () => {
    for (const [planId, plan] of Object.entries(DEFAULT_PLANS)) {
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        const makers = buildLesson(planId, NONE, attempt)?.problems.map((problem) => (problem.id ?? "").split("(")[0]);
        expect(makers, planId).toEqual(plan.entries.map((entry) => entry.maker));
      }
    }
  });

  it("入れ替えの表は、出題表で使う関数を全部そろえている", () => {
    const used = new Set(Object.values(DEFAULT_PLANS).flatMap((plan) => plan.entries.map((entry) => entry.maker)));
    expect([...used].filter((name) => !(name in VARIES))).toEqual([]);
  });

  it("先生の差し込みの出題表がある学習は入れ替えない", () => {
    const overrides: PlanOverrides = { "fraction:main-3": [{ maker: "fraction.reduce", args: [{ num: 4, den: 6 }, { num: 1, den: 2 }] }] };
    for (const attempt of [0, 1, 7]) expect(idsOf("fraction:main-3", attempt, overrides)).toEqual(["fraction.reduce(4/6,1/2)"]);
    expect(idsOf("fraction:main-4", 1, overrides)).not.toEqual(idsOf("fraction:main-4", 0, overrides));
  });

  it("同じ (a, b) の行は同じ組に入れ替える（8 と 12 の 1 番目と 2 番目）", () => {
    const [first, second] = idsOf("integer:main-4", 1).map((id) => /\((\d+),(\d+),/.exec(id));
    expect(first?.slice(1)).toEqual(second?.slice(1));
  });
});

describe("終えた回数と、学習の途中の記録", () => {
  const lessonOf = (planId: string, attempt: number) => buildLesson(planId, NONE, attempt);

  it("学習を終えると回数が 1 増え、2 回目に開く問題は 1 回目と別になる", () => {
    const planId = "fraction:main-6";
    const first = lessonOf(planId, loadAttempt(planId));
    expect(first?.problems.map((problem) => problem.id)).toEqual(idsOf(planId, 0));
    if (first) clearResume(first);
    expect(loadAttempt(planId)).toBe(1);
    const second = lessonOf(planId, loadAttempt(planId));
    expect(second?.problems.map((problem) => problem.id)).not.toEqual(first?.problems.map((problem) => problem.id));
  });

  it("途中でやめて読み直しても回数は変わらず、同じ問題から続く", () => {
    const planId = "fraction:main-6";
    if (lessonOf(planId, 0)) clearResume(lessonOf(planId, 0) as NonNullable<ReturnType<typeof lessonOf>>);
    const opened = lessonOf(planId, loadAttempt(planId));
    if (!opened) throw new Error("学習が無い");
    saveResume(opened, 2);
    const reopened = lessonOf(planId, loadAttempt(planId));
    expect(reopened).toBe(opened);
    expect(reopened && loadResume(reopened)).toBe(2);
    expect(loadAttempt(planId)).toBe(1);
  });

  it("国語など planId の無い学習では回数を増やさず、はじめからで 0 に戻る。保存できなくても 0 回目で動く", () => {
    clearResume("kanji-1");
    expect(localStorage.getItem("sugoroku-lesson-attempt")).toBeNull();
    clearResume({ id: "main-6", planId: "fraction:main-6", problems: [] });
    expect(loadAttempt("fraction:main-6")).toBe(1);
    clearAllResume();
    expect(loadAttempt("fraction:main-6")).toBe(0);
    localStorage.setItem("sugoroku-lesson-attempt", "{壊れた");
    expect(loadAttempt("fraction:main-6")).toBe(0);
  });
});
