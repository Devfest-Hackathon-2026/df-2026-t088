import { describe, expect, it } from "vitest";
import { chaptersOf, subjectsOfGrade } from "../data/courses";
import type { GameState } from "../data";
import { subjectProgressRows } from "./subject-progress";
import { MIDWAY_STATE } from "./test-state";

const fresh: GameState = { ...MIDWAY_STATE, xp: { ...MIDWAY_STATE.xp }, progress: {} };

describe("subjectProgressRows（D-197）", () => {
  it("学習のある教科だけ行にし、学年の教科の順に並べ、ほかは数だけ返す", () => {
    const all = subjectsOfGrade(5);
    const result = subjectProgressRows(5, fresh, (subjectId, chapterId) => (subjectId === "rika" || subjectId === "sansu") && chaptersOf(5, subjectId)[0]?.id === chapterId);
    expect(result.rows.map((row) => row.subjectId)).toEqual(all.filter((id) => id === "sansu" || id === "rika"));
    expect(result.pending).toBe(all.length - 2);
  });

  it("全体は鍵の章も数え、クリアは章のテストを終えた章だけ数える。Lv は教科の経験値から", () => {
    const sansu = chaptersOf(5, "sansu");
    const state: GameState = {
      ...fresh,
      xp: { ...fresh.xp, sansu: 250 },
      progress: {
        [sansu[0].id]: { done: 3, sides: [], test: true },
        [sansu[1].id]: { done: 2, sides: [], test: false },
      },
    };
    const { rows } = subjectProgressRows(5, state, (subjectId) => subjectId === "sansu");
    expect(rows).toEqual([{ subjectId: "sansu", cleared: 1, total: sansu.length, level: 3 }]);
  });

  it("学習のある教科が無ければ行は空、経験値の無い古い保存でも投げない", () => {
    const old = { ...fresh, xp: {} } as unknown as GameState;
    expect(subjectProgressRows(5, old, () => false)).toEqual({ rows: [], pending: subjectsOfGrade(5).length });
    expect(subjectProgressRows(5, old, () => true).rows.every((row) => row.level === 1)).toBe(true);
  });

  it("本物の判定では、5年は算数と国語に学習がある", () => {
    const ids = subjectProgressRows(5, fresh).rows.map((row) => row.subjectId);
    expect(ids).toContain("sansu");
    expect(ids).toContain("kokugo");
  });
});
