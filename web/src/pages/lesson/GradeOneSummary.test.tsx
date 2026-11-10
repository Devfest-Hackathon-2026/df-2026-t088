import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GradeOneTopic } from "../../lesson/grade-one";
import { GradeOneLesson } from "./GradeOneLesson";

const answers: [GradeOneTopic, string][] = [
  ["compare", "みかん"], ["count", "6"], ["order", "8"], ["compose", "3"],
  ["tens", "17"], ["hundred", "110"], ["tens-unit", "40"], ["groups", "4"], ["compare-groups", "36"],
  ["addition", "7"], ["subtraction", "5"], ["carry", "13"], ["two-digit", "27"], ["borrow", "8"],
  ["shape", "はこ"], ["shape-build", "4"], ["position", "ねこ"], ["shape-parts", "たて"],
  ["length", "あお"], ["measure", "3"], ["volume", "B"], ["clock", "8"], ["daily-time", "3"], ["chart", "みかん"], ["chart-read", "2"],
];

describe("1年生の章のまとめ", () => {
  afterEach(cleanup);
  it.each(answers)("%s は異なる答えを受け付けず、正しい答えで進める", (topic, answer) => {
    const finish = vi.fn();
    render(<GradeOneLesson topic={topic} topics={[topic]} onExit={vi.fn()} onFinish={finish} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "まちがい" } });
    fireEvent.click(screen.getByRole("button", { name: "こたえる" }));
    expect(screen.getByText("もういちど えを みてみよう。")).toBeTruthy();
    fireEvent.change(input, { target: { value: answer } });
    fireEvent.click(screen.getByRole("button", { name: "こたえる" }));
    fireEvent.click(screen.getByRole("button", { name: "ばんめんにもどる" }));
    expect(finish).toHaveBeenCalledOnce();
  });
  it("練習問題の答えをまとめ問題で正解にしない", () => {
    render(<GradeOneLesson topic="addition" topics={["addition"]} onExit={vi.fn()} onFinish={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "3+2=5" } });
    fireEvent.click(screen.getByRole("button", { name: "こたえる" }));
    expect(screen.getByText("もういちど えを みてみよう。")).toBeTruthy();
  });
});
