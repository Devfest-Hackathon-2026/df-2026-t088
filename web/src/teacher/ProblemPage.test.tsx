import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProblemPage } from "./ProblemPage";
import { PATTERN_LABEL, PROBLEM_COPY, TODAY_COPY, UNIT_COPY } from "./copy";
import type { SummaryItem } from "../research/api";

type Call = { method: string; path: string; search: string; body: Record<string, unknown> | undefined };
type Reply = { status: number; json: unknown };

let calls: Call[] = [];
let routes: Record<string, (call: Call) => Reply> = {};

const ok = (json: unknown): Reply => ({ status: 200, json });

const item = (patterns: SummaryItem["patterns"], count = 9): SummaryItem => ({ chapterId: "fraction", lessonKey: "main-6", problem: "1/3+1/4", count, patterns });

beforeEach(() => {
  calls = [];
  routes = {};
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const [path = "", search = ""] = String(input).split("?");
    const call: Call = { method: init?.method ?? "GET", path, search, body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const key = `${call.method} ${path}`;
    const reply = routes[key]?.(call) ?? { status: 404, json: { error: { code: "NOT_FOUND", message: "未設定" } } };
    return new Response(JSON.stringify(reply.json), { status: reply.status, headers: { "content-type": "application/json" } });
  });
});

afterEach(() => vi.unstubAllGlobals());

const summaryWith = (items: SummaryItem[]) => {
  routes["POST /api/v1/stumbles/query"] = () => ok({ scope: "summary", items });
};
const approvedNone = () => {
  routes["GET /api/v1/approved-hints"] = () => ok({ items: [] });
};

describe("ProblemPage（SCR-T02 問題の詳細）", () => {
  it("型の内訳を名前つきで出し、分類できないものには作るボタンを出さない", async () => {
    summaryWith([item([{ pattern: "sum-both", count: 6 }, { pattern: "unclassified", count: 3 }])]);
    approvedNone();
    render(<ProblemPage lessonKey="main-6" problem="1/3+1/4" />);
    expect(await screen.findByText(`${PATTERN_LABEL["sum-both"]}：6 ${TODAY_COPY.count}`)).toBeTruthy();
    expect(screen.getByText(`${PATTERN_LABEL.unclassified}：3 ${TODAY_COPY.count}`)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: PROBLEM_COPY.makeSuggestion }).length).toBe(1);
  });

  it("もどるの行の右端に承認キーの欄が出て、説明は title と読み上げ用の補足に入る", async () => {
    summaryWith([item([{ pattern: "sum-both", count: 6 }])]);
    approvedNone();
    render(<ProblemPage lessonKey="main-6" problem="1/3+1/4" />);
    const input = (await screen.findByLabelText("承認キー")) as HTMLInputElement;
    expect(input.type).toBe("password");
    expect(input.title).toContain("この画面を閉じると消えます。");
    const note = document.getElementById(input.getAttribute("aria-describedby") ?? "");
    expect(note?.textContent).toBe(input.title);
  });

  it("プリントのてこの型を先生向けの名前で出す", async () => {
    summaryWith([{ chapterId: "rika", lessonKey: "print:rika-lever", problem: "左2-30g-右3", count: 6, patterns: [{ pattern: "lever-same-weight", count: 6 }] }]);
    approvedNone();
    render(<ProblemPage lessonKey="print:rika-lever" problem="左2-30g-右3" />);
    expect(await screen.findByText(`${PATTERN_LABEL["lever-same-weight"]}：6 ${TODAY_COPY.count}`)).toBeTruthy();
    expect(screen.queryByText(/undefined/)).toBeNull();
  });

  it("学習は単元の名前（分数 7マス目）で出し、main-6 は出さない（D-188）", async () => {
    summaryWith([item([{ pattern: "sum-both", count: 6 }])]);
    approvedNone();
    render(<ProblemPage lessonKey="main-6" problem="1/3+1/4" />);
    expect(await screen.findByText(/分数 7マス目/)).toBeTruthy();
    expect(screen.queryByText(/main-6/)).toBeNull();
  });

  it("直し方を作ると、先生の役割で送り、文と注を出す", async () => {
    summaryWith([item([{ pattern: "sum-both", count: 6 }])]);
    approvedNone();
    routes["POST /api/v1/suggestions"] = () =>
      ok({ id: "s-1", status: "pending", generatedBy: "table", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", replacesHintIndex: 0, hint: "まず同じ大きさにそろえよう", basis: { count: 6 } });
    render(<ProblemPage lessonKey="main-6" problem="1/3+1/4" />);
    fireEvent.click(await screen.findByRole("button", { name: PROBLEM_COPY.makeSuggestion }));
    expect(await screen.findByText("まず同じ大きさにそろえよう")).toBeTruthy();
    expect(screen.getByText(PROBLEM_COPY.suggestedNote)).toBeTruthy();
    const post = calls.find((c) => c.method === "POST" && c.path === "/api/v1/suggestions");
    expect(post?.body).toMatchObject({ role: "teacher", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both" });
  });

  it("作れなかったときは、押した型の下に短い文を出す", async () => {
    summaryWith([item([{ pattern: "sum-both", count: 6 }])]);
    approvedNone();
    routes["POST /api/v1/suggestions"] = () => ({ status: 422, json: { error: { code: "NOT_ENOUGH_RECORDS", message: "x" } } });
    render(<ProblemPage lessonKey="main-6" problem="1/3+1/4" />);
    fireEvent.click(await screen.findByRole("button", { name: PROBLEM_COPY.makeSuggestion }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(PROBLEM_COPY.makeError));
  });

  it("承認済みの型は「承認済み」と出し、作るボタンを出さない", async () => {
    summaryWith([item([{ pattern: "same-den-sum", count: 7 }])]);
    routes["GET /api/v1/approved-hints"] = () => ok({ items: [{ pattern: "same-den-sum", replacesHintIndex: 0, hint: "x" }] });
    render(<ProblemPage lessonKey="main-6" problem="1/3+1/4" />);
    expect(await screen.findByText(PROBLEM_COPY.approved)).toBeTruthy();
    expect(screen.queryByRole("button", { name: PROBLEM_COPY.makeSuggestion })).toBeNull();
  });

  it("件数の一覧に無い問題は、見つからない文を出す", async () => {
    summaryWith([]);
    render(<ProblemPage lessonKey="main-6" problem="1/3+1/4" />);
    expect(await screen.findByText(PROBLEM_COPY.notFound)).toBeTruthy();
  });

  it("戻るは、単元の一覧から来たときは CP-1121 で単元へ（期間つき）。そうでなければ CP-960 で ./", async () => {
    summaryWith([item([{ pattern: "sum-both", count: 6 }])]);
    approvedNone();
    const view = render(<ProblemPage lessonKey="main-6" problem="1/3+1/4" backTo={{ chapterId: "fraction", lessonKey: "main-6", period: "today" }} />);
    const back = await screen.findByRole("link", { name: UNIT_COPY.backToUnit });
    expect(back.getAttribute("href")).toBe("?view=unit&chapter=fraction&lesson=main-6&period=today");
    expect(screen.queryByRole("link", { name: PROBLEM_COPY.back })).toBeNull();
    view.unmount();
    render(<ProblemPage lessonKey="main-6" problem="1/3+1/4" />);
    const plain = await screen.findByRole("link", { name: PROBLEM_COPY.back });
    expect(plain.getAttribute("href")).toBe("./");
    expect(screen.queryByRole("link", { name: UNIT_COPY.backToUnit })).toBeNull();
  });

  it("章が来たときは、章も一致する行を使う", async () => {
    summaryWith([{ ...item([{ pattern: "sum-both", count: 2 }], 2), chapterId: "decimal" }, item([{ pattern: "sum-both", count: 7 }], 7)]);
    approvedNone();
    render(<ProblemPage lessonKey="main-6" problem="1/3+1/4" backTo={{ chapterId: "fraction", lessonKey: "main-6" }} />);
    expect(await screen.findByText(`${PATTERN_LABEL["sum-both"]}：7 ${TODAY_COPY.count}`)).toBeTruthy();
  });
});
