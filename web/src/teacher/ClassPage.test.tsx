import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unitLabel } from "./unit";
import { ClassPage } from "./ClassPage";
import { CLASS_COPY, SUBMISSIONS_COPY, TODAY_COPY } from "./copy";
import type { SummaryItem } from "../research/api";

vi.mock("./ProgressPanel", () => ({
  ProgressPanel: ({ reloadKey, subjectId }: { reloadKey: number; subjectId?: string }) => <p data-testid="progress">{`progress ${reloadKey} ${subjectId ?? ""}`}</p>,
}));

type Call = { path: string; body: Record<string, unknown> | undefined };
let calls: Call[] = [];
let reply: () => Response;

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const item = (problem: string, count: number): SummaryItem => ({ chapterId: "fraction", lessonKey: "main-6", problem, count, patterns: [] });
// 表の行は単元（章＋何マス目）ごと
const UNIT = unitLabel("fraction", "main-6");
const summaryCalls = () => calls.filter((c) => c.path === "/api/v1/stumbles/query" && c.body?.purpose === CLASS_COPY.purpose);

beforeEach(() => {
  calls = [];
  reply = () => json({ scope: "summary", items: [item("1/3+1/4", 5)] });
  window.history.replaceState(null, "", "/teacher/");
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    calls.push({ path: String(input).split("?")[0] ?? "", body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (String(input).includes("/api/v1/print/demand")) return json({ items: [] });
    if (String(input).includes("/api/v1/loop/assistant")) return json({ items: [] });
    return reply();
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("ClassPage（SCR-T10 学級のようす）", () => {
  it("見出し（読み上げだけ）と、最初は「詰まっている問題」。直近7日を読み、URL は変えない", async () => {
    render(<ClassPage />);
    expect(screen.getByRole("heading", { name: CLASS_COPY.title })).toBeTruthy();
    expect(screen.getByRole("tab", { name: CLASS_COPY.tabStumbles }).getAttribute("aria-selected")).toBe("true");
    expect(await screen.findByRole("link", { name: UNIT })).toBeTruthy();
    expect(summaryCalls()[0]?.body).toMatchObject({ role: "teacher", scope: "summary", period: "7days" });
    expect(window.location.search).toBe("");
    expect(screen.getByRole("heading", { name: CLASS_COPY.title }).className).toBe("class-page__title");
  });

  it("期間を「今日」にすると、today で読み直し、URL に period=today を入れる", async () => {
    render(<ClassPage />);
    await screen.findByRole("link", { name: UNIT });
    fireEvent.change(screen.getByLabelText(CLASS_COPY.periodLabel), { target: { value: "today" } });
    await waitFor(() => expect(summaryCalls().length).toBe(2));
    expect(summaryCalls()[1]?.body).toMatchObject({ period: "today" });
    expect(window.location.search).toBe("?period=today");
    fireEvent.change(screen.getByLabelText(CLASS_COPY.periodLabel), { target: { value: "7days" } });
    expect(window.location.search).toBe("");
  });

  it("タブを押すと「子どもの進み」に替わり、URL に tab=progress。期間の欄は消える", async () => {
    render(<ClassPage />);
    fireEvent.click(screen.getByRole("tab", { name: CLASS_COPY.tabProgress }));
    expect(screen.getByTestId("progress")).toBeTruthy();
    expect(window.location.search).toBe("?tab=progress");
    expect(screen.queryByLabelText(CLASS_COPY.periodLabel)).toBeNull();
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(screen.getByRole("tab", { name: CLASS_COPY.tabProgress }).id);
    fireEvent.click(screen.getByRole("tab", { name: CLASS_COPY.tabStumbles }));
    expect(window.location.search).toBe("");
  });

  it("左右の矢印キーでタブを移る", () => {
    render(<ClassPage />);
    const stumbles = screen.getByRole("tab", { name: CLASS_COPY.tabStumbles });
    stumbles.focus();
    fireEvent.keyDown(stumbles, { key: "ArrowRight" });
    const progress = screen.getByRole("tab", { name: CLASS_COPY.tabProgress });
    expect(progress.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(progress);
    expect(window.location.search).toBe("?tab=progress");
    fireEvent.keyDown(progress, { key: "ArrowLeft" });
    expect(stumbles.getAttribute("aria-selected")).toBe("true");
  });

  it("URL から決めた初めのタブ・期間で開く", async () => {
    const view = render(<ClassPage initialTab="progress" />);
    expect(screen.getByTestId("progress")).toBeTruthy();
    view.unmount();
    render(<ClassPage initialPeriod="today" />);
    await screen.findByRole("link", { name: UNIT });
    expect(summaryCalls()[summaryCalls().length - 1]?.body).toMatchObject({ period: "today" });
  });

  it("空のときは期間ごとの文を出す", async () => {
    reply = () => json({ scope: "summary", items: [] });
    render(<ClassPage />);
    expect(await screen.findByText(CLASS_COPY.empty7days)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(CLASS_COPY.periodLabel), { target: { value: "today" } });
    expect(await screen.findByText(TODAY_COPY.empty)).toBeTruthy();
  });

  it("つながらないときは接続の文を出す", async () => {
    reply = () => {
      throw new TypeError("network down");
    };
    render(<ClassPage />);
    expect(await screen.findByText(TODAY_COPY.connError)).toBeTruthy();
  });

  it("時刻と「新しくする」は出さず（D-184）、開いた時の1回だけ読む", async () => {
    render(<ClassPage />);
    await screen.findByRole("link", { name: UNIT });
    expect(screen.queryByRole("button", { name: SUBMISSIONS_COPY.refresh })).toBeNull();
    expect(screen.queryByText(/に新しくしました$/)).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(summaryCalls().length).toBe(1);
  });

  it("教科の欄は「子どもの進み」のときだけ。理科を選ぶと URL に subject=rika、算数に戻すと省く", () => {
    render(<ClassPage />);
    expect(screen.queryByLabelText(CLASS_COPY.subjectLabel)).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: CLASS_COPY.tabProgress }));
    const select = screen.getByLabelText(CLASS_COPY.subjectLabel) as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(["算数", "理科"]);
    expect(select.value).toBe("sansu");
    fireEvent.change(select, { target: { value: "rika" } });
    expect(window.location.search).toBe("?tab=progress&subject=rika");
    expect(screen.getByTestId("progress").textContent).toContain("rika");
    fireEvent.change(select, { target: { value: "sansu" } });
    expect(window.location.search).toBe("?tab=progress");
    fireEvent.click(screen.getByRole("tab", { name: CLASS_COPY.tabLoop }));
    expect(screen.queryByLabelText(CLASS_COPY.subjectLabel)).toBeNull();
  });

  it("URL から決めた教科で開く", () => {
    render(<ClassPage initialTab="progress" initialSubject="rika" />);
    expect((screen.getByLabelText(CLASS_COPY.subjectLabel) as HTMLSelectElement).value).toBe("rika");
  });
});
