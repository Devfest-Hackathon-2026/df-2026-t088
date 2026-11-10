import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Loading = typeof import("./loading");

const DELAY = 300;
const MIN = 500;
const NORMAL = 180;

let mod: Loading;
let el: HTMLElement;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  document.body.innerHTML = '<div id="loading" role="status"></div>';
  el = document.getElementById("loading")!;
  mod = await import("./loading");
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

const leaving = () => el.classList.contains("is-leaving");

describe("loading", () => {
  it("300ms 未満で全部外れると、is-leaving を経ずに hidden になる", () => {
    vi.advanceTimersByTime(DELAY - 100);
    mod.releaseBoot();
    vi.advanceTimersByTime(0);
    expect(el.hidden).toBe(true);
    expect(leaving()).toBe(false);
  });

  it("見えた後に外れると、見え始めから 500ms 経つまで消えず、その後 is-leaving、180ms で hidden", () => {
    vi.advanceTimersByTime(DELAY + 50);
    mod.releaseBoot();
    vi.advanceTimersByTime(DELAY + MIN - (DELAY + 50) - 1);
    expect(el.hidden).toBe(false);
    expect(leaving()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(el.hidden).toBe(false);
    expect(leaving()).toBe(true);
    vi.advanceTimersByTime(NORMAL - 1);
    expect(el.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(el.hidden).toBe(true);
    expect(leaving()).toBe(false);
  });

  it("外れた直後（タイマーが走る前）に hold すると何も変わらない", () => {
    vi.advanceTimersByTime(100);
    mod.releaseBoot();
    mod.holdLoading();
    vi.advanceTimersByTime(5000);
    expect(el.hidden).toBe(false);
    expect(leaving()).toBe(false);
    mod.releaseLoading();
    vi.advanceTimersByTime(5000);
    expect(el.hidden).toBe(true);
  });

  it("出ている間に hold を重ねても要素に触らない。起動から引き継ぐ時も同じ", () => {
    vi.advanceTimersByTime(DELAY + 10);
    const spy = vi.spyOn(el.classList, "remove");
    mod.holdLoading();
    mod.releaseBoot();
    mod.holdLoading();
    vi.advanceTimersByTime(5000);
    expect(spy).not.toHaveBeenCalled();
    expect(el.hidden).toBe(false);
    expect(leaving()).toBe(false);
  });

  it("hidden の後に hold すると再び出る", () => {
    mod.releaseBoot();
    vi.advanceTimersByTime(10);
    expect(el.hidden).toBe(true);
    mod.holdLoading();
    expect(el.hidden).toBe(false);
    expect(leaving()).toBe(false);
  });

  it("消えている途中（is-leaving）に hold すると戻る", () => {
    vi.advanceTimersByTime(DELAY);
    mod.releaseBoot();
    vi.advanceTimersByTime(MIN + 10);
    expect(leaving()).toBe(true);
    mod.holdLoading();
    vi.advanceTimersByTime(5000);
    expect(el.hidden).toBe(false);
    expect(leaving()).toBe(false);
  });

  it("releaseBoot を2回呼んでも数が2減らない", () => {
    mod.holdLoading();
    mod.releaseBoot();
    mod.releaseBoot();
    vi.advanceTimersByTime(5000);
    expect(el.hidden).toBe(false);
  });

  it("#loading が無くても例外を出さない", () => {
    el.remove();
    expect(() => {
      mod.holdLoading();
      mod.releaseLoading();
      mod.releaseBoot();
      vi.advanceTimersByTime(5000);
    }).not.toThrow();
  });
});
