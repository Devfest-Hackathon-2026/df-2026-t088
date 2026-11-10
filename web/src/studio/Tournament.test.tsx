import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STUDIO_FIXTURES } from "./api";
import type { StudioLesson } from "./lesson-ir";
import { Tournament, type TournamentAlternative } from "./Tournament";

const invalidMathLesson = STUDIO_FIXTURES.invalidMath as StudioLesson;

const alternatives: [TournamentAlternative, TournamentAlternative, TournamentAlternative] = [
  { strategy: "visual", lesson: { ...STUDIO_FIXTURES.valid, strategy: "visual" }, validation: { ok: true }, checks: { structure: true, arithmetic: true, answerLeak: true, hintWording: true }, elapsedMs: 14, source: "mock", model: "mock" },
  { strategy: "numeric", lesson: invalidMathLesson, validation: { ok: false, issues: ["問題1のひき算の答えは0より大きくしてください。"] }, checks: { structure: true, arithmetic: false, answerLeak: true, hintWording: true }, elapsedMs: 21, source: "mock", model: "mock" },
  { strategy: "misconception", lesson: { ...STUDIO_FIXTURES.valid, strategy: "misconception" }, validation: { ok: true }, checks: { structure: true, arithmetic: true, answerLeak: true, hintWording: true }, elapsedMs: 18, source: "mock", model: "mock" },
];

describe("Tournament", () => {
  it("3案をプレビューし、自動検査・先生の評価・未計測を分けて表示する", () => {
    render(<Tournament alternatives={alternatives} onSelect={vi.fn()} />);

    expect(screen.getAllByText("見本データのプレビュー")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "自動の検査" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "先生の評価" })).toBeTruthy();
    expect(screen.getByText("学習の効果：未計測")).toBeTruthy();
    expect(screen.getByText("AIの自己評価は使っていません。" )).toBeTruthy();
    expect(within(screen.getByRole("table", { name: "3案の比較" })).getByText("答えの漏れ")).toBeTruthy();
    expect(screen.getByText("mock（本物の Gemini ではない）")).toBeTruthy();
  });

  it("検査に落ちた案は選べず、通った案を選んだときだけ結果を渡す", () => {
    const onSelect = vi.fn();
    render(<Tournament alternatives={alternatives} onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: "検査に落ちたため選べません" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "見える形で考える案を選ぶ" }));
    expect(onSelect).toHaveBeenCalledWith(alternatives[0]);
  });
});
