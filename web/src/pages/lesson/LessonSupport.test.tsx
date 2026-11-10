import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import { MIDWAY_STATE } from "../../game/test-state";
import { LOGIN_KEY } from "../../login";
import { saveGrade5ForTest } from "../../test-grade";
import type { GameState } from "../../data";
import { IDLE_NUDGE_MS } from "./use-idle-nudge";

// 学習の補助：まちがえた答えの図（CMP-020）と、手が止まった時の声かけ（CMP-021、D-124）
const STORAGE_KEY = "sugoroku-home-v2";

const openState = (done: number): GameState => ({
  ...MIDWAY_STATE,
  sansuSelected: true,
  introSeen: true,
  progress: { ...MIDWAY_STATE.progress, fraction: { done, sides: [], test: false } },
});

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

function renderBoard(state: GameState) {
  localStorage.setItem(LOGIN_KEY, "Google");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.history.replaceState(null, "", "/sansu/fraction");
  render(<App />);
}

/** 今のマス（1/4 + 1/3 の式から答える学習）を開く */
function openNow() {
  renderBoard(openState(6));
  press(/。今ここ$/);
}

/** タイルで解く寄り道（1/2 + 1/3。はじめからタイルが開く）を開く */
function openTilesLesson() {
  renderBoard(openState(3));
  press(/タイルでたし算。/);
  press("学習をはじめる");
}

function answer(text: string) {
  fireEvent.change(screen.getByLabelText(/^こたえ/), { target: { value: text } });
  press("こたえる");
}

const compare = () => screen.queryByRole("group", { name: "図でくらべる" });
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  localStorage.clear();
  saveGrade5ForTest();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("まちがえた答えの図", () => {
  it("小さい答えは、問題の式とあなたのこたえを並べ、たりないと言う", () => {
    openNow();
    answer("2/5");
    const group = compare();
    expect(group).not.toBeNull();
    const view = within(group as HTMLElement);
    expect(view.getByText("もんだい")).toBeTruthy();
    expect(view.getByText("あなたのこたえ")).toBeTruthy();
    expect(view.getByRole("img", { name: "4分の1" })).toBeTruthy();
    expect(view.getByRole("img", { name: "5分の2" })).toBeTruthy();
    expect(view.getByText("点線のところだけ、たりないみたいです")).toBeTruthy();
  });

  it("答えの値（7/12）は図に書かない", () => {
    openNow();
    answer("2/5");
    const view = within(compare() as HTMLElement);
    expect(view.queryByRole("img", { name: "12分の7" })).toBeNull();
    expect(compare()?.textContent).not.toContain("12");
  });

  it("大きい答えは多いと言い、大きすぎる答えは先まで続くと書く", () => {
    openNow();
    answer("1");
    expect(within(compare() as HTMLElement).getByText("点線のところだけ、多いみたいです")).toBeTruthy();
    answer("99/2");
    expect(compare()?.textContent).toContain("もっと先までつづきます");
    expect(document.querySelector(".lesson-compare-bar.is-clipped")).not.toBeNull();
  });

  it("読めない答えと正解では図を出さない", () => {
    openNow();
    answer("わからない");
    expect(compare()).toBeNull();
    answer("7/12");
    expect(compare()).toBeNull();
  });
});

describe("手が止まった時の声かけ", () => {
  it("しばらく何もしないと、「分かんない」を押すよう声をかけ、ボタンを光らせる。ヒントは出さない", () => {
    vi.useFakeTimers();
    openNow();
    wait(IDLE_NUDGE_MS - 1);
    expect(screen.queryByText("こまったら、「分かんない」をおしてみましょう")).toBeNull();
    wait(1);
    expect(screen.getByText("こまったら、「分かんない」をおしてみましょう")).toBeTruthy();
    expect(screen.getByRole("button", { name: "分かんない" }).classList.contains("is-nudged")).toBe(true);
    expect(screen.queryByRole("list", { name: "ヒント" })).toBeNull();
  });

  it("操作すると消え、同じ問題では2度言わない", () => {
    vi.useFakeTimers();
    openNow();
    wait(IDLE_NUDGE_MS);
    fireEvent.keyDown(screen.getByLabelText(/^こたえ/), { key: "1" });
    expect(screen.queryByText(/^こまったら/)).toBeNull();
    expect(screen.getByRole("button", { name: "分かんない" }).classList.contains("is-nudged")).toBe(false);
    wait(IDLE_NUDGE_MS * 2);
    expect(screen.queryByText(/^こまったら/)).toBeNull();
  });

  it("操作している間は数え直すので、声をかけない", () => {
    vi.useFakeTimers();
    openNow();
    wait(IDLE_NUDGE_MS - 1000);
    fireEvent.pointerDown(screen.getByLabelText(/^こたえ/));
    wait(IDLE_NUDGE_MS - 1000);
    expect(screen.queryByText(/^こまったら/)).toBeNull();
    wait(1000);
    expect(screen.getByText(/^こまったら/)).toBeTruthy();
  });

  it("次の問題では、また声をかけられる", () => {
    vi.useFakeTimers();
    openNow();
    wait(IDLE_NUDGE_MS);
    answer("7/12");
    expect(screen.queryByText(/^こまったら/)).toBeNull();
    press("つぎの問題へ");
    wait(IDLE_NUDGE_MS);
    expect(screen.getByText("こまったら、「分かんない」をおしてみましょう")).toBeTruthy();
  });

  it("正解した後は声をかけない", () => {
    vi.useFakeTimers();
    openNow();
    answer("7/12");
    wait(IDLE_NUDGE_MS * 2);
    expect(screen.queryByText(/^こまったら/)).toBeNull();
  });

  it("タイルの画面では「次のヒント」を光らせる", () => {
    vi.useFakeTimers();
    openTilesLesson();
    wait(IDLE_NUDGE_MS);
    expect(screen.getByText("こまったら、「次のヒント」をおしてみましょう")).toBeTruthy();
    expect(screen.getByRole("button", { name: "次のヒント" }).classList.contains("is-nudged")).toBe(true);
  });
});

describe("2列の配置（D-127）", () => {
  it("タイルを開くと、案内とヒントは問題のカード側にあり、タイルのカード側には無い", () => {
    openTilesLesson();
    press(/ヒント/);
    const problem = screen.getByRole("region", { name: "もんだい" });
    const work = screen.getByRole("region", { name: /タイルで/ });
    expect(problem.querySelector(".lesson-guide")).not.toBeNull();
    expect(problem.querySelector(".lesson-hints")).not.toBeNull();
    expect(work.querySelector(".lesson-guide")).toBeNull();
    expect(work.querySelector(".lesson-hints")).toBeNull();
    expect(document.querySelector(".lesson")?.classList.contains("is-split")).toBe(true);
  });

  it("タイルを開いていない間は、2列にしない", () => {
    openNow();
    expect(document.querySelector(".lesson")?.classList.contains("is-split")).toBe(false);
  });
});
