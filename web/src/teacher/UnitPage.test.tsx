import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnitPage } from "./UnitPage";
import { unitLabel } from "./unit";
import { CLASS_COPY, PROBLEM_COPY, TODAY_COPY, UNIT_COPY } from "./copy";
import type { SummaryItem } from "../research/api";

let calls: { path: string; body: Record<string, unknown> | undefined }[] = [];
let reply: () => Response;
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const item = (chapterId: string, lessonKey: string, problem: string, count: number): SummaryItem => ({
  chapterId,
  lessonKey,
  problem,
  count,
  patterns: [{ pattern: "sum-both", count }],
});

beforeEach(() => {
  calls = [];
  reply = () => json({ scope: "summary", items: [] });
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    calls.push({ path: String(input).split("?")[0] ?? "", body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return reply();
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("UnitPage（SCR-T11 単元の問題の一覧）", () => {
  it("その単元の問題だけを件数の多い順に出し、行は SCR-T02 へ from=unit つきのリンク", async () => {
    reply = () =>
      json({
        scope: "summary",
        items: [
          item("fraction", "main-6", "1/3+1/4", 5),
          item("fraction", "main-6", "1/2+1/5", 9),
          item("fraction", "main-2", "1/2+1/3", 20),
          item("decimal", "main-6", "0.1+0.2", 30),
        ],
      });
    render(<UnitPage chapterId="fraction" lessonKey="main-6" />);
    expect(screen.getByRole("heading", { name: UNIT_COPY.title(unitLabel("fraction", "main-6")) })).toBeTruthy();
    await waitFor(() => expect(document.querySelectorAll(".stumbles__row").length).toBe(2));
    const links = screen.getAllByRole("link").filter((a) => a.closest(".stumbles__row"));
    expect(links.map((a) => a.textContent)).toEqual(["1/2+1/5", "1/3+1/4"]);
    expect(links[0]?.getAttribute("href")).toBe("?lesson=main-6&problem=1%2F2%2B1%2F5&chapter=fraction&from=unit");
    expect(screen.getByRole("columnheader", { name: CLASS_COPY.colPatterns })).toBeTruthy();
    expect(calls[0]?.body).toMatchObject({ role: "teacher", scope: "summary", period: "7days" });
  });

  it("期間が今日なら today で読み、戻るとリンクに period=today を残す", async () => {
    reply = () => json({ scope: "summary", items: [item("fraction", "main-6", "1/3+1/4", 5)] });
    render(<UnitPage chapterId="fraction" lessonKey="main-6" period="today" />);
    const link = await screen.findByRole("link", { name: "1/3+1/4" });
    expect(link.getAttribute("href")).toBe("?lesson=main-6&problem=1%2F3%2B1%2F4&chapter=fraction&from=unit&period=today");
    expect(calls[0]?.body).toMatchObject({ period: "today" });
    expect(screen.getByRole("link", { name: PROBLEM_COPY.back }).getAttribute("href")).toBe("?period=today");
  });

  it("戻るは、期間が直近7日なら ? で学級のようすへ", async () => {
    render(<UnitPage chapterId="fraction" lessonKey="main-6" />);
    expect(screen.getByRole("link", { name: PROBLEM_COPY.back }).getAttribute("href")).toBe("?");
    await screen.findByText(UNIT_COPY.empty);
  });

  it("その単元の行が無ければ空の文", async () => {
    reply = () => json({ scope: "summary", items: [item("decimal", "main-6", "0.1+0.2", 9)] });
    render(<UnitPage chapterId="fraction" lessonKey="main-6" />);
    expect(await screen.findByText(UNIT_COPY.empty)).toBeTruthy();
  });

  it("読み込み中の文、つながらないときは接続の文", async () => {
    reply = () => {
      throw new TypeError("network down");
    };
    render(<UnitPage chapterId="fraction" lessonKey="main-6" />);
    expect(screen.getByText(TODAY_COPY.loading)).toBeTruthy();
    expect(await screen.findByText(TODAY_COPY.connError)).toBeTruthy();
  });
});
