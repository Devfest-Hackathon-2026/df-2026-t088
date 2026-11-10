import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GradeOneGuide } from "./GradeOneGuide";

describe("ずの せつめい", () => {
  afterEach(() => vi.restoreAllMocks());
  it("数の対応を順番に見て閉じる", () => {
    vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
    vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (this: HTMLDialogElement) { this.removeAttribute("open"); });
    render(<GradeOneGuide topic="compare" />);
    fireEvent.click(screen.getByRole("button", { name: "ずの うごきを みる" }));
    expect(screen.getByText("1こずつ ならべて みよう。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "つぎの ず" }));
    expect(screen.getByText("ひだりから 1こずつ ペアに しよう。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "とじる" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("こたえる前は答えの図を見せない", () => {
    vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
    render(<GradeOneGuide topic="tens-unit" />);
    fireEvent.click(screen.getByRole("button", { name: "ずの うごきを みる" }));
    fireEvent.click(screen.getByRole("button", { name: "つぎの ず" }));
    expect(screen.queryByText(/10、20、30/)).toBeNull();
  });
  it("あめを1こずつ交互に配り、最初からやり直せる", () => {
    vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
    render(<GradeOneGuide topic="groups" />);
    fireEvent.click(screen.getByRole("button", { name: "ずの うごきを みる" }));
    const button = screen.getByRole("button", { name: "1こ くばる" });
    for (let i = 0; i < 6; i++) fireEvent.click(button);
    expect(button).toHaveProperty("disabled", true);
    expect(screen.getByText(/ひとりめ/).querySelectorAll(".grade-guide__candy")).toHaveLength(3);
    expect(screen.getByText(/ふたりめ/).querySelectorAll(".grade-guide__candy")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
    expect(button).toHaveProperty("disabled", false);
  });
  it("時計の練習は1時から2時へ短い針と読み方が変わる", () => {
    vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
    render(<GradeOneGuide topic="clock" />);
    fireEvent.click(screen.getByRole("button", { name: "ずの うごきを みる" }));
    expect(screen.getByText("1じ")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "みじかい はりを うごかす" }));
    expect(screen.getByText("2じ")).toBeTruthy();
    expect(screen.queryByText("3じ")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
    expect(screen.getByText("1じ")).toBeTruthy();
  });
});
