import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_KEY, loadAccount } from "../account";
import { App } from "../App";
import { COPY } from "../copy";
import { displayText } from "../ruby-text";

// CMP-027 デバッグの学年（開発中だけ）。App 経由で、lazy の読み込みを待って確かめる
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const toggle = () => screen.findByRole("button", { name: /切り.える/ });
const radios = () => screen.getAllByRole("radio");
const checked = () => radios().filter((radio) => radio.getAttribute("aria-checked") === "true");

describe("CMP-027 デバッグの学年", () => {
  it("DEV が false の時は出ない", async () => {
    vi.stubEnv("DEV", false);
    render(<App />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: /切り.える/ })).toBeNull();
  });

  it("DEV が true の時は、たたんだ {n}年 のボタンが出る。読み上げは CP-783", async () => {
    vi.stubEnv("DEV", true);
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 3 }));
    render(<App />);
    const button = await toggle();
    expect(button.textContent).toBe("3年");
    expect(button.getAttribute("aria-label")).toBe(displayText(COPY.CP_783(3), 3));
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("開くと、名前が「学年」の radiogroup に1〜6年生が並び、今の学年だけ aria-checked（初めは6年）", async () => {
    vi.stubEnv("DEV", true);
    render(<App />);
    fireEvent.click(await toggle());
    expect(screen.getByRole("radiogroup", { name: "学年" })).toBeTruthy();
    expect(radios().map((radio) => radio.textContent)).toEqual(["1年生", "2年生", "3年生", "4年生", "5年生", "6年生"]);
    expect(checked().map((radio) => radio.textContent)).toEqual(["6年生"]);
    // 太字も付く。色だけに頼らない
    expect(checked()[0]?.classList.contains("is-checked")).toBe(true);
  });

  it("学年を押すとすぐ切り替わり、アカウントの grade に残る。押しても閉じない", async () => {
    vi.stubEnv("DEV", true);
    render(<App />);
    const button = await toggle();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("radio", { name: "2年生" }));
    expect(checked().map((radio) => radio.textContent)).toEqual(["2年生"]);
    expect(loadAccount().grade).toBe(2);
    expect(screen.getByRole("radiogroup")).toBeTruthy();
    expect(button.textContent).toBe("2年");
    expect(button.getAttribute("aria-label")).toBe(displayText(COPY.CP_783(2), 2));
  });

  it("もう一度ボタンを押すか Esc で閉じる。開いているかは残さない", async () => {
    vi.stubEnv("DEV", true);
    render(<App />);
    const button = await toggle();
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(button);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(document.activeElement).toBe(button);
    // 開いたまま描き直しても、たたんだ状態から始まる
    fireEvent.click(button);
    cleanup();
    render(<App />);
    await toggle();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});
