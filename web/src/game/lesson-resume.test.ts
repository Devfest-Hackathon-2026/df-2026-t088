import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonDefinition } from "../lesson/problems";
import { isLessonPath, lessonKeyOf, lessonPath, resolveInitialPath, toRoutePath } from "../routing";
import { clearAllResume, clearResume, loadResume, saveResume } from "./lesson-resume";

beforeEach(() => localStorage.clear());

afterEach(() => vi.restoreAllMocks());

const KEY = "sugoroku-lesson-resume";
const problem = (id?: string) => ({ id }) as LessonDefinition["problems"][number];
const lessonOf = (id: string, problemIds: (string | undefined)[], planId?: string): LessonDefinition =>
  ({ id, planId, isTilesFirst: false, problems: problemIds.map(problem) });
const ids = ["fraction.calculate(1/3,+,1/4)", "fraction.calculate(1/2,+,1/3)", "fraction.calculate(2/3,-,1/4)"];
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;

describe("学習の途中の記録", () => {
  it("学習ごとに問題の id で覚え、別の学習を進めても消えない", () => {
    const a = lessonOf("main-3", ids, "fraction:main-3");
    const b = lessonOf("fraction-t2", ids, "fraction:fraction-t2");
    saveResume(a, 2);
    saveResume(b, 1);
    expect(stored()).toEqual({ "fraction:main-3": ids[2], "fraction:fraction-t2": ids[1] });
    expect(loadResume(a)).toBe(2);
    expect(loadResume(b)).toBe(1);
    expect(loadResume(lessonOf("main-4", ids, "fraction:main-4"))).toBe(0);
    clearResume(b);
    expect(loadResume(a)).toBe(2);
  });

  it("出題表を並べ替えても、同じ問題から続ける（番号は変わる）", () => {
    saveResume(lessonOf("main-3", ids, "fraction:main-3"), 2);
    const reordered = lessonOf("main-3", [ids[2] as string, ids[0] as string, ids[1] as string], "fraction:main-3");
    expect(loadResume(reordered)).toBe(0);
    const shifted = lessonOf("main-3", ["fraction.reduce(4/6,1/2)", ...ids], "fraction:main-3");
    expect(loadResume(shifted)).toBe(3);
  });

  it("id が見つからなければ 0 にする", () => {
    saveResume(lessonOf("main-3", ids, "fraction:main-3"), 1);
    expect(loadResume(lessonOf("main-3", [ids[0] as string, ids[2] as string], "fraction:main-3"))).toBe(0);
  });

  it("問題に id が無い時は番号を書き、読める", () => {
    const lesson = lessonOf("main-3", [undefined, undefined, undefined]);
    saveResume(lesson, 2);
    expect(stored()).toEqual({ "main-3": 2 });
    expect(loadResume(lesson)).toBe(2);
  });

  it("古い番号の記録は、範囲内ならその番号で読み、範囲外・小数・負の数は 0 にする", () => {
    const lesson = lessonOf("main-3", ids, "fraction:main-3");
    for (const [value, expected] of [[2, 2], [3, 0], [5, 0], [-1, 0], [1.5, 0]] as const) {
      localStorage.setItem(KEY, JSON.stringify({ "fraction:main-3": value }));
      expect(loadResume(lesson)).toBe(expected);
    }
  });

  it("key の古い記録を planId の学習で読み、次に書く時に planId へ移す", () => {
    const lesson = lessonOf("main-3", ids, "fraction:main-3");
    localStorage.setItem(KEY, JSON.stringify({ "main-3": 1, "main-4": 2 }));
    expect(loadResume(lesson)).toBe(1);
    saveResume(lesson, 2);
    expect(stored()).toEqual({ "fraction:main-3": ids[2], "main-4": 2 });
  });

  it("古い key の記録は分数の章の記録なので、ほかの章の同じ名前のマスでは読まず、消しもしない", () => {
    const integer = lessonOf("main-3", ["integer.gcd(16,24)", "integer.gcd(18,27)", "integer.gcd(30,45)"], "integer:main-3");
    localStorage.setItem(KEY, JSON.stringify({ "main-3": 2 }));
    expect(loadResume(integer)).toBe(0);
    saveResume(integer, 1);
    expect(stored()).toEqual({ "main-3": 2, "integer:main-3": "integer.gcd(18,27)" });
    clearResume(integer);
    expect(stored()).toEqual({ "main-3": 2 });
  });

  it("以前の分数のテスト（key \"test\"）の古い番号は、問題が3問増えた分だけずらして読み、範囲外なら 0", () => {
    const nine = lessonOf("test", Array.from({ length: 9 }, (_, i) => `fraction.test-${i}`), "fraction:test");
    localStorage.setItem(KEY, JSON.stringify({ test: 2 }));
    expect(loadResume(nine)).toBe(5);
    localStorage.setItem(KEY, JSON.stringify({ test: 6 }));
    expect(loadResume(nine)).toBe(0);
    localStorage.setItem(KEY, JSON.stringify({ test: -1 }));
    expect(loadResume(nine)).toBe(0);
  });

  it("planId の記録（新しい形）はずらさず、ほかの学習の古い番号もずらさない", () => {
    const nine = lessonOf("test", Array.from({ length: 9 }, (_, i) => `fraction.test-${i}`), "fraction:test");
    localStorage.setItem(KEY, JSON.stringify({ "fraction:test": 2 }));
    expect(loadResume(nine)).toBe(2);
    localStorage.setItem(KEY, JSON.stringify({ "main-3": 1 }));
    expect(loadResume(lessonOf("main-3", ids, "fraction:main-3"))).toBe(1);
  });

  it("planId の記録があれば、古い key の記録より先に読む", () => {
    const lesson = lessonOf("main-3", ids, "fraction:main-3");
    localStorage.setItem(KEY, JSON.stringify({ "main-3": 1, "fraction:main-3": ids[2] }));
    expect(loadResume(lesson)).toBe(2);
  });

  it("clearResume は planId と古い key の両方を消し、ほかの学習は残す", () => {
    const lesson = lessonOf("main-3", ids, "fraction:main-3");
    localStorage.setItem(KEY, JSON.stringify({ "main-3": 1, "fraction:main-3": ids[2], "main-4": 2 }));
    clearResume(lesson);
    expect(stored()).toEqual({ "main-4": 2 });
    clearResume(lessonOf("main-4", ids));
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("壊れた記録は 0 にする", () => {
    const lesson = lessonOf("main-3", ids, "fraction:main-3");
    localStorage.setItem(KEY, "{こわれた");
    expect(loadResume(lesson)).toBe(0);
    localStorage.setItem(KEY, JSON.stringify({ "fraction:main-3": null }));
    expect(loadResume(lesson)).toBe(0);
    localStorage.setItem(KEY, JSON.stringify([1, 2]));
    expect(loadResume(lesson)).toBe(0);
  });

  it("key と問題の数で覚える学習（国語）も、今まで通り読み書きできる", () => {
    saveResume("kokugo:main-0", 2);
    expect(loadResume("kokugo:main-0", 3)).toBe(2);
    expect(loadResume("kokugo:main-0", 2)).toBe(0);
    clearResume("kokugo:main-0");
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("全部消すと 0 に戻り、記録も残らない", () => {
    const lesson = lessonOf("main-3", ids, "fraction:main-3");
    saveResume(lesson, 2);
    clearAllResume();
    expect(loadResume(lesson)).toBe(0);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("保存できなくても学習を止めない", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    expect(() => saveResume(lessonOf("main-3", ids, "fraction:main-3"), 2)).not.toThrow();
  });

  it("読み出せなくても学習を止めない", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    expect(loadResume(lessonOf("main-3", ids, "fraction:main-3"))).toBe(0);
  });
});

describe("学習の道", () => {
  it("どのマスかを道に入れ、取り出せる", () => {
    const path = lessonPath("main-3");
    expect(path).toBe("/sansu/lesson/main-3");
    expect(isLessonPath(path)).toBe(true);
    expect(lessonKeyOf(path)).toBe("main-3");
  });

  it("学習の形でない道は島の地図へ送る", () => {
    expect(toRoutePath("/sansu/lesson/main-3")).toBe("/sansu/lesson/main-3");
    expect(toRoutePath("/sansu/lesson/")).toBe("/home");
    expect(toRoutePath("/sansu/lesson/../x")).toBe("/home");
  });

  it("学習の途中で読み直しても、学習のまま開く。算数を選んでいなければ島の地図。/ はスタート画面", () => {
    expect(resolveInitialPath(true, "/sansu/lesson/main-3")).toBe("/sansu/lesson/main-3");
    expect(resolveInitialPath(true, "/sansu")).toBe("/sansu");
    expect(resolveInitialPath(false, "/sansu/lesson/main-3")).toBe("/home");
    expect(resolveInitialPath(false, "/sansu")).toBe("/home");
    expect(resolveInitialPath(true, "/")).toBe("/");
    expect(resolveInitialPath(false, "/")).toBe("/");
    expect(resolveInitialPath(true, "/no-such-page")).toBe("/home");
    expect(resolveInitialPath(true)).toBe("/home");
  });
});
