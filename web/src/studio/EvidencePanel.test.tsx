import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidencePanel, type EvidenceVersion } from "./EvidencePanel";
import { STUDIO_MOCK_LESSON } from "./api";

describe("EvidencePanel", () => {
  it("marks mock and dummy origins, compares versions, and does not claim measured learning effects", () => {
    render(<EvidencePanel />);

    expect(screen.getAllByText("mock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ダミー").length).toBeGreaterThan(0);
    expect(screen.getAllByText("（見本）")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("比べる版"), { target: { value: "2" } });

    expect(screen.getByText("変更したところ" )).toBeTruthy();
    expect(screen.getByText("ヒント文" )).toBeTruthy();
    expect(screen.getByText("同じ大きさのタイルでうめられるか考えましょう" )).toBeTruthy();
    expect(screen.getByText("タイルを同じ大きさで並べましょう" )).toBeTruthy();
    expect(screen.getByText("未計測" )).toBeTruthy();
    expect(screen.queryByText(/学習効果/)).toBeNull();
  });

  it("shows saved model and duration, and leaves missing generation metadata unrecorded", () => {
    const version: EvidenceVersion = {
      id: "generated@v1", lessonId: "generated", number: 1, baseVersion: null,
      status: "review_required", transitions: ["draft", "validating", "review_required"],
      lesson: STUDIO_MOCK_LESSON, validation: { ok: true }, createdAt: "2026-11-09T00:00:00.000Z", isFixture: false,
      generation: { source: "gemini", model: "gemini-test-model", elapsedMs: 64 },
    };
    const unrecorded = { ...version, id: "generated@v2", number: 2, generation: undefined };
    render(<EvidencePanel versions={[version, unrecorded]} />);

    expect(screen.getByText("gemini-test-model / 64 ms")).toBeTruthy();
    expect(screen.getByText("Gemini")).toBeTruthy();
    expect(screen.getAllByText("未記録")).toHaveLength(2);
  });
});
