import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MUTED_KEY, VOLUME_KEY } from "./audio/bgm";
import { LOGIN_KEY, MOCK_EMAIL, MOCK_NAME, currentAccount, isLoggedIn, logIn, logOut, useLoggedIn } from "./login";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("仮のログイン", () => {
  it("初めはログインしていない", () => {
    expect(isLoggedIn()).toBe(false);
    expect(currentAccount()).toBeNull();
  });

  it("logIn で会社だけを保存し、名前とメールは架空の値を返す", () => {
    expect(logIn("Microsoft")).toBe(true);
    expect(localStorage.getItem(LOGIN_KEY)).toBe("Microsoft");
    expect(isLoggedIn()).toBe(true);
    expect(currentAccount()).toEqual({ provider: "Microsoft", name: MOCK_NAME, email: MOCK_EMAIL });
    expect(localStorage.length).toBe(1);
  });

  it("壊れた値はログインしていない扱い", () => {
    localStorage.setItem(LOGIN_KEY, "Yahoo");
    expect(isLoggedIn()).toBe(false);
  });

  it("logOut で消す。保存できない・消せない時は false", () => {
    logIn("Google");
    expect(logOut()).toBe(true);
    expect(isLoggedIn()).toBe(false);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("x"); });
    expect(logIn("Google")).toBe(false);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("x"); });
    expect(logOut()).toBe(false);
  });

  it("logOut しても、BGM の大きさと消したかどうかは残す（D-203）", () => {
    logIn("Google");
    localStorage.setItem(VOLUME_KEY, "0.3");
    localStorage.setItem(MUTED_KEY, "1");
    expect(logOut()).toBe(true);
    expect(localStorage.getItem(VOLUME_KEY)).toBe("0.3");
    expect(localStorage.getItem(MUTED_KEY)).toBe("1");
  });

  it("useLoggedIn は logIn・logOut で変わる", () => {
    const { result } = renderHook(() => useLoggedIn());
    expect(result.current).toBe(false);
    act(() => { logIn("Google"); });
    expect(result.current).toBe(true);
    act(() => { logOut(); });
    expect(result.current).toBe(false);
  });
});
