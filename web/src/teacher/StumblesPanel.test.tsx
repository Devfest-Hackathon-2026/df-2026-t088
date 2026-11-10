import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StumblesPanel, patternsText, problemHref, sortByCount } from "./StumblesPanel";
import { unitHref, unitLabel } from "./unit";
import { CLASS_COPY, PATTERN_LABEL, TODAY_COPY, UNIT_COPY } from "./copy";
import type { SummaryItem } from "../research/api";

type Call = { method: string; path: string; body: Record<string, unknown> | undefined };
let calls: Call[] = [];
let reply: () => Response;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const summary = (items: SummaryItem[]) => () => json({ scope: "summary", items });

beforeEach(() => {
  calls = [];
  reply = summary([]);
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const path = String(input).split("?")[0] ?? "";
    calls.push({ method: init?.method ?? "GET", path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return reply();
  });
});

afterEach(() => vi.unstubAllGlobals());

const item = (problem: string, count: number, patterns: SummaryItem["patterns"] = []): SummaryItem => ({
  chapterId: "fraction",
  lessonKey: "main-6",
  problem,
  count,
  patterns,
});

describe("sortByCount", () => {
  it("件数の多い順に並べ、同じ件数は問題の順にする", () => {
    const sorted = sortByCount([item("1/3+1/4", 5), item("1/2+1/5", 9), item("1/6+1/8", 5)]);
    expect(sorted.map((row) => row.problem)).toEqual(["1/2+1/5", "1/3+1/4", "1/6+1/8"]);
  });
});

describe("problemHref", () => {
  it("教材と問題を、SCR-T02 のクエリにする", () => {
    expect(problemHref(item("1/3+1/4", 5))).toBe("?lesson=main-6&problem=1%2F3%2B1%2F4");
  });
});

describe("patternsText", () => {
  it("2つまでは件数の多い順に出す", () => {
    expect(patternsText([{ pattern: "sum-both", count: 2 }, { pattern: "same-den-sum", count: 6 }])).toBe(
      `${PATTERN_LABEL["same-den-sum"]} 6、${PATTERN_LABEL["sum-both"]} 2`,
    );
  });
  it("3つ以上なら2つと「ほか n」にする", () => {
    const text = patternsText([
      { pattern: "sum-both", count: 5 },
      { pattern: "same-den-sum", count: 9 },
      { pattern: "unclassified", count: 7 },
      { pattern: "unclassified", count: 1 },
    ]);
    expect(text).toBe(`${PATTERN_LABEL["same-den-sum"]} 9、${PATTERN_LABEL.unclassified} 7、${CLASS_COPY.otherPatterns(2)}`);
  });
});

describe("StumblesPanel（詰まっている問題）", () => {
  it("期間つきで、先生の役割の summary を読む。記録が無いときは期間ごとの空の文", async () => {
    const view = render(<StumblesPanel period="7days" reloadKey={0} />);
    expect(await screen.findByText(CLASS_COPY.empty7days)).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/v1/stumbles/query")?.body).toMatchObject({ role: "teacher", scope: "summary", period: "7days" });
    view.rerender(<StumblesPanel period="today" reloadKey={0} />);
    expect(await screen.findByText(TODAY_COPY.empty)).toBeTruthy();
    expect(calls[calls.length - 1]?.body).toMatchObject({ period: "today" });
  });

  it("同じ単元の問題を1行にまとめ（件数と型は合計）、件数の多い順に、単元・件数・多い型を列で出す", async () => {
    reply = summary([
      item("1/3+1/4", 5, [{ pattern: "sum-both", count: 5 }]),
      item("1/2+1/5", 9, [{ pattern: "same-den-sum", count: 6 }, { pattern: "unclassified", count: 3 }]),
      { chapterId: "fraction", lessonKey: "main-2", problem: "1/2+1/3", count: 20, patterns: [{ pattern: "sum-both", count: 20 }] },
    ]);
    render(<StumblesPanel period="7days" reloadKey={0} />);
    await waitFor(() => expect(document.querySelectorAll(".stumbles__row").length).toBe(2));
    const rows = Array.from(document.querySelectorAll<HTMLElement>(".stumbles__row"));
    // main-2（20 件）が先、main-6（5+9=14 件）が次。問題の式は出さない
    expect(rows[0]?.textContent).toContain(unitLabel("fraction", "main-2"));
    const second = within(rows[1] as HTMLElement);
    expect(second.getByText(unitLabel("fraction", "main-6"))).toBeTruthy();
    expect(second.getByText("14")).toBeTruthy();
    expect(second.queryByText("1/2+1/5")).toBeNull();
    expect(second.queryByText("main-6")).toBeNull();
    // 型は単元の中で合計：sum-both 5+0、same-den-sum 6、unclassified 3 の多い順に2つ
    expect(second.getByText(new RegExp(`${PATTERN_LABEL["same-den-sum"]} 6`))).toBeTruthy();
    for (const label of [UNIT_COPY.colUnit, CLASS_COPY.colCount, CLASS_COPY.colPatterns]) {
      expect(screen.getByRole("columnheader", { name: label })).toBeTruthy();
    }
    expect(screen.queryByRole("columnheader", { name: CLASS_COPY.colProblem })).toBeNull();
  });

  it("行は単元の問題の一覧（SCR-T11）へのリンクになる。期間が今日なら period=today も付く", async () => {
    reply = summary([item("1/3+1/4", 5)]);
    const view = render(<StumblesPanel period="7days" reloadKey={0} />);
    const link = await screen.findByRole("link", { name: unitLabel("fraction", "main-6") });
    expect(link.getAttribute("href")).toBe("?view=unit&chapter=fraction&lesson=main-6");
    view.rerender(<StumblesPanel period="today" reloadKey={0} />);
    await waitFor(() =>
      expect(screen.getByRole("link", { name: unitLabel("fraction", "main-6") }).getAttribute("href")).toBe(
        "?view=unit&chapter=fraction&lesson=main-6&period=today",
      ),
    );
    expect(unitHref("fraction", "main-6", "today")).toContain("&period=today");
  });

  it("表の下に、5 件未満を外した注（CP-934）は出さない（D-183）", async () => {
    reply = summary([item("1/3+1/4", 5)]);
    render(<StumblesPanel period="7days" reloadKey={0} />);
    expect(await screen.findByText(unitLabel("fraction", "main-6"))).toBeTruthy();
    expect(screen.queryByText(TODAY_COPY.hiddenNote)).toBeNull();
  });

  it("つながらないときは接続の文を出す。前の表があれば残す", async () => {
    reply = summary([item("1/3+1/4", 5)]);
    const view = render(<StumblesPanel period="7days" reloadKey={0} />);
    await screen.findByRole("link", { name: unitLabel("fraction", "main-6") });
    reply = () => {
      throw new TypeError("network down");
    };
    view.rerender(<StumblesPanel period="7days" reloadKey={1} />);
    expect(await screen.findByText(TODAY_COPY.connError)).toBeTruthy();
    expect(screen.getByRole("link", { name: unitLabel("fraction", "main-6") })).toBeTruthy();
  });

  it("最初からつながらないときは、接続の文だけを出す", async () => {
    reply = () => {
      throw new TypeError("network down");
    };
    render(<StumblesPanel period="7days" reloadKey={0} />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(TODAY_COPY.connError)).toBeTruthy();
  });
});
