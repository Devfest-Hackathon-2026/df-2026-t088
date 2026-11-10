import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackWave } from "./BackWave";
import { COVERED_AT, holdBackWave, isActive, playBackFade, playBackWave, subscribeFrame, waveClip } from "./back-wave";

const reduced = vi.hoisted(() => ({ value: false }));
const played = vi.hoisted(() => [] as string[]);

vi.mock("../audio/use-bgm", () => ({ playSe: (kind: string) => played.push(kind) }));

vi.mock("../pages/island-map/diorama/use-diorama", () => ({
  reducesMotion: () => reduced.value,
  tokenMs: (_name: string, fallback: number) => fallback,
}));

beforeEach(() => {
  vi.useFakeTimers();
  reduced.value = false;
  played.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

// --duration-wave（D-240）。テストでは tokenMs が FALLBACK_WAVE_MS を返す
const WAVE = 3000;
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe("海の幕（MOT-024）", () => {
  it("出す時に戻る音を1回鳴らす（D-104）", async () => {
    playBackWave(() => undefined);
    expect(played).toEqual(["back"]);
    await advance(WAVE);
    expect(played).toEqual(["back"]);
  });

  it("3枚目が覆い切った時に onCovered、終わった時に onDone の順で呼ぶ", async () => {
    const log: string[] = [];
    playBackWave(() => log.push("covered"), () => log.push("done"));
    expect(log).toEqual([]);
    await advance(WAVE * COVERED_AT - 40);
    expect(log).toEqual([]);
    await advance(80);
    expect(log).toEqual(["covered"]);
    await advance(WAVE);
    expect(log).toEqual(["covered", "done"]);
  });

  it("動いている間だけ重ねが出て、aria-hidden で入力を受ける", async () => {
    const { container } = render(<BackWave />);
    expect(container.querySelector(".back-wave")).toBeNull();
    act(() => playBackWave(() => {}));
    const overlay = container.querySelector(".back-wave");
    expect(overlay?.getAttribute("aria-hidden")).toBe("true");
    expect(overlay?.querySelectorAll(".back-wave__wave")).toHaveLength(6);
    await advance(675);
    expect((overlay?.querySelector(".back-wave__wave") as HTMLElement).style.clipPath).toContain("polygon(");
    await advance(2550);
    expect(container.querySelector(".back-wave")).toBeNull();
  });

  it("waitForRelease なしは今までどおり、COVERED_AT で onCovered、全長で onDone", async () => {
    const log: string[] = [];
    playBackWave(() => log.push("covered"), () => log.push("done"), {});
    await advance(WAVE * COVERED_AT + 40);
    expect(log).toEqual(["covered"]);
    await advance(WAVE * (1 - COVERED_AT));
    expect(log).toEqual(["covered", "done"]);
  });

  it("waitForRelease：解放されないうちは打ち寄せ続け、引くのは打ち寄せが覆い切った後", async () => {
    const log: string[] = [];
    const frames: [number, number | null][] = [];
    const off = subscribeFrame((p, lap) => frames.push([p, lap]));
    playBackWave(() => log.push("covered"), () => log.push("done"), { waitForRelease: true });
    const release = holdBackWave();
    await advance(WAVE * COVERED_AT + 40);
    expect(log).toEqual(["covered"]);
    // 3回ほど打ち寄せても終わらない。基の3枚は COVERED_AT で止まり、打ち寄せの進みは COVERED_AT を超えない
    await advance(WAVE * 3 + 200);
    expect(log).toEqual(["covered"]);
    const held = frames.slice(frames.findIndex(([, lap]) => lap !== null));
    expect(held.every(([p, lap]) => p === COVERED_AT && lap !== null && lap <= COVERED_AT)).toBe(true);
    // 寄せ始めの途中（覆い切る前）で解放する
    const before = frames.length;
    release();
    await advance(100);
    const afterRelease = frames.slice(before);
    expect(afterRelease.every(([p, lap]) => p === COVERED_AT && lap !== null)).toBe(true);
    expect(log).toEqual(["covered"]);
    // 覆い切ったら打ち寄せの層を消して引き、最後に onDone
    await advance(WAVE + 100);
    expect(frames.some(([p, lap]) => lap === null && p > COVERED_AT)).toBe(true);
    expect(log).toEqual(["covered", "done"]);
    off();
  });

  it("waitForRelease：覆っている間（打ち寄せの後半）に解放されたら、すぐ引く", async () => {
    const log: string[] = [];
    playBackWave(() => log.push("covered"), () => log.push("done"), { waitForRelease: true });
    const release = holdBackWave();
    // 打ち寄せ1回目の覆い切った後（COVERED_AT×WAVE の後ろ）に入るまで待つ
    await advance(WAVE * COVERED_AT + 40 + WAVE * COVERED_AT + 100);
    release();
    await advance(WAVE * (1 - COVERED_AT) + 100);
    expect(log).toEqual(["covered", "done"]);
  });

  it("COVERED_AT の前に保持が外れたら、いつもの MOT-024 のまま待たない", async () => {
    const log: string[] = [];
    const frames: (number | null)[] = [];
    const off = subscribeFrame((_p, lap) => frames.push(lap));
    playBackWave(() => log.push("covered"), () => log.push("done"), { waitForRelease: true });
    const release = holdBackWave();
    await advance(200);
    release();
    await advance(WAVE);
    expect(log).toEqual(["covered", "done"]);
    expect(frames.every((lap) => lap === null)).toBe(true);
    off();
  });

  it("onCovered の中で保持して外しても待たない（flushSync の想定）", async () => {
    const log: string[] = [];
    playBackWave(() => { log.push("covered"); holdBackWave()(); }, () => log.push("done"), { waitForRelease: true });
    await advance(WAVE + 100);
    expect(log).toEqual(["covered", "done"]);
  });

  it("解放されなくても12秒で自動で解放し、引き終える", async () => {
    const log: string[] = [];
    playBackWave(() => log.push("covered"), () => log.push("done"), { waitForRelease: true });
    holdBackWave();
    await advance(11_000);
    expect(log).toEqual(["covered"]);
    await advance(7000);
    expect(log).toEqual(["covered", "done"]);
  });

  it("waitForRelease でも誰も保持しなければ、いつもの MOT-024", async () => {
    const log: string[] = [];
    playBackWave(() => log.push("covered"), () => log.push("done"), { waitForRelease: true });
    await advance(WAVE + 100);
    expect(log).toEqual(["covered", "done"]);
  });

  it("待っていない run には保持できず、外す関数を何度呼んでも害は無い", async () => {
    holdBackWave()();
    const log: string[] = [];
    playBackWave(() => log.push("covered"), () => log.push("done"));
    const release = holdBackWave();
    release();
    release();
    await advance(WAVE + 100);
    expect(log).toEqual(["covered", "done"]);
  });

  it("保持 → 解放 → 保持（StrictMode の二重実行）でも待ち続け、最後の解放の後に引く", async () => {
    const log: string[] = [];
    playBackWave(() => log.push("covered"), () => log.push("done"), { waitForRelease: true });
    holdBackWave()();
    const release = holdBackWave();
    await advance(5000);
    expect(log).toEqual(["covered"]);
    release();
    release();
    await advance(WAVE + 100);
    expect(log).toEqual(["covered", "done"]);
  });

  it("保持が2つあれば、2つとも外れるまで引かない", async () => {
    const log: string[] = [];
    playBackWave(() => log.push("covered"), () => log.push("done"), { waitForRelease: true });
    const a = holdBackWave();
    const b = holdBackWave();
    await advance(2000);
    a();
    await advance(3000);
    expect(log).toEqual(["covered"]);
    b();
    await advance(WAVE + 100);
    expect(log).toEqual(["covered", "done"]);
  });

  it("打ち寄せ続けても戻る音は始めの1回だけ", async () => {
    playBackWave(() => {}, undefined, { waitForRelease: true });
    const release = holdBackWave();
    await advance(5000);
    release();
    await advance(WAVE + 100);
    expect(played).toEqual(["back"]);
  });

  it("動きを減らす設定では、覆った・終わったを即座に続けて呼ぶ", () => {
    reduced.value = true;
    const log: string[] = [];
    playBackWave(() => log.push("covered"), () => log.push("done"));
    expect(log).toEqual(["covered", "done"]);
  });

  it("途中で次が来たら、今の動きを最後まで飛ばしてから始める", async () => {
    const log: string[] = [];
    playBackWave(() => log.push("covered-1"), () => log.push("done-1"));
    await advance(200);
    playBackWave(() => log.push("covered-2"), () => log.push("done-2"));
    expect(log).toEqual(["covered-1", "done-1"]);
    await advance(WAVE + 100);
    expect(log).toEqual(["covered-1", "done-1", "covered-2", "done-2"]);
  });

  it("覆った後に次が来たら、onCovered を二重に呼ばない", async () => {
    const log: string[] = [];
    playBackWave(() => log.push("covered-1"), () => log.push("done-1"));
    await advance(2100);
    expect(log).toEqual(["covered-1"]);
    playBackWave(() => log.push("covered-2"));
    expect(log).toEqual(["covered-1", "done-1"]);
    await advance(WAVE + 100);
    expect(log).toEqual(["covered-1", "done-1", "covered-2"]);
  });

  it("始まりは画面の外、覆い切った時は3枚とも左端が画面の左より外", () => {
    const x = (poly: string) => poly.slice(8, -1).split(",").map((pt) => Number.parseFloat(pt));
    expect(Math.min(...x(waveClip(0, 0, 1000, 600)))).toBeGreaterThan(1000);
    for (let i = 0; i < 3; i++) {
      const left = x(waveClip(i, COVERED_AT, 1000, 600)).slice(0, 41);
      expect(Math.max(...left)).toBeLessThanOrEqual(0);
    }
  });
});

// --duration-normal（MOT-032、D-251）。テストでは tokenMs が FALLBACK_FADE_MS を返す
const FADE = 180;

describe("紙の幕（MOT-032、D-251）", () => {
  it("出す時に戻る音を1回鳴らし、--duration-normal で覆って onCovered、もう一度で onDone", async () => {
    const log: string[] = [];
    playBackFade(() => log.push("covered"), () => log.push("done"));
    expect(played).toEqual(["back"]);
    await advance(FADE - 40);
    expect(log).toEqual([]);
    await advance(80);
    expect(log).toEqual(["covered"]);
    await advance(FADE);
    expect(log).toEqual(["covered", "done"]);
    expect(isActive()).toBe(false);
  });

  it("動いている間だけ紙の面が出て、波は出さない。覆うまでは濃くし、覆ったら薄くする", async () => {
    const { container } = render(<BackWave />);
    act(() => playBackFade(() => {}));
    const overlay = container.querySelector(".back-fade");
    expect(overlay?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".back-wave")).toBeNull();
    await advance(40);
    expect(overlay?.classList.contains("back-fade--shown")).toBe(true);
    await advance(FADE);
    expect(overlay?.classList.contains("back-fade--shown")).toBe(false);
    await advance(FADE);
    expect(container.querySelector(".back-fade")).toBeNull();
  });

  it("波で待つ間の保持はできない", async () => {
    playBackFade(() => {});
    const release = holdBackWave();
    await advance(FADE * 2 + 40);
    expect(isActive()).toBe(false);
    release();
  });

  it("動きを減らす設定では、覆った・終わったを即座に続けて呼ぶ", () => {
    reduced.value = true;
    const log: string[] = [];
    playBackFade(() => log.push("covered"), () => log.push("done"));
    expect(log).toEqual(["covered", "done"]);
    expect(isActive()).toBe(false);
  });

  it("波の途中で紙の幕が来たら、波を最後まで飛ばしてから始める", async () => {
    const log: string[] = [];
    playBackWave(() => log.push("wave-covered"), () => log.push("wave-done"));
    await advance(200);
    playBackFade(() => log.push("fade-covered"), () => log.push("fade-done"));
    expect(log).toEqual(["wave-covered", "wave-done"]);
    await advance(FADE * 2 + 40);
    expect(log).toEqual(["wave-covered", "wave-done", "fade-covered", "fade-done"]);
  });
});
