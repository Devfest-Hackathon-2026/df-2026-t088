import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

let shouldThrow = true;

function Fragile() {
  if (shouldThrow) throw new Error("わざと出した描画のエラー");
  return <p>もとの画面</p>;
}

describe("CMP-019 立て直しの画面", () => {
  beforeEach(() => {
    shouldThrow = true;
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("描画でエラーが出ると、立て直しの画面を出し、エラーの中身は画面に出さずコンソールに残す", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorBoundary><Fragile /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "画面がうまく出ませんでした" })).toBe(document.activeElement);
    expect(screen.getByText("これまでの進みは消えていません。下のボタンをおすと、もとの画面にもどります")).toBeTruthy();
    expect(document.body.textContent).not.toContain("わざと出した描画のエラー");
    expect(consoleError.mock.calls.some((call) => call.includes("画面の描画でエラーが出たため、立て直しの画面を出しました"))).toBe(true);
  });

  it("「もう一度はじめる」で、保存した進みを消さずに、もとの画面へ戻る", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("sugoroku-progress", "残しておく進み");
    render(<ErrorBoundary><Fragile /></ErrorBoundary>);
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "もう一度はじめる" }));
    expect(screen.getByText("もとの画面")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(localStorage.getItem("sugoroku-progress")).toBe("残しておく進み");
  });

  it("描き直してもまたエラーが出たら、もう一度立て直しの画面を出す", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorBoundary><Fragile /></ErrorBoundary>);
    fireEvent.click(screen.getByRole("button", { name: "もう一度はじめる" }));
    expect(screen.getByRole("button", { name: "もう一度はじめる" })).toBeTruthy();
  });
});
