import { afterEach, describe, expect, it, vi } from "vitest";
import { KOKUGO_CHAPTERS, SAMPLE_STATE } from "../data";
import { MIDWAY_STATE } from "./test-state";
import { loadState, parseState, saveState } from "./storage";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("保存", () => {
  it("保存して読み戻せる", () => {
    const state = { ...structuredClone(MIDWAY_STATE), sansuSelected: true };
    expect(saveState(state, false)).toEqual({ ok: true, shouldNotify: false });
    expect(loadState()).toEqual(state);
  });

  it("分数の途中から始めていた頃の保存と学習の途中の記録は消し、最初から始める", () => {
    localStorage.setItem("sugoroku-home", JSON.stringify(MIDWAY_STATE));
    localStorage.setItem("sugoroku-lesson-resume", JSON.stringify({ "main-3": 2 }));
    expect(loadState()).toEqual(SAMPLE_STATE);
    expect(localStorage.getItem("sugoroku-home")).toBeNull();
    expect(localStorage.getItem("sugoroku-lesson-resume")).toBeNull();
  });

  it("今の保存があれば、学習の途中の記録は消さない", () => {
    localStorage.setItem("sugoroku-home-v2", JSON.stringify(MIDWAY_STATE));
    localStorage.setItem("sugoroku-lesson-resume", JSON.stringify({ "main-3": 2 }));
    expect(loadState().chapterId).toBe("fraction");
    expect(localStorage.getItem("sugoroku-lesson-resume")).not.toBeNull();
  });

  it("壊れた保存は見本から始める", () => {
    expect(parseState("{")).toBeNull();
    expect(parseState('{"chapterId":1}')).toBeNull();
    localStorage.setItem("sugoroku-home-v2", "not json");
    expect(loadState()).toEqual(SAMPLE_STATE);
  });

  it("高原の教科を足す前の保存は、進み具合を保ったまま読める", () => {
    const { ongaku, taiiku, zuko, katei, ...oldXp } = MIDWAY_STATE.xp;
    expect([ongaku, taiiku, zuko, katei]).toEqual([0, 0, 0, 0]);
    const old = { ...MIDWAY_STATE, xp: { ...oldXp, sansu: 777 }, sansuSelected: true };
    localStorage.setItem("sugoroku-home-v2", JSON.stringify(old));
    const loaded = loadState();
    expect(loaded.xp).toEqual({ ...MIDWAY_STATE.xp, sansu: 777 });
    expect(loaded.sansuSelected).toBe(true);
  });

  it("生活の経験値が無い古い保存が読める（D-120）", () => {
    const { seikatsu, ...xp } = MIDWAY_STATE.xp;
    expect(seikatsu).toBe(0);
    const old = { ...structuredClone(MIDWAY_STATE), xp, sansuSelected: true };
    localStorage.setItem("sugoroku-home-v2", JSON.stringify(old));
    const loaded = loadState();
    expect(loaded.xp).toEqual(MIDWAY_STATE.xp);
    expect(loaded.chapterId).toBe("fraction");
  });

  it("進みの検査は全学年の章に広がる。生活や他の学年の章の記録が崩れた保存は見本に戻す", () => {
    const withProgress = (id: string, record: unknown) => JSON.stringify({ ...MIDWAY_STATE, progress: { ...MIDWAY_STATE.progress, [id]: record } });
    expect(parseState(withProgress("seikatsu-1-02", { done: 5, sides: [], test: false }))).not.toBeNull();
    expect(parseState(withProgress("seikatsu-1-02", { done: 6, sides: [], test: false }))).toBeNull();
    expect(parseState(withProgress("rika-3-01", { done: "1", sides: [], test: false }))).toBeNull();
  });

  it("前からある教科の経験値が無い保存は、これまでどおり見本から始める", () => {
    const { eigo, ...xp } = MIDWAY_STATE.xp;
    expect(eigo).toBeDefined();
    expect(parseState(JSON.stringify({ ...MIDWAY_STATE, xp }))).toBeNull();
  });

  it("章の記録が崩れた保存は見本から始める", () => {
    const withProgress = (fraction: unknown) => JSON.stringify({
      ...MIDWAY_STATE,
      progress: { ...MIDWAY_STATE.progress, fraction },
    });
    expect(parseState(withProgress({ done: 3 }))).toBeNull();
    expect(parseState(withProgress(5))).toBeNull();
    expect(parseState(withProgress({ done: "3", sides: [], test: false }))).toBeNull();
    expect(parseState(withProgress({ done: 999, sides: [], test: false }))).toBeNull();
    expect(parseState(withProgress({ done: -1, sides: [], test: false }))).toBeNull();
  });

  it("章の記録が無いのは、まだ始めていないこととして読む", () => {
    const { fraction, ...progress } = MIDWAY_STATE.progress;
    expect(fraction).toBeDefined();
    expect(parseState(JSON.stringify({ ...MIDWAY_STATE, progress }))).not.toBeNull();
  });

  it("国語の記録が無い古い保存を読める", () => {
    const old = { ...structuredClone(MIDWAY_STATE), progress: { ...MIDWAY_STATE.progress } };
    delete old.progress[KOKUGO_CHAPTERS[0]!.id];
    expect(parseState(JSON.stringify(old))).not.toBeNull();
  });

  it("壊れた国語の章記録は見本に戻す", () => {
    const corrupted = {
      ...structuredClone(MIDWAY_STATE),
      progress: { ...MIDWAY_STATE.progress, [KOKUGO_CHAPTERS[0]!.id]: { done: 99, sides: [], test: false } },
    };
    localStorage.setItem("sugoroku-home-v2", JSON.stringify(corrupted));
    expect(loadState()).toEqual(SAMPLE_STATE);
  });

  it("最初の説明の記録が無い古い保存は、盤面を開いたことがあれば説明済みとして読む", () => {
    const { introSeen: _ignored, ...old } = structuredClone(MIDWAY_STATE);
    expect(parseState(JSON.stringify({ ...old, sansuSelected: true }))?.introSeen).toBe(true);
    expect(parseState(JSON.stringify({ ...old, sansuSelected: false }))?.introSeen).toBe(false);
  });

  it("保存に失敗しても例外にせず、知らせるのは最初の1回だけ", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    expect(saveState(MIDWAY_STATE, false)).toEqual({ ok: false, shouldNotify: true });
    expect(saveState(MIDWAY_STATE, true)).toEqual({ ok: false, shouldNotify: false });
  });
});
