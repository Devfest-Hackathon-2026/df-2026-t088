import { describe, expect, it } from "vitest";
import {
  MOON_TARGETS,
  initialLever,
  initialMoon,
  leverAnswer,
  leverAuto,
  leverBarRatio,
  leverChoices,
  leverChoose,
  classifyLeverWrongAnswer,
  leverShift,
  leverTilt,
  moonAuto,
  moonRotate,
  moonShape,
  moonSet,
  snapMoonAngle,
} from "./templates";

const params = { left: { pos: 2, g: 30 }, right: { pos: 3 } }; // 答え 20g

describe("てこの型", () => {
  it("使える間違い方がそろうと、同じ重さ・逆比・正解を小さい順に出す", () => {
    const valid = { left: { pos: 2, g: 40 }, right: { pos: 4 } };
    expect(leverAnswer(valid)).toBe(20);
    expect(leverChoices(valid)).toEqual([20, 40, 80]);
  });

  it("候補が使えないときは、答えと ±10g を小さい順に並べる", () => {
    expect(leverAnswer(params)).toBe(20);
    expect(leverChoices(params)).toEqual([10, 20, 30]);
    expect(leverChoices({ left: { pos: 1, g: 10 }, right: { pos: 1 } })).toEqual([10, 20, 30]);
  });

  // server/eval/make-print-images.mjs の見本 lever-01〜10
  const samples = [[2, 30, 3], [3, 20, 2], [4, 30, 6], [5, 40, 2], [2, 90, 3], [6, 20, 4], [3, 80, 6], [4, 30, 2], [5, 20, 1], [3, 60, 3]].map(
    ([leftPos, g, rightPos]) => ({ left: { pos: leftPos, g }, right: { pos: rightPos } }),
  );

  it.each(samples.map((sample, index) => [index + 1, sample] as const))("見本 lever-%i は、10〜100g の 10g 刻みで重ならない 3 つに正解が入る", (_, sample) => {
    const choices = leverChoices(sample);
    expect(choices).toHaveLength(3);
    expect(new Set(choices).size).toBe(3);
    expect(choices).toEqual([...choices].sort((a, b) => a - b));
    expect(choices).toContain(leverAnswer(sample));
    for (const g of choices) {
      expect(g).toBeGreaterThanOrEqual(10);
      expect(g).toBeLessThanOrEqual(100);
      expect(g % 10).toBe(0);
    }
  });

  it.each(samples.map((sample, index) => [index + 1, sample] as const))("見本 lever-%i は、同じ重さが使えるなら選択肢に残り、選ぶと lever-same-weight が付く", (_, sample) => {
    const sameWeight = sample.left.g;
    if (sameWeight === leverAnswer(sample)) return;
    expect(leverChoices(sample)).toContain(sameWeight);
    expect(classifyLeverWrongAnswer(sample, sameWeight)).toBe("lever-same-weight");
  });

  it("逆比が使えるなら選択肢に残り、選ぶと lever-inverse が付く", () => {
    const sample = { left: { pos: 2, g: 20 }, right: { pos: 4 } }; // 答え 10、逆比 40
    expect(leverChoices(sample)).toContain(40);
    expect(classifyLeverWrongAnswer(sample, 40)).toBe("lever-inverse");
  });

  it("左 2・40g・右 4 は 20・40・80 になる", () => {
    expect(leverChoices({ left: { pos: 2, g: 40 }, right: { pos: 4 } })).toEqual([20, 40, 80]);
  });

  it("上限の 100g を超える 110g や、0g を出さない", () => {
    const lever09 = { left: { pos: 5, g: 20 }, right: { pos: 1 } }; // 答え 100
    expect(leverChoices(lever09)).not.toContain(110);
    expect(Math.max(...leverChoices(lever09))).toBe(100);
    for (const sample of samples) {
      expect(Math.max(...leverChoices(sample))).toBeLessThanOrEqual(100);
      expect(Math.min(...leverChoices(sample))).toBeGreaterThanOrEqual(10);
    }
  });

  it("選んだ間違いから、同じ重さ・逆比・その他を分ける", () => {
    const valid = { left: { pos: 2, g: 40 }, right: { pos: 4 } };
    expect(classifyLeverWrongAnswer(valid, 40)).toBe("lever-same-weight");
    expect(classifyLeverWrongAnswer(valid, 80)).toBe("lever-inverse");
    expect(classifyLeverWrongAnswer(valid, 30)).toBe("unclassified");
    expect(classifyLeverWrongAnswer(valid, 20)).toBe("unclassified");
  });

  it("合う重さで手順 2 へ進み、軽いと左・重いと右へ傾いて進まない", () => {
    const s0 = initialLever(params);
    expect(leverTilt(params, s0)).toBe("left");
    const light = leverChoose(params, s0, 10);
    expect(light).toMatchObject({ step: 0, note: "light" });
    expect(leverTilt(params, light)).toBe("left");
    const heavy = leverChoose(params, s0, 30);
    expect(heavy).toMatchObject({ step: 0, note: "heavy" });
    expect(leverTilt(params, heavy)).toBe("right");
    const ok = leverChoose(params, s0, 20);
    expect(ok.step).toBe(1);
    expect(leverTilt(params, ok)).toBe("balanced");
  });

  it("外へずらすと右へ傾いて終わる。めもり 6 では内へ 1 つずらして左へ傾く", () => {
    const done = leverShift(leverAuto(params, initialLever(params)));
    expect(done).toMatchObject({ step: 2, rightPos: 4 });
    expect(leverTilt(params, done)).toBe("right");
    const edge = { left: { pos: 3, g: 20 }, right: { pos: 6 } }; // 答え 10g
    const edgeDone = leverShift(leverAuto(edge, initialLever(edge)));
    expect(edgeDone.rightPos).toBe(5);
    expect(leverTilt(edge, edgeDone)).toBe("left");
  });

  it("棒は左の積の 2 倍を満タンにして、はみ出さない", () => {
    expect(leverBarRatio(60, 60)).toBe(0.5);
    expect(leverBarRatio(500, 60)).toBe(1);
    expect(leverBarRatio(undefined, 60)).toBe(0);
  });
});

describe("月の型", () => {
  it("始めは 90°。押すだけで満月 → 半月 → 新月と進む", () => {
    let s = initialMoon();
    expect(s).toEqual({ step: 0, angle: 90 });
    s = moonRotate(s, 90);
    expect(s).toEqual({ step: 1, angle: 180 });
    s = moonRotate(s, 90);
    expect(s).toEqual({ step: 2, angle: 270 });
    s = moonRotate(s, 90);
    expect(s).toEqual({ step: 3, angle: 0 });
  });

  it("45° ずつでも進み、目標でない位置では手順が進まない", () => {
    let s = moonRotate(initialMoon(), 45);
    expect(s).toEqual({ step: 0, angle: 135 });
    s = moonRotate(s, 45);
    expect(s.step).toBe(1);
  });

  it("自動は目標へ反時計回りに進み、3 手で終わる", () => {
    let s = initialMoon();
    for (let i = 0; i < MOON_TARGETS.length; i++) s = moonAuto(s);
    expect(s.step).toBe(3);
    expect(moonAuto(s)).toEqual(s);
  });

  it("ドラッグの位置は近い 45° に寄る。形の名前が位置で決まる", () => {
    expect(snapMoonAngle(100)).toBe(90);
    expect(snapMoonAngle(-10)).toBe(0);
    expect(moonSet(initialMoon(), 175).angle).toBe(180);
    expect(moonShape(0).name).toContain("新月");
    expect(moonShape(180).name).toContain("満月");
    expect(moonShape(180).where).toBe("opposite");
    expect(moonShape(135).name).toContain("近");
  });
});
