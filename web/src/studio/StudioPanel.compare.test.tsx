import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STUDIO_MOCK_LESSON } from "./api";
import { StudioPanel } from "./StudioPanel";
import type { StudioApi } from "./StudioPanel";

const passed = { structure: true, arithmetic: true, answerLeak: true, hintWording: true };

describe("StudioPanel の 3 案の比較と根拠", () => {
  it("3 つの教え方を作り、検査に通った案を選ぶと承認待ちの版 1 になり、根拠と出どころが出る", async () => {
    const adopt = vi.fn(async (lesson: typeof STUDIO_MOCK_LESSON) => ({
      draftId: "studio-1", lessonId: "studio-1", lesson, validation: { ok: true } as const, version: 1, mode: "mock" as const,
    }));
    const api: StudioApi = {
      generate: async () => { throw new Error("使わない"); },
      decide: async () => ({ status: "approved", version: 1, mode: "mock" }),
      revoke: async () => ({ status: "revoked", version: 1, mode: "mock" }),
      tournament: async () => ({
        alternatives: [
          { strategy: "visual", lesson: { ...STUDIO_MOCK_LESSON, strategy: "visual" }, validation: { ok: true }, checks: passed, elapsedMs: 1, source: "mock", model: "mock" },
          { strategy: "numeric", lesson: { ...STUDIO_MOCK_LESSON, strategy: "numeric" }, validation: { ok: true }, checks: passed, elapsedMs: 1, source: "mock", model: "mock" },
          { strategy: "misconception", validation: { ok: false, issues: ["問題1のひき算の答えは0より大きくしてください。"] }, checks: { ...passed, arithmetic: false }, elapsedMs: 1, source: "mock", model: "mock" },
        ],
      }),
      adopt,
    };
    render(<StudioPanel api={api} />);
    fireEvent.change(screen.getByLabelText("先生が一文で書く"), { target: { value: "分母をそろえる教材を作る" } });
    fireEvent.click(screen.getByRole("button", { name: "3 つの教え方を作って比べる" }));

    expect(await screen.findByText(/3 つの教え方を作りました/)).toBeTruthy();
    expect(screen.getByText("学習の効果：未計測")).toBeTruthy();
    expect((screen.getByRole("button", { name: "検査に落ちたため選べません" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "数で考える案を選ぶ" }));
    expect(await screen.findByText(/選んだ案を版 1 として置きました/)).toBeTruthy();
    expect(adopt).toHaveBeenCalledWith(expect.objectContaining({ strategy: "numeric" }), "mock");
    expect(screen.getByText("現在の版：版 1")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "根拠と出どころ" })).toBeTruthy();
  });
});
