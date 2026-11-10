import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchPage } from "./ResearchPage";

type Call = { method: string; path: string; search: string; body: Record<string, unknown> | undefined };
let calls: Call[] = [];
let effect: unknown;

const cell = (hintVersion: string, correct: number, same: number, other: number) => ({
  lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", hintVersion, count: correct + same + other, correct, same, other,
});

beforeEach(() => {
  calls = [];
  effect = { stage: "collecting", comparable: false, cells: [] };
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const [path = "", search = ""] = String(input).split("?");
    const call: Call = { method: init?.method ?? "GET", path, search, body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const json = path === "/api/health" ? { status: "ok" } : path === "/api/v1/themes/hint-effect" ? effect : path === "/api/v1/after-hints" ? { received: true } : { error: { code: "NOT_FOUND", message: "未設定" } };
    return new Response(JSON.stringify(json), { status: json && (json as { error?: unknown }).error ? 404 : path === "/api/v1/after-hints" ? 201 : 200, headers: { "content-type": "application/json" } });
  });
});
afterEach(() => vi.unstubAllGlobals());

const openTab = () => fireEvent.click(screen.getByRole("tab", { name: "研究テーマ" }));

describe("研究テーマのタブ", () => {
  it("最初は流れのタブで、切り替えると問いと測り方が出る。結果ではないと言う", async () => {
    render(<ResearchPage />);
    expect(screen.getByRole("tab", { name: "流れを動かす" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByText(/ヒントを替えたあと、次の答えは近づいたか/)).toBeNull();
    openTab();
    expect(await screen.findByRole("heading", { name: "ヒントを替えたあと、次の答えは近づいたか" })).toBeTruthy();
    expect(screen.getByText(/結果ではありません。ここにある記録はダミー/)).toBeTruthy();
    expect(screen.getByRole("tab", { name: "研究テーマ" }).getAttribute("aria-selected")).toBe("true");
  });

  it("進み具合を読み、いまの段を示す", async () => {
    effect = { stage: "proposal", comparable: false, cells: [] };
    render(<ResearchPage />);
    openTab();
    const current = await screen.findByText("直し方の案をつくれる");
    await waitFor(() => expect(current.getAttribute("aria-current")).toBe("step"));
    expect(calls.some((call) => call.path === "/api/v1/themes/hint-effect" && call.search === "role=teacher")).toBe(true);
  });

  it("5 件に届いた区画だけを表に出す。比べられるかも言う", async () => {
    effect = { stage: "comparing", comparable: true, cells: [cell("base", 1, 3, 1), cell("approved", 3, 1, 1)] };
    render(<ResearchPage />);
    openTab();
    expect(await screen.findByText("元のヒント")).toBeTruthy();
    expect(screen.getByText("承認したヒント")).toBeTruthy();
    expect(screen.getByText(/両方が 5 件以上あります。比べられます/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "前後の比べ" }).getAttribute("tabindex")).toBe("0");
  });

  it("区画が無いときは、そう言う", async () => {
    render(<ResearchPage />);
    openTab();
    expect(await screen.findByText("まだ、5 件に届いた区画がありません")).toBeTruthy();
    expect(screen.getByText(/まだ比べられません/)).toBeTruthy();
  });

  it("ダミーを入れるボタンは、ダミーの印で 5 件を送る", async () => {
    render(<ResearchPage />);
    openTab();
    fireEvent.click(await screen.findByRole("button", { name: /元のヒントのあとの 5 件を入れる/ }));
    await waitFor(() => expect(calls.filter((call) => call.path === "/api/v1/after-hints")).toHaveLength(5));
    const sent = calls.filter((call) => call.path === "/api/v1/after-hints").map((call) => call.body);
    expect(sent.every((body) => body?.source === "dummy" && body?.hintVersion === "base" && body?.pattern === "sum-both")).toBe(true);
    expect(sent.map((body) => body?.next)).toEqual(["correct", "same", "same", "same", "other"]);
    expect(screen.getByText(/測り方の例です。結果ではありません/)).toBeTruthy();
  });

  it("サーバーの失敗は、タブの中に出す", async () => {
    vi.stubGlobal("fetch", async (input: string) =>
      String(input).includes("health")
        ? new Response(JSON.stringify({ status: "ok" }), { status: 200 })
        : new Response(JSON.stringify({ error: { code: "ADULT_INVALID_REQUEST", message: "読めませんでした" } }), { status: 400 }));
    render(<ResearchPage />);
    openTab();
    expect((await screen.findByRole("alert")).textContent).toBe("読めませんでした");
  });
});
