import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FractionIntro } from "./FractionIntro";

describe("分数の導入", () => {
  it("3Lを4人に分ける図を順に見て学習を終える", () => {
    const finish = vi.fn();
    render(<FractionIntro intro="division" title="わり算と分数" onExit={vi.fn()} onFinish={finish} />);
    expect(screen.getByText(/3 Lのジュース/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(screen.getByText(/1 Lを4等分/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(screen.getByText("3 ÷ 4 ＝ 3/4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "おわる" }));
    expect(finish).toHaveBeenCalledOnce();
  });
});
