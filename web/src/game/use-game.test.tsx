import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAPTERS, REWARD, SAMPLE_STATE, chaptersOf } from "../data";
import type { Chapter } from "../data";
import { MIDWAY_STATE, seedMidwayState } from "./test-state";
import type { GameState } from "../data";
import { ACCOUNT_KEY } from "../account";
import { GradeProvider } from "../grade";
import { plainText } from "../ruby-text";
import { saveGrade5ForTest } from "../test-grade";
import { useGame } from "./use-game";

const savedState = (): GameState => JSON.parse(localStorage.getItem("sugoroku-home-v2") ?? "{}") as GameState;

beforeEach(() => {
  localStorage.clear();
  saveGrade5ForTest();
  seedMidwayState();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useGame", () => {
  it("歩く間は isBusy で、終わってから経験値とトーストが出る", async () => {
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    const before = result.current.totalXp;
    let finished: Promise<void> = Promise.resolve();
    act(() => { finished = result.current.completeLesson({ kind: "main", index: 3 }); });

    expect(result.current.isBusy).toBe(true);
    expect(result.current.chapterProgress.done).toBe(4);
    expect(result.current.totalXp).toBe(before);

    await act(async () => { await vi.advanceTimersByTimeAsync(700); await finished; });
    expect(result.current.isBusy).toBe(false);
    expect(result.current.totalXp).toBe(before + 20);
    expect(plainText(result.current.toast?.text ?? "")).toBe("経験値 +20");
  });

  it("歩く途中で読み直しても、進みと経験値がそろって残り、二重には増えない", async () => {
    const { result, unmount } = renderHook(() => useGame(), { wrapper: GradeProvider });
    const before = result.current.state.xp.sansu;
    let finished: Promise<void> = Promise.resolve();
    act(() => { finished = result.current.completeLesson({ kind: "main", index: 3 }); });

    expect(result.current.state.xp.sansu).toBe(before);
    expect(savedState().progress.fraction?.done).toBe(4);
    expect(savedState().xp.sansu).toBe(before + REWARD.main);

    unmount();
    const reloaded = renderHook(() => useGame(), { wrapper: GradeProvider });
    expect(reloaded.result.current.chapterProgress.done).toBe(4);
    expect(reloaded.result.current.state.xp.sansu).toBe(before + REWARD.main);

    await act(async () => { await vi.advanceTimersByTimeAsync(700); await finished; });
    expect(savedState().xp.sansu).toBe(before + REWARD.main);
  });

  it("寄り道は歩き出す前に保存し、画面は寄り道まで歩いてから進む", async () => {
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    const before = result.current.state.xp.sansu;
    const target = { kind: "side", sideId: "fraction-t2" } as const;
    let finished: Promise<void> = Promise.resolve();
    act(() => { finished = result.current.completeLesson(target); });

    expect(result.current.walkingTo).toEqual(target);
    expect(result.current.chapterProgress.sides).toEqual([]);
    expect(savedState().progress.fraction?.sides).toEqual(["fraction-t2"]);
    expect(savedState().xp.sansu).toBe(before + REWARD.training);

    await act(async () => { await vi.advanceTimersByTimeAsync(620); });
    expect(result.current.walkingTo).toBeNull();
    expect(result.current.chapterProgress.sides).toEqual(["fraction-t2"]);
    expect(result.current.state.xp.sansu).toBe(before);

    await act(async () => { await vi.advanceTimersByTimeAsync(620); await finished; });
    expect(result.current.state.xp.sansu).toBe(before + REWARD.training);
    expect(savedState().xp.sansu).toBe(before + REWARD.training);
  });

  it("歩く間にほかの保存が走っても、先に保存した経験値を消さない", async () => {
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    const before = result.current.state.xp.sansu;
    let finished: Promise<void> = Promise.resolve();
    act(() => { finished = result.current.completeLesson({ kind: "main", index: 3 }); });
    act(() => { result.current.toggleGear("hat"); });

    expect(savedState().takenOff).toEqual(["hat"]);
    expect(savedState().xp.sansu).toBe(before + REWARD.main);

    await act(async () => { await vi.advanceTimersByTimeAsync(700); await finished; });
    expect(savedState().takenOff).toEqual(["hat"]);
    expect(savedState().xp.sansu).toBe(before + REWARD.main);
  });

  it("寄り道の最初に歩いている間に保存が走っても、進みと経験値がそろって保存され、二重には入らない", async () => {
    for (const waitMs of [0, 100, 300]) {
      localStorage.clear();
      saveGrade5ForTest();
      seedMidwayState();
      const { result, unmount } = renderHook(() => useGame(), { wrapper: GradeProvider });
      const before = result.current.state.xp.sansu;
      const target = { kind: "side", sideId: "fraction-t2" } as const;
      let finished: Promise<void> = Promise.resolve();
      act(() => { finished = result.current.completeLesson(target); });
      await act(async () => { await vi.advanceTimersByTimeAsync(waitMs); });
      act(() => { result.current.toggleGear("hat"); });

      expect(savedState().takenOff).toEqual(["hat"]);
      expect(savedState().progress.fraction?.sides).toEqual(["fraction-t2"]);
      expect(savedState().xp.sansu).toBe(before + REWARD.training);

      await act(async () => { await vi.advanceTimersByTimeAsync(1500); await finished; });
      expect(savedState().progress.fraction?.sides).toEqual(["fraction-t2"]);
      expect(savedState().xp.sansu).toBe(before + REWARD.training);

      // 読み直してもう一度クリアしても、経験値は増えない
      unmount();
      const again = renderHook(() => useGame(), { wrapper: GradeProvider });
      expect(again.result.current.chapterProgress.sides).toEqual(["fraction-t2"]);
      let second: Promise<void> = Promise.resolve();
      act(() => { second = again.result.current.completeLesson(target); });
      await act(async () => { await vi.advanceTimersByTimeAsync(1500); await second; });
      expect(savedState().xp.sansu).toBe(before + REWARD.training);
      again.unmount();
    }
  });

  it("寄り道を達成した直後から終わるまでのどの時刻に装備を外しても、経験値は1回分しか増えない（#514）", async () => {
    for (const waitMs of [0, 1, 100, 299, 300, 301, 619, 620, 621, 700, 1000, 1239, 1240, 1241]) {
      localStorage.clear();
      saveGrade5ForTest();
      seedMidwayState();
      const { result, unmount } = renderHook(() => useGame(), { wrapper: GradeProvider });
      const before = result.current.state.xp.sansu;
      let finished: Promise<void> = Promise.resolve();
      act(() => { finished = result.current.completeLesson({ kind: "side", sideId: "fraction-t2" }); });
      await act(async () => { await vi.advanceTimersByTimeAsync(waitMs); });
      act(() => { result.current.toggleGear("hat"); });
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); await finished; });

      expect(result.current.state.xp.sansu, `装備を外した時刻 ${waitMs}ms`).toBe(before + REWARD.training);
      expect(savedState().xp.sansu, `保存 ${waitMs}ms`).toBe(before + REWARD.training);
      unmount();
    }
  });

  it("歩いている間は「はじめから」を受け付けず、false を返す", async () => {
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    act(() => { void result.current.completeLesson({ kind: "main", index: 3 }); });
    let accepted = true;
    act(() => { accepted = result.current.reset(); });
    expect(accepted).toBe(false);
    expect(result.current.chapterProgress.done).toBe(4);

    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    act(() => { accepted = result.current.reset(); });
    expect(accepted).toBe(true);
    expect(result.current.state).toEqual(SAMPLE_STATE);
  });

  it("算数の章は順番が無いので、未クリアの章の後ろの問題のある章も選べる（D-130）。問題の無い章と知らない章は false を返し、章もトーストも変わらない（D-133）", () => {
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    let ok = false;
    act(() => { ok = result.current.selectChapter("expression"); });
    expect(ok).toBe(true);
    expect(result.current.chapter.id).toBe("expression");
    act(() => { ok = result.current.selectChapter("fraction"); });
    expect(result.current.chapter.id).toBe("fraction");
    // 問題の無い章は鍵なので選べない
    act(() => { ok = result.current.selectChapter("plane"); });
    expect(ok).toBe(false);
    expect(result.current.chapter.id).toBe("fraction");
    act(() => { ok = result.current.selectChapter("nope"); });
    expect(result.current.toast).toBeNull();
    expect(ok).toBe(false);
    expect(result.current.chapter.id).toBe("fraction");
  });

  it("openChapter は開いた章で /sansu/{id} へ移り、問題の無い章と知らない章では道も章も替わらない（D-133）", () => {
    window.history.replaceState(null, "", "/sansu");
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    let ok = false;
    act(() => { ok = result.current.openChapter("integer"); });
    expect(ok).toBe(true);
    expect(result.current.chapter.id).toBe("integer");
    expect(window.location.pathname).toBe("/sansu/integer");
    act(() => { ok = result.current.openChapter("expression"); });
    expect(ok).toBe(true);
    expect(window.location.pathname).toBe("/sansu/expression");
    // 問題の無い章は鍵なので、道も章も替わらない
    act(() => { ok = result.current.openChapter("plane"); });
    expect(ok).toBe(false);
    act(() => { ok = result.current.openChapter("nope"); });
    expect(ok).toBe(false);
    expect(result.current.chapter.id).toBe("expression");
    expect(window.location.pathname).toBe("/sansu/expression");
  });

  it("歩いている間の2つ目のクリアは受け付けない", async () => {
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    act(() => { void result.current.completeLesson({ kind: "main", index: 3 }); });
    act(() => { void result.current.completeLesson({ kind: "main", index: 4 }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(result.current.chapterProgress.done).toBe(4);
  });

  it("保存に失敗しても進み、CP-211 は1回だけ出る", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    act(() => { result.current.selectChapter("integer"); });
    expect(result.current.chapter.id).toBe("integer");
    expect(plainText(result.current.toast?.text ?? "")).toBe("進み具合を保存できませんでした。ブラウザを閉じると消えます");
    const firstId = result.current.toast?.id;
    act(() => { result.current.selectChapter("fraction"); });
    expect(result.current.toast?.id).toBe(firstId);
  });

  it("requiredChapterOf は、順番の無い算数の章には前提を返さない（D-130）", () => {
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    const area = CHAPTERS.find((chapter) => chapter.id === "area") as Chapter;
    const fraction = CHAPTERS.find((chapter) => chapter.id === "fraction") as Chapter;
    expect(result.current.requiredChapterOf(area)).toBeUndefined();
    expect(result.current.requiredChapterOf(fraction)).toBeUndefined();
  });

  it("学習の無いマスを呼ばれたら、学習へ移らず CP-222 を出す", () => {
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    // 問題のある章のうち、問題の無いマス（範囲の外のマス）を呼ぶ
    act(() => { result.current.selectChapter("fraction"); });
    let started = true;
    act(() => { started = result.current.startLesson({ kind: "main", index: 99 }); });
    expect(started).toBe(false);
    expect(plainText(result.current.toast?.text ?? "")).toBe("この学習はまだ作っているところです");
  });

  it("はじめからにすると、学習の途中の記録も消す", () => {
    localStorage.setItem("sugoroku-lesson-resume", JSON.stringify({ "main-3": 2 }));
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    act(() => { result.current.reset(); });
    expect(localStorage.getItem("sugoroku-lesson-resume")).toBeNull();
  });

  it("どの教科も選べる。算数以外を選んでも、算数を選んだ記録は付かない（D-91）", () => {
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    let ok = false;
    act(() => { ok = result.current.selectSubject("kokugo"); });
    expect(ok).toBe(true);
    expect(result.current.toast).toBeNull();
    expect(result.current.state.sansuSelected).toBe(false);
    act(() => { ok = result.current.selectSubject("sansu"); });
    expect(ok).toBe(true);
    expect(result.current.state.sansuSelected).toBe(true);
  });

  it("算数の章は今の学年のもの。保存の章が今の学年に無ければ、その学年の最初の開いた章を使い、開いた章が無ければ最後の章を使う（FR-008、D-133）", () => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 3 }));
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    const chapters = chaptersOf(3, "sansu");
    expect(result.current.chapters).toBe(chapters);
    // 保存は5年の分数の章だが、3年の算数には問題が無くどの章も閉じるので、読み込んだ時に3年の最後の章へそろう
    const last = chapters[chapters.length - 1]!;
    expect(result.current.state.chapterId).toBe(last.id);
    expect(result.current.chapter.id).toBe(last.id);
    expect(chapters.every((chapter) => !result.current.isChapterOpen(chapter))).toBe(true);
    expect(result.current.hasLessonsInChapter(chapters[0]!.id)).toBe(false);
  });

  it("5年の算数は順番が無いので、分数のテストが未クリアでも、問題のある章は開き、問題の無い章は鍵になる（D-130、D-133）", () => {
    localStorage.setItem("sugoroku-home-v2", JSON.stringify(SAMPLE_STATE));
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    expect(CHAPTERS.every((chapter) => result.current.isChapterOpen(chapter) === result.current.hasLessonsInChapter(chapter.id))).toBe(true);
    const available = CHAPTERS.filter((chapter) => result.current.isChapterOpen(chapter)).map((chapter) => chapter.id);
    expect(available).toEqual(expect.arrayContaining(["integer", "decimal", "fraction", "expression"]));
    expect(available).not.toContain("plane");
  });

  it("寄り道の2回目は経験値もトーストも出ない（D-21）", async () => {
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    act(() => { result.current.selectChapter("integer"); });
    const before = result.current.totalXp;
    let finished: Promise<void> = Promise.resolve();
    act(() => { finished = result.current.completeLesson({ kind: "side", sideId: "integer-t" }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); await finished; });
    expect(result.current.totalXp).toBe(before);
    expect(result.current.toast).toBeNull();
  });

  it("アバターのレベルが上がるクリアでは levelUp が入り、閉じると消える", async () => {
    // 見本は合計 1740。算数を 510 にして合計 1790 にすると、+20 で 1810（Lv.10）になる
    const saved = { ...structuredClone(MIDWAY_STATE), xp: { ...MIDWAY_STATE.xp, sansu: 510 } };
    localStorage.setItem("sugoroku-home-v2", JSON.stringify(saved));
    const { result } = renderHook(() => useGame(), { wrapper: GradeProvider });
    let finished: Promise<void> = Promise.resolve();
    act(() => { finished = result.current.completeLesson({ kind: "main", index: 3 }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(700); await finished; });
    expect(result.current.levelUp?.level).toBe(10);
    expect(result.current.levelUp?.newGear?.id).toBe("cape");
    act(() => { result.current.clearLevelUp(); });
    expect(result.current.levelUp).toBeNull();
  });
});
