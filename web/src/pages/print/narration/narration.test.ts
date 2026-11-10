import { describe, expect, it } from "vitest";
import { NARRATION_SEGMENTS, narrationForStep, narrationSegmentsFor } from "./narration";
import type { ReadProblem } from "../types";

const lever: ReadProblem = {
  templateId: "rika-lever",
  approved: true,
  questionText: "左の2のめもりに30g。右の3のめもり。",
  params: { left: { pos: 2, g: 30 }, right: { pos: 3 } },
};

describe("動く説明の読み上げ文", () => {
  it("てこの数字を短い音声に分けて組み立てる", () => {
    expect(narrationForStep(lever, 0)).toEqual([
      "lever-left", "number-2", "lever-mark", "weight-30", "lever-right", "number-3", "lever-mark", "lever-weight", "lever-hang",
    ]);
    expect(narrationForStep(lever, 1)).toEqual([
      "lever-right", "number-3", "lever-mark-within", "lever-weight", "lever-one", "lever-out", "lever-shift",
    ]);
  });

  it("てこのめもり 1〜6 と重さ 10〜100g の音声を参照する", () => {
    for (let pos = 1; pos <= 6; pos++) expect(NARRATION_SEGMENTS[`number-${pos}`]).toBeTruthy();
    for (let grams = 10; grams <= 100; grams += 10) expect(NARRATION_SEGMENTS[`weight-${grams}`]).toBeTruthy();
    expect(narrationForStep({ ...lever, params: { left: { pos: 6, g: 100 }, right: { pos: 1 } } }, 0))
      .toContain("weight-100");
  });

  it("月の各手順に読み上げ文がある", () => {
    const moon: ReadProblem = { templateId: "rika-moon", approved: false, questionText: "月の形", params: {} };
    expect([0, 1, 2].map((step) => narrationForStep(moon, step))).toEqual([
      ["moon-full"], ["moon-half"], ["moon-new"],
    ]);
  });

  it("確認前の言語の音声文は日本語に戻す", () => {
    expect(narrationSegmentsFor("en")).toEqual(NARRATION_SEGMENTS);
    expect(narrationSegmentsFor("pt-BR")).toEqual(NARRATION_SEGMENTS);
    expect(narrationSegmentsFor("vi")).toEqual(NARRATION_SEGMENTS);
  });
});
