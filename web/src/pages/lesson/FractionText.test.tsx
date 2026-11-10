import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createEquivalentProblem } from "../../lesson/tiles";
import { EquivalentEquation } from "./FractionText";

describe("同じ大きさの分数の式", () => {
  const problem = createEquivalentProblem({ num: 1, den: 2 }, 4);

  it("正解の前は □ のある式、正解の後は答えの分数が入る", () => {
    const { container, rerender } = render(<EquivalentEquation problem={problem} />);
    expect(screen.getByRole("img", { name: /□/ })).toBeTruthy();
    expect(container.textContent).toContain("□");
    expect(container.textContent).toContain("=");
    rerender(<EquivalentEquation problem={problem} answer={problem.answer} />);
    expect(container.textContent).not.toContain("□");
    expect(container.textContent).toContain("24");
  });

  it("式にもどった時は □ の入力欄を出す", () => {
    render(<EquivalentEquation problem={problem} slots={{ left: { num: 2, den: 4 }, right: { num: 0, den: 4 }, texts: ["", ""], onChange: () => () => undefined }} />);
    expect(screen.getByPlaceholderText("□")).toBeTruthy();
  });
});
