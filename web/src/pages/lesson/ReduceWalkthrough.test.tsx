import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReduceWalkthrough } from "./ReduceWalkthrough";

describe("約分の説明", () => {
  it("子どもが選んだときに別の例を段階的に示す", () => {
    render(<ReduceWalkthrough />);
    expect(screen.queryByText(/ピザ1枚を4つに分けた/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "約分の説明を見る" }));
    expect(screen.getByRole("img", { name: /4等分し、2切れ/ })).toBeTruthy();
    expect(screen.queryByText("2/4 ＝ 1/2")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(screen.getByRole("img", { name: /2切れずつをまとめ/ })).toBeTruthy();
    expect(screen.queryByText("2/4 ＝ 1/2")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(screen.getByText("2/4 ＝ 1/2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(screen.getByText(/分子：2 ÷ 2 ＝ 1/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "もどる" }));
    expect(screen.queryByText(/分子：2 ÷ 2 ＝ 1/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "約分の説明をとじる" }));
    expect(screen.queryByText("2/4 ＝ 1/2")).toBeNull();
  });
});
