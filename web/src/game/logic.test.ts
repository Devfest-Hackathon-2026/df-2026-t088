import { describe, expect, it } from "vitest";
import { CHAPTERS, EQUIPMENT, KOKUGO_CHAPTERS, SAMPLE_STATE } from "../data";
import { MIDWAY_STATE } from "./test-state";
import type { GameState } from "../data";
import { TILE_LESSON_SIDE_ID } from "../lesson/problems";
import {
  applyProgress,
  applyXp,
  avatarLevel,
  defaultCardTarget,
  isChapterOpen,
  nextOpenChapter,
  nextChapterAfter,
  normalizeChapter,
  parseDurationMs,
  progressOf,
  requiredChapter,
  subjectLevel,
  totalXp,
  wornGear,
} from "./logic";

const sample = (): GameState => structuredClone(MIDWAY_STATE);
const chapter = (id: string) => {
  const found = CHAPTERS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`章が無い: ${id}`);
  return found;
};

describe("開始の状態", () => {
  it("アバターも算数も Lv.1 で、小数の章の最初にいる", () => {
    expect(avatarLevel(totalXp(SAMPLE_STATE))).toBe(1);
    expect(subjectLevel(SAMPLE_STATE.xp.sansu)).toBe(1);
    expect(SAMPLE_STATE.chapterId).toBe("decimal");
    expect(SAMPLE_STATE.progress).toEqual({});
  });

  it("算数を選んだ記録は無い", () => {
    expect(SAMPLE_STATE.sansuSelected).toBe(false);
  });

  it("途中から始める説明は出さない", () => {
    expect(SAMPLE_STATE.introSeen).toBe(true);
  });

  it("Lv.1 なので、装備は何も身につけていない", () => {
    expect(wornGear(SAMPLE_STATE)).toEqual([]);
  });
});

describe("途中の状態（テスト用）", () => {
  it("Lv.9 なので、えんぴつのつえとぼうしを身につけている", () => {
    expect(avatarLevel(totalXp(sample()))).toBe(9);
    expect(wornGear(sample())).toEqual(["pencil", "hat"]);
  });
});

describe("経験値とレベル", () => {
  it("算数 100 ごとにレベルが上がる", () => {
    expect([0, 99, 100, 460].map(subjectLevel)).toEqual([1, 1, 2, 5]);
  });

  it("アバターは全教科の合計 200 ごとにレベルが上がる", () => {
    expect([0, 199, 200, 1740].map(avatarLevel)).toEqual([1, 1, 2, 9]);
  });

  it("経験値を足してアバターのレベルが上がると、新しい装備が分かる", () => {
    const result = applyXp(sample(), 120); // 合計 1740 → 1860 で Lv.10
    expect(result.levelUp?.level).toBe(10);
    expect(result.levelUp?.newGear?.id).toBe("cape");
  });

  it("レベルが上がらなければ levelUp は null", () => {
    const result = applyXp(sample(), 20);
    expect(result.levelUp).toBeNull();
    expect(result.sansuLevelUp).toBeNull();
  });

  it("算数だけレベルが上がる時は sansuLevelUp が入る", () => {
    const result = applyXp(sample(), 40); // 算数 460 → 500 で Lv.6。合計 1780 は Lv.9 のまま
    expect(result.levelUp).toBeNull();
    expect(result.sansuLevelUp).toBe(6);
  });

  it("引数を省くと従来どおり算数だけが増える", () => {
    const result = applyXp(sample(), 15);
    expect(result.state.xp.sansu).toBe(sample().xp.sansu + 15);
    expect(result.state.xp.kokugo).toBe(sample().xp.kokugo);
    expect(result.sansuLevelUp).toBe(result.subjectLevelUp);
  });

  it("国語の進みと経験値は算数を変えない", () => {
    const state = structuredClone(SAMPLE_STATE);
    const chapter = KOKUGO_CHAPTERS[0]!;
    const progress = applyProgress(state, { kind: "main", index: 0 }, chapter);
    const xp = applyXp(progress.state, progress.amount, "kokugo");
    expect(xp.state.progress[chapter.id]?.done).toBe(1);
    expect(xp.state.xp.kokugo).toBe(progress.amount);
    expect(xp.state.progress.decimal).toBeUndefined();
    expect(xp.state.xp.sansu).toBe(0);
    expect(xp.sansuLevelUp).toBeNull();
  });

  it("はずした装備は身につけない。レベルが足りない装備も身につけない", () => {
    const state = { ...sample(), takenOff: ["hat" as const] };
    expect(wornGear(state)).toEqual(["pencil"]);
    expect(EQUIPMENT.find((item) => item.id === "crown")?.level).toBe(18);
  });
});

// 5年の算数は順番が無い（D-130）。鍵の動き（FR-004）は、同じ13章を順番のある教科として並べた物で確かめる
const ORDERED = CHAPTERS.map((item) => ({ ...item, ordered: true }));
const locked = (id: string) => {
  const found = ORDERED.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`章が無い: ${id}`);
  return found;
};

describe("5年の算数の章の開き方（D-130）", () => {
  it("順番が無いので、最初の状態でどの章も開いている", () => {
    for (const item of CHAPTERS) expect(isChapterOpen(SAMPLE_STATE, item)).toBe(true);
    expect(requiredChapter(SAMPLE_STATE, chapter("plane"))).toBeUndefined();
  });

  it("保存の章が未クリアの章の後ろでも、そのまま開く", () => {
    expect(normalizeChapter({ ...sample(), chapterId: "plane" }).chapterId).toBe("plane");
  });

  it("テストをクリアした後は、同じ分野の後ろの未クリアの章へ送る", () => {
    const state = structuredClone(SAMPLE_STATE);
    state.progress.plane = { done: 4, sides: [], test: true };
    expect(nextChapterAfter(state, chapter("plane"))?.id).toBe("solid");
  });
});

describe("章の鍵（D-101）", () => {
  it("最初の章は開いている", () => {
    expect(isChapterOpen(SAMPLE_STATE, ORDERED[0]!, ORDERED)).toBe(true);
  });

  it("課程内の章順でも前のテストが次の章を開ける", () => {
    const state = structuredClone(SAMPLE_STATE);
    const first = KOKUGO_CHAPTERS[0]!;
    // 順番のある教科の章として扱う（国語の漢字の章そのものは順番が無い）
    const second = { ...first, id: "kokugo-next", ordered: true };
    const chapters = [{ ...first, ordered: true }, second];
    expect(isChapterOpen(state, second, chapters)).toBe(false);
    state.progress[first.id] = { done: first.items.length, sides: [], test: true };
    expect(isChapterOpen(state, second, chapters)).toBe(true);
  });

  it("最初の状態では、最初の章のほかは分野の最初の章も学習のある分数もすべて閉じる", () => {
    for (const item of ORDERED.slice(1)) {
      expect(isChapterOpen(SAMPLE_STATE, item, ORDERED)).toBe(false);
    }
  });

  it("前の章のテストをクリアすると、分野をまたいでも次の章が開く", () => {
    const state = sample();
    expect(isChapterOpen(state, locked("plane"), ORDERED)).toBe(false);
    state.progress.fraction = { done: 9, sides: [], test: true };
    expect(isChapterOpen(state, locked("plane"), ORDERED)).toBe(true);
    expect(isChapterOpen(state, locked("solid"), ORDERED)).toBe(false);
  });

  it("前の章を全部クリアしていれば、分数の章が開く", () => {
    expect(isChapterOpen(sample(), locked("fraction"), ORDERED)).toBe(true);
  });

  it("閉じた章を開いたまま保存されていたら、開いている章へ戻す", () => {
    const state = { ...sample(), chapterId: "plane" };
    expect(normalizeChapter(state, ORDERED).chapterId).toBe("fraction");
  });
});

describe("章の鍵（飛ばした章がある保存）", () => {
  it("途中の章がクリアされていなければ、その先は後ろの章をクリアしていても開かない", () => {
    const state = sample();
    delete state.progress.decimal;
    expect(isChapterOpen(state, locked("fraction"), ORDERED)).toBe(false);
    expect(isChapterOpen(state, locked("expression"), ORDERED)).toBe(false);
  });
});

describe("章の開き方（FR-004、C-13）", () => {
  // 4つの章 a〜d。b だけ問題が無い
  const make = (ordered: boolean) => ["a", "b", "c", "d"].map((id) => ({ ...CHAPTERS[0]!, id, ordered }));
  const hasLessons = (id: string) => id !== "b";
  const cleared = (...ids: string[]): GameState => ({
    ...structuredClone(SAMPLE_STATE),
    progress: Object.fromEntries(ids.map((id) => [id, { done: 0, sides: [], test: true }])),
  });
  const open = (state: GameState, chapters: ReturnType<typeof make>, has?: (id: string) => boolean) => chapters.map((c) => isChapterOpen(state, c, chapters, has));

  it("順番の無い教科は、問題のある章がいつも開き、問題の無い章は閉じる（D-130、D-133）", () => {
    const chapters = make(false);
    expect(open(cleared(), chapters, () => true)).toEqual([true, true, true, true]);
    expect(requiredChapter(cleared(), chapters[3]!, chapters, () => true)).toBeUndefined();
    // b だけ問題が無い。順番が無くても、問題の無い b は閉じる
    expect(open(cleared(), chapters, hasLessons)).toEqual([true, false, true, true]);
  });

  it("順番のある教科は、前の章のうち問題のある章のテストを全部クリアすると開き、問題の無い章は飛ばす（D-133 で問題の無い章自身は閉じる）", () => {
    const chapters = make(true);
    expect(open(cleared(), chapters, hasLessons)).toEqual([true, false, false, false]);
    // a をクリアすれば b（問題が無い）をクリアしなくても c が開く。b 自身は閉じたまま
    expect(open(cleared("a"), chapters, hasLessons)).toEqual([true, false, true, false]);
    expect(open(cleared("a", "c"), chapters, hasLessons)).toEqual([true, false, true, true]);
    expect(requiredChapter(cleared(), chapters[3]!, chapters, hasLessons)?.id).toBe("a");
  });

  it("問題の無い章は ordered に関係なく閉じ、問題のある順番無しの章は開く（D-133、D-130）", () => {
    for (const ordered of [true, false]) {
      const chapter = make(ordered)[1]!;
      expect(isChapterOpen(cleared(), chapter, make(ordered), () => false)).toBe(false);
    }
    const unordered = make(false);
    expect(isChapterOpen(cleared(), unordered[3]!, unordered, hasLessons)).toBe(true);
  });

  it("どの章にも問題が無い教科は、どの章も閉じる（D-133）", () => {
    for (const ordered of [true, false]) {
      expect(open(cleared(), make(ordered), () => false)).toEqual([false, false, false, false]);
      expect(open(cleared("a", "b", "c", "d"), make(ordered), () => false)).toEqual([false, false, false, false]);
    }
  });

  it("引数を省くと、どの章にも問題がある扱い", () => {
    const chapters = make(true);
    expect(open(cleared(), chapters)).toEqual([true, false, false, false]);
    expect(open(cleared("a"), chapters)).toEqual([true, true, false, false]);
  });

  it("nextOpenChapter・nextChapterAfter・normalizeChapter も同じ開き方で動く", () => {
    const chapters = make(true);
    const state = cleared();
    // 問題が無い教科では、開いている章が無い
    expect(nextOpenChapter(state, chapters, () => false)).toBeUndefined();
    // c は a をクリアするまで閉じる。b は問題が無く閉じるので、a の次は c が最初の未クリアの開いた章
    expect(nextOpenChapter(cleared("a"), chapters, hasLessons)?.id).toBe("c");
    expect(nextChapterAfter(cleared("a"), chapters[0]!, chapters, hasLessons)?.id).toBe("c");
    // 閉じた章を開いたまま保存されていたら、開いている章へ戻す
    expect(normalizeChapter({ ...state, chapterId: "d" }, chapters, hasLessons).chapterId).toBe("a");
    // この教科に無い章（別の学年の章）は、どの章も開いていなければ最後の章へ
    expect(normalizeChapter({ ...state, chapterId: "zzz" }, chapters, () => false).chapterId).toBe("d");
  });

  it("normalizeChapter は、保存の章が鍵なら問題のある最初の未クリアの章へ移す（D-133）", () => {
    const chapters = make(false);
    // b は問題が無く閉じている。a をクリア済みなら、未クリアで開いている c へ
    expect(normalizeChapter({ ...cleared("a"), chapterId: "b" }, chapters, hasLessons).chapterId).toBe("c");
    expect(normalizeChapter({ ...cleared(), chapterId: "b" }, chapters, hasLessons).chapterId).toBe("a");
  });

  it("normalizeChapter は、全部クリア済みでも開いている章へ移す（D-133）", () => {
    const chapters = make(false);
    const state = { ...cleared("a", "b", "c", "d"), chapterId: "b" };
    expect(normalizeChapter(state, chapters, hasLessons).chapterId).toBe("a");
  });

  it("normalizeChapter は、どの章も開いていなければ、保存の章がこの教科にある時は移さない。無い時は最後の章へ（D-133）", () => {
    const chapters = make(true);
    const here = { ...cleared(), chapterId: "b" };
    expect(normalizeChapter(here, chapters, () => false)).toBe(here);
    expect(normalizeChapter({ ...cleared(), chapterId: "zzz" }, chapters, () => false).chapterId).toBe("d");
  });
});

describe("requiredChapter", () => {
  it("前にあってまだクリアしていない最初の章を返す。分野は問わない", () => {
    const skipped = sample();
    delete skipped.progress.decimal;
    expect(requiredChapter(skipped, locked("fraction"), ORDERED)?.id).toBe("decimal");
    expect(requiredChapter(SAMPLE_STATE, locked("plane"), ORDERED)?.id).toBe("integer");
    expect(requiredChapter(sample(), locked("plane"), ORDERED)?.id).toBe("fraction");
  });

  it("最初の章や、前がすべてクリア済みの章は undefined", () => {
    expect(requiredChapter(SAMPLE_STATE, locked("integer"), ORDERED)).toBeUndefined();
    expect(requiredChapter(sample(), locked("fraction"), ORDERED)).toBeUndefined();
  });
});

describe("nextChapterAfter", () => {
  it("同じ分野の後ろの開いている未クリアの章を返す", () => {
    expect(nextChapterAfter(sample(), locked("decimal"), ORDERED)?.id).toBe("fraction");
  });

  it("同じ分野に残りが無ければ、全体の最初の未クリアの章を返す", () => {
    const state = sample();
    state.progress.fraction = { done: 9, sides: [], test: true };
    expect(nextChapterAfter(state, locked("expression"), ORDERED)?.id).toBe("plane");
  });

  it("次の章が閉じている時は、全体の最初の未クリアの章を返す", () => {
    // 整数が未クリアなので、図形の後の立体・面積・体積は閉じている。そのため全体の最初の未クリア（整数）に送る
    const state = structuredClone(SAMPLE_STATE);
    state.progress.plane = { done: 4, sides: [], test: true };
    expect(nextChapterAfter(state, locked("plane"), ORDERED)?.id).toBe("integer");
  });

  it("学習のある章でも、前の章が未クリアなら送らない", () => {
    // 整数が未クリアなので、小数の後の分数も式も閉じている。全体の最初の未クリア（整数）に送る
    const state = structuredClone(SAMPLE_STATE);
    state.progress.decimal = { done: 7, sides: [], test: true };
    expect(nextChapterAfter(state, locked("decimal"), ORDERED)?.id).toBe("integer");
  });

  it("全部クリアしていれば undefined", () => {
    const state = structuredClone(SAMPLE_STATE);
    for (const item of CHAPTERS) state.progress[item.id] = { done: item.items.length, sides: [], test: true };
    expect(nextChapterAfter(state, chapter("average"))).toBeUndefined();
  });
});

describe("defaultCardTarget", () => {
  it("マスが残っていれば今のマス、全部終えていれば章のテスト", () => {
    const fraction = chapter("fraction");
    expect(defaultCardTarget(fraction, { done: 3, sides: [], test: false })).toEqual({ kind: "main", index: 3 });
    expect(defaultCardTarget(fraction, { done: 9, sides: [], test: false })).toEqual({ kind: "test" });
  });
});

describe("進みの適用", () => {
  it("今のマスをクリアすると 1 マス進み、+20", () => {
    const result = applyProgress(sample(), { kind: "main", index: 3 });
    expect(result.valid).toBe(true);
    expect(result.amount).toBe(20);
    expect(progressOf(result.state, chapter("fraction")).done).toBe(4);
  });

  it("元の状態は書き換えない", () => {
    const state = sample();
    applyProgress(state, { kind: "main", index: 3 });
    expect(state.progress.fraction?.done).toBe(3);
  });

  it("順番を飛ばしたマスや終えたマスは受け付けない", () => {
    expect(applyProgress(sample(), { kind: "main", index: 5 }).valid).toBe(false);
    expect(applyProgress(sample(), { kind: "main", index: 1 }).valid).toBe(false);
  });

  it("マスが残っているうちは章のテストを受け付けない", () => {
    expect(applyProgress(sample(), { kind: "test" }).valid).toBe(false);
  });

  it("全部のマスを終えれば章のテストをクリアでき、+100", () => {
    const state = sample();
    state.progress.fraction = { done: 9, sides: [], test: false };
    const result = applyProgress(state, { kind: "test" });
    expect(result.amount).toBe(100);
    expect(progressOf(result.state, chapter("fraction")).test).toBe(true);
  });

  it("開いている寄り道は 1 回目だけ経験値が増える（D-21）", () => {
    const state = sample();
    state.progress.fraction = { done: 5, sides: [], test: false };
    const first = applyProgress(state, { kind: "side", sideId: "fraction-t1" });
    expect(first.amount).toBe(30);
    const second = applyProgress(first.state, { kind: "side", sideId: "fraction-t1" });
    expect(second.valid).toBe(true);
    expect(second.amount).toBe(0);
    expect(progressOf(second.state, chapter("fraction")).sides).toEqual(["fraction-t1"]);
  });

  it("まだ開いていない寄り道は受け付けない", () => {
    expect(applyProgress(sample(), { kind: "side", sideId: "fraction-a" }).valid).toBe(false);
  });

  it("見本の状態からタイルの寄り道へ行ける", () => {
    const result = applyProgress(sample(), { kind: "side", sideId: TILE_LESSON_SIDE_ID });
    expect(result.valid).toBe(true);
    expect(progressOf(result.state, chapter("fraction")).sides).toEqual([TILE_LESSON_SIDE_ID]);
  });
});

describe("データ", () => {
  it("全 13 章がそろっていて、どの章にもマスがある", () => {
    expect(CHAPTERS).toHaveLength(13);
    expect(CHAPTERS.every((item) => item.items.length > 0)).toBe(true);
  });

  it("すべての章が分野を持ち、sources の先頭の記号と合っている", () => {
    const byLetter = { A: "number", B: "shape", C: "change", D: "data" };
    for (const item of CHAPTERS) expect(item.domain).toBe(byLetter[item.sources[0]?.[0] as keyof typeof byLetter]);
  });

  it("寄り道の分かれ先は本線のマスの中にある", () => {
    for (const item of CHAPTERS) {
      for (const side of item.sides) expect(side.after).toBeLessThan(item.items.length);
    }
  });
});

describe("CSS の時間", () => {
  it("ms と s を読み、読めなければ fallback", () => {
    expect(parseDurationMs("620ms", 1)).toBe(620);
    expect(parseDurationMs(" 0.5s ", 1)).toBe(500);
    expect(parseDurationMs("", 7)).toBe(7);
  });
});
