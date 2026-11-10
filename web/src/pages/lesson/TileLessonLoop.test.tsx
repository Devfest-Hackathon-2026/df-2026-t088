import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import { MIDWAY_STATE } from "../../game/test-state";
import { LOGIN_KEY } from "../../login";
import { saveGrade5ForTest } from "../../test-grade";

// 輪の最後。承認されたヒントが、本物の学習の画面の子どもに届く（デモの設定のときだけ）
const STORAGE_KEY = "sugoroku-home-v2";
const APPROVED = "分母がちがうときは、分母どうしをたさないよ。まず同じ大きさのタイルにそろえよう";
const ORIGINAL_FIRST_HINT = "どちらも同じ大きさのタイルでうめられるか、ためしてみましょう";

type Call = { method: string; url: string };
let calls: Call[] = [];
let approvedItems: unknown[] = [];

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

function openMain6() {
  localStorage.setItem(LOGIN_KEY, "Google");
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...MIDWAY_STATE, sansuSelected: true, introSeen: true,
    progress: { ...MIDWAY_STATE.progress, fraction: { done: 6, sides: [], test: false } },
  }));
  window.history.replaceState(null, "", "/sansu/fraction");
  render(<App />);
  press(/。今ここ$/);
}

function answer(text: string) {
  fireEvent.change(screen.getByLabelText(/^こたえ/), { target: { value: text } });
  press("こたえる");
}

// 読みに行った返事が画面の状態に入るまで待つ
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

const shownHints = () =>
  within(screen.getByRole("list", { name: "ヒント" })).getAllByRole("listitem").map((item) => item.textContent);

beforeEach(() => {
  calls = [];
  approvedItems = [{ pattern: "sum-both", replacesHintIndex: 0, hint: APPROVED }];
  localStorage.clear();
  saveGrade5ForTest();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubEnv("VITE_LOOP_SEND", "on");
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const call = { method: init?.method ?? "GET", url: String(input) };
    calls.push(call);
    if (call.method === "POST") return new Response("{}", { status: 201 });
    return new Response(JSON.stringify({ items: approvedItems }), { status: 200, headers: { "content-type": "application/json" } });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("承認されたヒントが子どもに届く", () => {
  it("型が分かったあと、その型で承認されたヒントが、最初のヒントとして出る", async () => {
    openMain6();
    answer("2/7");
    await waitFor(() => expect(calls.some((call) => call.method === "GET")).toBe(true));
    await flush();
    const get = new URL(calls.find((call) => call.method === "GET")?.url ?? "", "http://x");
    expect(Object.fromEntries(get.searchParams)).toEqual({ lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both" });
    press("分かんない");
    press("次のヒント");
    expect(shownHints()).toEqual([APPROVED]);
  });

  it("承認されたものが無いときは、いつものヒントのまま", async () => {
    approvedItems = [];
    openMain6();
    answer("2/7");
    await waitFor(() => expect(calls.some((call) => call.method === "GET")).toBe(true));
    await flush();
    press("分かんない");
    press("次のヒント");
    expect(shownHints()).toEqual([ORIGINAL_FIRST_HINT]);
  });

  it("分類できなかった間違いでは、読みに行かず、いつものヒントのまま", async () => {
    openMain6();
    answer("1/5");
    await flush();
    expect(calls.filter((call) => call.method === "GET")).toHaveLength(0);
    press("分かんない");
    press("次のヒント");
    expect(shownHints()).toEqual([ORIGINAL_FIRST_HINT]);
  });

  it("設定が無ければ、何も送らず、何も読まない", async () => {
    vi.stubEnv("VITE_LOOP_SEND", "");
    openMain6();
    answer("2/7");
    await flush();
    expect(calls).toHaveLength(0);
    press("分かんない");
    press("次のヒント");
    expect(shownHints()).toEqual([ORIGINAL_FIRST_HINT]);
  });

  it("数字を含む文が返っても、子どもには出さない", async () => {
    approvedItems = [{ pattern: "sum-both", replacesHintIndex: 0, hint: "答えは 7/12 です" }];
    openMain6();
    answer("2/7");
    await waitFor(() => expect(calls.some((call) => call.method === "GET")).toBe(true));
    await flush();
    press("分かんない");
    press("次のヒント");
    expect(shownHints()).toEqual([ORIGINAL_FIRST_HINT]);
  });
});
