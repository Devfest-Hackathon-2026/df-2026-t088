import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommonDenominatorGuide } from "./CommonDenominatorGuide";

describe("分母を考えて図を見る", () => {
  it("両方の倍数を自分で入力してから、その数に分けた図を表示する", () => {
    render(<CommonDenominatorGuide left={{ num: 2, den: 3 }} right={{ num: 1, den: 4 }} />);
    fireEvent.click(screen.getByRole("button", { name: "分母を考えて図を見る" }));
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("そろえる分母"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "たしかめる" }));
    expect(screen.getByRole("status").textContent).toContain("両方で割り切れる");
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("そろえる分母"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "たしかめる" }));
    const bars = screen.getAllByRole("img");
    expect(bars.map((bar) => bar.children.length)).toEqual([12, 12]);
    expect(bars.map((bar) => bar.querySelectorAll(".is-filled").length)).toEqual([8, 3]);
    fireEvent.change(screen.getByLabelText("そろえる分母"), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "たしかめる" }));
    expect(screen.getAllByRole("img").map((bar) => bar.children.length)).toEqual([24, 24]);
  });
  it("1を超える分数は帯を複数本使い、量を欠けさせない", () => {
    render(<CommonDenominatorGuide left={{ num: 3, den: 2 }} right={{ num: 1, den: 4 }} />);
    fireEvent.click(screen.getByRole("button", { name: "分母を考えて図を見る" }));
    fireEvent.change(screen.getByLabelText("そろえる分母"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "たしかめる" }));
    expect(screen.getAllByRole("img").map((bar) => bar.querySelectorAll(".is-filled").length)).toEqual([4, 2, 1]);
  });
});
