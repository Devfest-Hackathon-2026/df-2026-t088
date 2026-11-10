import { describe, expect, it } from "vitest";
import { createSe, hzOf, PLACE_SCALE, SE_SOUNDS, SE_VOLUME, seForAnswer, soundOf } from "./se";
import type { SeKind } from "./se";

// Web Audio の代わり。作った発振器の高さと、止める時刻、音量の山だけを記録する
function fakeContext() {
  const oscillators: { hz: number; stopAt: number }[] = [];
  const peaks: number[] = [];
  const param = (onSet?: (v: number) => void) => ({
    setValueAtTime: (v: number) => onSet?.(v),
    linearRampToValueAtTime: (v: number) => onSet?.(v),
    exponentialRampToValueAtTime: () => undefined,
  });
  const context = {
    currentTime: 10,
    destination: {},
    createOscillator: () => {
      const entry = { hz: 0, stopAt: 0 };
      oscillators.push(entry);
      return {
        type: "sine",
        frequency: param((v) => { if (!entry.hz) entry.hz = v; }),
        connect: (node: unknown) => node,
        start: () => undefined,
        stop: (at: number) => { entry.stopAt = at; },
      };
    },
    createGain: () => ({ gain: param((v) => { if (v > 0) peaks.push(v); }), connect: (node: unknown) => node }),
  };
  return { context: context as unknown as AudioContext, oscillators, peaks };
}

const KINDS: SeKind[] = [...(Object.keys(SE_SOUNDS) as SeKind[]), "place"];

describe("効果音", () => {
  it("消してある時、最初の操作の前は鳴らさない", () => {
    const audio = fakeContext();
    createSe({ getContext: () => audio.context, isMuted: () => true }).play("correct");
    createSe({ getContext: () => null, isMuted: () => false }).play("correct");
    expect(audio.oscillators).toHaveLength(0);
  });

  it("鳴らすと、決めた音の数だけ発振器を作り、1 秒以内に止める（長い音は驚かせる）", () => {
    for (const kind of KINDS) {
      const audio = fakeContext();
      createSe({ getContext: () => audio.context, isMuted: () => false }).play(kind);
      expect(audio.oscillators.map((o) => o.hz)).toEqual(soundOf(kind).map((n) => n.hz));
      for (const o of audio.oscillators) expect(o.stopAt - 10).toBeLessThanOrEqual(1);
      for (const p of audio.peaks) expect(p).toBeLessThanOrEqual(SE_VOLUME);
    }
  });

  it("BGM と同じハ長調の五音（ド・レ・ミ・ソ・ラ）だけを使い、16分音符の刻みで鳴らす", () => {
    const pentatonic = new Set([0, 2, 4, 7, 9]);
    const notes = [...KINDS.flatMap((k) => soundOf(k)), ...PLACE_SCALE.map((_, i) => soundOf("place", i)[0])];
    for (const n of notes) {
      const pitchClass = ((Math.round(69 + 12 * Math.log2(n.hz / 440)) % 12) + 12) % 12;
      expect(pentatonic.has(pitchClass), `${n.hz.toFixed(1)}Hz`).toBe(true);
      expect((n.t / 0.0625) % 1, `${n.t}s`).toBeCloseTo(0);
    }
  });

  it("タイルを置くたびに 1 音ずつ上がり、上まで行ったらそのまま", () => {
    const hz = [0, 1, 2, 3, 4, 5, 6, 7, 20].map((i) => soundOf("place", i)[0].hz);
    for (let i = 1; i < 8; i++) expect(hz[i]).toBeGreaterThan(hz[i - 1]);
    expect(hz[8]).toBe(hz[7]);
    expect(hz[0]).toBeCloseTo(hzOf("C5"));
    expect(hzOf("A4")).toBe(440);
  });

  it("シャッター（MOT-030）：カシャは高い音 2 つをほぼ同時に、ういーんは低い音から上がる短い音 5 つ", () => {
    const [first, second] = soundOf("shutter");
    expect(second.t - first.t).toBeLessThan(0.1);
    expect(Math.min(first.hz, second.hz)).toBeGreaterThan(hzOf("C6"));
    const motor = soundOf("print");
    expect(motor).toHaveLength(5);
    for (let i = 1; i < motor.length; i++) expect(motor[i].hz).toBeGreaterThan(motor[i - 1].hz);
    expect(motor[0].hz).toBeLessThan(hzOf("C5"));
  });

  it("Web Audio が途中で失敗しても、投げずに黙る", () => {
    const broken = { currentTime: 0, createOscillator: () => { throw new Error("no audio"); } } as unknown as AudioContext;
    expect(() => createSe({ getContext: () => broken, isMuted: () => false }).play("tap")).not.toThrow();
  });
});

describe("答えた後の効果音", () => {
  const at = (message: Parameters<typeof seForAnswer>[0]["message"], isCorrect = false, isCleared = false) =>
    seForAnswer({ message, isCorrect, isCleared });

  it("正解は correct、最後の問題の正解は clear", () => {
    expect(at("correct", true)).toBe("correct");
    expect(at("correct", true, true)).toBe("clear");
    expect(at("alignedRight")).toBe("correct");
  });

  it("ちがった時は wrong", () => {
    for (const m of ["wrong", "wrongToTiles", "wrongToHints", "wrongInReview", "alignedWrong"] as const) expect(at(m)).toBe("wrong");
  });

  it("空欄や、約分などの形の注意では鳴らさない", () => {
    for (const m of ["empty", "invalid", "notLowest", "notCommon", "alignedEmpty", "back", null] as const) expect(at(m)).toBeNull();
  });
});
