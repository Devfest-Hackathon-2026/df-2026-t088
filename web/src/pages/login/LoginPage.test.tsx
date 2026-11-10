import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COPY } from "../../copy";
import { LOGIN_KEY } from "../../login";
import { displayText } from "../../ruby-text";
import { LoginPage } from "./LoginPage";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

const shown = (text: string) => displayText(text, 5);

describe("LoginPage（PG-009）", () => {
  it("見出し・案内・2つのログインのボタンを出す。先生の画面へ（CP-788）は出さない（D-153）", () => {
    render(<LoginPage onLoggedIn={() => {}} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(COPY.CP_780);
    expect(screen.getByText(shown(COPY.CP_785))).toBeTruthy();
    expect(screen.getByRole("button", { name: COPY.CP_786 })).toBeTruthy();
    expect(screen.getByRole("button", { name: COPY.CP_787 })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /先生|せんせい/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /先生|せんせい/ })).toBeNull();
  });

  it("開いた時はどのボタンにも focus を置かない（D-153）。ロゴは読み上げない", () => {
    const { container } = render(<LoginPage onLoggedIn={() => {}} />);
    expect(document.activeElement).toBe(document.body);
    expect(container.querySelectorAll(".login__provider svg[aria-hidden='true']").length).toBe(2);
  });

  it("Google を押すと Google でログインして onLoggedIn を呼ぶ", () => {
    const onLoggedIn = vi.fn();
    render(<LoginPage onLoggedIn={onLoggedIn} />);
    fireEvent.click(screen.getByRole("button", { name: COPY.CP_786 }));
    expect(localStorage.getItem(LOGIN_KEY)).toBe("Google");
    expect(onLoggedIn).toHaveBeenCalledTimes(1);
  });

  it("Microsoft を押すと Microsoft でログインする", () => {
    const onLoggedIn = vi.fn();
    render(<LoginPage onLoggedIn={onLoggedIn} />);
    fireEvent.click(screen.getByRole("button", { name: COPY.CP_787 }));
    expect(localStorage.getItem(LOGIN_KEY)).toBe("Microsoft");
    expect(onLoggedIn).toHaveBeenCalledTimes(1);
  });

  it("ログインに失敗すると CP-792 を role=status で出し、ボタンは押せる", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    const onLoggedIn = vi.fn();
    render(<LoginPage onLoggedIn={onLoggedIn} />);
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: COPY.CP_786 }));
    expect(screen.getByRole("status").textContent).toBe(shown(COPY.CP_792));
    expect(onLoggedIn).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: COPY.CP_786 })).toBeTruthy();
    expect(screen.getByRole("button", { name: COPY.CP_787 })).toBeTruthy();
  });

  it("先生に登録されていない状態：2つのボタンの代わりに案内（role=status）とメールと戻るボタン。focus は置かず、戻るボタンを押すと2つのボタンに戻る", () => {
    render(<LoginPage onLoggedIn={() => {}} unregisteredEmail="a@example.ed.jp" />);
    expect(screen.getByRole("status").textContent).toBe(shown(COPY.CP_789));
    expect(screen.getByText("a@example.ed.jp")).toBeTruthy();
    expect(screen.queryByRole("button", { name: COPY.CP_786 })).toBeNull();
    const back = screen.getByRole("button", { name: COPY.CP_791 });
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(back);
    expect(screen.getByRole("button", { name: COPY.CP_786 })).toBeTruthy();
    expect(screen.getByRole("button", { name: COPY.CP_787 })).toBeTruthy();
    expect(screen.queryByText("a@example.ed.jp")).toBeNull();
  });
});
