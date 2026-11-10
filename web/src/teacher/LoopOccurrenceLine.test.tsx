import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoopOccurrenceLine } from "./LoopOccurrenceLine";
import { LOOP_OCCURRENCE_COPY } from "./copy";

describe("LoopOccurrenceLine（承認の前と後の件数）", () => {
  it("両方そろっているときは、前と後の件数を 1 行で出す", () => {
    render(<LoopOccurrenceLine stumbles={{ before: { count: 7 }, after: { count: 5 } }} />);
    expect(screen.getByText("承認の前 7 件 → 後 5 件")).toBeTruthy();
  });

  it("後が増えても減っても、評価の言葉は出さない", () => {
    for (const [before, after] of [[9, 5], [5, 9]] as const) {
      const { container, unmount } = render(<LoopOccurrenceLine stumbles={{ before: { count: before }, after: { count: after } }} />);
      expect(container.textContent).toBe(LOOP_OCCURRENCE_COPY.counts(before, after));
      expect(container.textContent).not.toMatch(/良く|悪く|効い|減っ|増え|改善|↑|↓|▲|▼/);
      unmount();
    }
  });

  it("どちらかが少ないときは、数字の代わりに「まだ少ない」と出す", () => {
    const { container } = render(<LoopOccurrenceLine stumbles={{ before: { count: 8 }, after: { count: null } }} />);
    expect(container.textContent).toBe(LOOP_OCCURRENCE_COPY.fewYet);
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("承認前の案（stumbles が無い）では何も出さない", () => {
    const { container } = render(<LoopOccurrenceLine stumbles={undefined} />);
    expect(container.innerHTML).toBe("");
  });
});
