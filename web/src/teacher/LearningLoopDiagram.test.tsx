import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, call } from "../research/api";
import { LearningLoopDiagram } from "./LearningLoopDiagram";
import { PATTERN_LABEL } from "./copy";
import { setApproverKey } from "./approver-key";
import { TeacherSessionContext } from "./workspace";

vi.mock("../research/api", () => ({
  call: vi.fn(),
  ApiError: class ApiError extends Error { code: string; constructor(code: string, message: string) { super(message); this.code = code; } },
}));

const mockedCall = vi.mocked(call);
type TestEffect = { status: "undetermined" | "compared"; before: { count: number; correct: number | null }; after: { count: number; correct: number | null }; tryAlternatives: boolean; alternatives: unknown[] };
const none: TestEffect = { status: "undetermined", before: { count: 0, correct: null }, after: { count: 0, correct: null }, tryAlternatives: false, alternatives: [] };
const item = (pattern: string, count: number, status: string, effect: TestEffect = none) => ({
  chapterId: "fraction", lessonKey: "main-6", problem: "1/3+1/4", pattern, count, status, source: "dummy",
  suggestion: { id: `suggestion-${pattern}`, candidates: [{ number: 1, source: "table", hint: "同じ大きさにそろえて考えよう", passed: true }] }, effect,
});
const summary = (count: number) => ({ scope: "summary", items: count ? [{ chapterId: "fraction", lessonKey: "main-6", problem: "1/3+1/4", count, patterns: [] }] : [] });

function respond(items: unknown[], stumbles: number) {
  mockedCall.mockImplementation(async (_method, path) => (path === "/api/v1/loop/assistant" ? { items } : summary(stumbles)) as never);
}

describe("学びの輪の図", () => {
  beforeEach(() => mockedCall.mockReset());

  it("4 つの段を 1→4 の順に出し、型は日本語の名前で多い順に 2 つまで出す", async () => {
    respond([item("sum-both", 12, "pending"), item("sum-num-only", 9, "pending"), item("same-den-sum", 3, "pending")], 24);
    render(<LearningLoopDiagram />);
    const stages = await screen.findAllByRole("listitem");
    const titles = stages.map((stage) => stage.textContent ?? "").filter((text) => /^\d /.test(text));
    expect(titles.map((text) => text.slice(0, 1))).toEqual(["1", "2", "3", "4"]);
    expect(screen.getByText("24 件")).toBeTruthy();
    // 型の名前は、右のカードと同じ文（copy.ts の PATTERN_LABEL。#535）
    expect(screen.getByText(PATTERN_LABEL["sum-both"])).toBeTruthy();
    expect(screen.getByText(PATTERN_LABEL["sum-num-only"])).toBeTruthy();
    expect(screen.getByText("分子どうし、分母どうしを計算した形")).toBeTruthy();
    expect(screen.getByText("ほか 1 つ")).toBeTruthy();
    expect(screen.queryByText(/sum-both|sum-num-only/)).toBeNull();
    expect(screen.getByText("見本のデータ")).toBeTruthy();
  });

  it("選ぶのを待つ型があれば、いますることは直し方を選ぶこと", async () => {
    respond([item("sum-both", 12, "pending"), item("sum-num-only", 9, "pending")], 21);
    render(<LearningLoopDiagram />);
    expect(await screen.findByText("選ぶのを待つ型 2 つ")).toBeTruthy();
    expect(screen.getByText("直し方を 1 つ選ぶと、次に同じ間違いをした子に届きます")).toBeTruthy();
    expect(screen.getByRole("button", { name: "直し方を選ぶ" })).toBeTruthy();
  });

  it("選ぶ前と後が 5 件ずつそろうと、正答の割合を棒で比べる。そろわなければ比べない", async () => {
    respond([item("sum-num-only", 9, "approved", { ...none, status: "compared", before: { count: 5, correct: 0.4 }, after: { count: 5, correct: 0.8 } })], 9);
    const { unmount } = render(<LearningLoopDiagram />);
    expect(await screen.findByText("40%")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
    unmount();
    respond([item("sum-num-only", 9, "approved", { ...none, before: { count: 5, correct: 0.4 }, after: { count: 2, correct: 1 } })], 9);
    render(<LearningLoopDiagram />);
    expect(await screen.findByText("選ぶ前と後が 5 件ずつそろうと比べます")).toBeTruthy();
    expect(screen.getByText("選んだ直し方を見た子の答えを待っています")).toBeTruthy();
  });

  it("記録が無いときは、見本で試すことをすすめる", async () => {
    respond([], 0);
    render(<LearningLoopDiagram />);
    expect(await screen.findByText("0 件")).toBeTruthy();
    expect(screen.getByRole("button", { name: "見本で試す" })).toBeTruthy();
  });

  it("画面の上で入れた承認キーで集計を読む", async () => {
    respond([], 0);
    setApproverKey("teacher-key");
    render(<LearningLoopDiagram />);
    await screen.findByText("0 件");
    expect(mockedCall).toHaveBeenCalledWith("GET", "/api/v1/loop/assistant", undefined, { "x-approver-key": "teacher-key" });
    setApproverKey("");
  });

  it("学級に入っているときは、承認キーを入れていても付けず、権限が無いときも承認キーを求めない", async () => {
    setApproverKey("stale-key");
    mockedCall.mockImplementation(async (_method, path) => {
      if (path === "/api/v1/loop/assistant") throw new ApiError("UNAUTHORIZED", "x");
      return summary(0) as never;
    });
    render(
      <TeacherSessionContext.Provider value={{ session: { workspace: { id: "w-1", name: "わたしの学級", joinCode: "AB23CD" } }, setWorkspace: () => {} }}>
        <LearningLoopDiagram />
      </TeacherSessionContext.Provider>,
    );
    expect(await screen.findByText("ログインが切れました。ページを開き直して、もう一度入ってください")).toBeTruthy();
    expect(screen.queryByText(/承認キー/)).toBeNull();
    expect(mockedCall).toHaveBeenCalledWith("GET", "/api/v1/loop/assistant", undefined, {});
    setApproverKey("");
  });

  it("「直し方を選ぶ」は、一覧の先頭の選ぶ欄へフォーカスを移す。無ければ見出しへ動かす", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    respond([item("sum-both", 12, "pending")], 12);
    render(<LearningLoopDiagram />);
    const button = await screen.findByRole("button", { name: "直し方を選ぶ" });
    const title = document.createElement("h2");
    title.id = "loop-assistant-title";
    document.body.appendChild(title);
    fireEvent.click(button);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    title.remove();

    const items = document.createElement("div");
    items.className = "loop-assistant__items";
    const select = document.createElement("select");
    items.appendChild(select);
    document.body.appendChild(items);
    fireEvent.click(button);
    expect(document.activeElement).toBe(select);
    items.remove();
  });
});
