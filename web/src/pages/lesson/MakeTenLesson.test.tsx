import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MakeTenLesson } from "./MakeTenLesson";

describe("10をつくるたし算", () => {
  it("あめをますへドラッグして移せる", () => {
    render(<MakeTenLesson onExit={vi.fn()} onFinish={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("ぜんぶで なんこに なりそう？"), { target: { value: "13" } });
    fireEvent.click(screen.getByRole("button", { name: "よそうして すすむ" }));
    const transfer = { setData: vi.fn(), getData: vi.fn(() => "candy") };
    fireEvent.dragStart(screen.getByRole("button", { name: "1こめの あめを ひだりへ うつす" }), { dataTransfer: transfer });
    expect(transfer.setData).toHaveBeenCalledWith("text/plain", "candy");
    fireEvent.drop(screen.getByLabelText("10この ます。はじめの8こと、うつした0こ"), { dataTransfer: transfer });
    expect(screen.getByText(/1こ うつしたよ/)).toBeTruthy();
  });
  it("予想、操作、式、入力、別の問題を順に進める", () => {
    const finish = vi.fn();
    render(<MakeTenLesson onExit={vi.fn()} onFinish={finish} />);
    expect(screen.queryByText(/＝ 13/)).toBeNull();
    fireEvent.change(screen.getByLabelText("ぜんぶで なんこに なりそう？"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "よそうして すすむ" }));
    fireEvent.click(screen.getByRole("button", { name: "1こめの あめを ひだりへ うつす" }));
    fireEvent.click(screen.getByRole("button", { name: "1こ もどす" }));
    fireEvent.click(screen.getByRole("button", { name: "1こめの あめを ひだりへ うつす" }));
    fireEvent.click(screen.getByRole("button", { name: "2こめの あめを ひだりへ うつす" }));
    expect(screen.getByText(/10この ますが いっぱい/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(screen.getByText(/8 ＋ 5 ＝ 8 ＋/)).toBeTruthy();
    expect(screen.queryByText(/＝ 13/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "こたえを 考える" }));
    fireEvent.change(screen.getByLabelText("こたえ"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "こたえる" }));
    expect(screen.getByRole("status").textContent).toContain("のこりの3こ");
    expect((screen.getByLabelText("こたえ") as HTMLInputElement).value).toBe("12");
    fireEvent.change(screen.getByLabelText("こたえ"), { target: { value: "１３" } });
    fireEvent.click(screen.getByRole("button", { name: "こたえる" }));
    expect(screen.getByText(/＝ 13/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ちがう 数でも やってみる" }));
    fireEvent.change(screen.getByLabelText("こたえ"), { target: { value: "16" } });
    fireEvent.click(screen.getByRole("button", { name: "こたえる" }));
    fireEvent.click(screen.getByRole("button", { name: "ばんめんにもどる" }));
    expect(finish).toHaveBeenCalledOnce();
  });
});
