import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DECIDE_COPY, SUBMISSIONS_COPY } from "./copy";
import { REFRESH_MS, SubmissionsPage, dueText } from "./SubmissionsPage";

const NUMBERS = Array.from({ length: 30 }, (_, index) => `A-${String(index + 1).padStart(2, "0")}`);
const status = (count: number) => ({
  now: "2026-11-09T10:42:30+09:00",
  classSize: 30,
  assignments: [
    { id: "hw-kanji-12", subjectId: "kokugo", title: "[漢字|かんじ]ドリル 12ページ", dueAt: "2026-11-08T08:30:00+09:00", submittedCount: count, notSubmitted: NUMBERS.slice(count), late: NUMBERS.slice(0, count) },
  ],
});
const json = (body: unknown, code = 200) => new Response(JSON.stringify(body), { status: code });
let reply: (init?: RequestInit) => Response;
const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(reply(init)));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  reply = () => json(status(1));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("SCR-T05 提出の状況", () => {
  it("提出物ごとに n/30、出していない人、おくれて出した人を出す", async () => {
    render(<SubmissionsPage />);
    const row = (await screen.findByRole("rowheader", { name: "漢字ドリル 12ページ" })).closest("tr") as HTMLElement;
    expect(within(row).getByText("1/30")).toBeTruthy();
    expect(within(row).getByText(dueText("2026-11-08T08:30:00+09:00"))).toBeTruthy();
    expect(dueText("2026-11-08T08:30:00+09:00")).toBe("11/8(日) 8:30");
    expect(within(row).getByText(SUBMISSIONS_COPY.late)).toBeTruthy();
    expect(screen.getByText(SUBMISSIONS_COPY.refreshedAt("10:42:30"))).toBeTruthy();
  });

  it("出していない人が半分より多い時は人数だけを出し、押すと1人ずつの番号が開く（D-193）", async () => {
    render(<SubmissionsPage />);
    const row = (await screen.findByRole("rowheader", { name: "漢字ドリル 12ページ" })).closest("tr") as HTMLElement;
    const summary = within(row).getByText(SUBMISSIONS_COPY.missingCount(29));
    const details = summary.closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    fireEvent.click(summary);
    expect(details.open).toBe(true);
    const items = within(details).getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual(NUMBERS.slice(1));
  });

  it("出していない人が半分以下なら、たたまずに1人ずつ並べる（D-193）", async () => {
    reply = () => json(status(15));
    render(<SubmissionsPage />);
    const row = (await screen.findByRole("rowheader", { name: "漢字ドリル 12ページ" })).closest("tr") as HTMLElement;
    expect(row.querySelector("details")).toBeNull();
    expect(within(row).getByText("A-16")).toBeTruthy();
    expect(within(row).getByText("A-30")).toBeTruthy();
  });

  it("名簿の欄は出さず、出していない人は番号だけで出す（#256）", async () => {
    render(<SubmissionsPage />);
    await screen.findByText("1/30");
    expect(screen.queryByText("名簿")).toBeNull();
    expect(screen.queryByRole("button", { name: /名簿/ })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("A-02")).toBeTruthy();
  });

  it("承認キーが要る時は入力欄を出し、入れたキーをヘッダーで送る", async () => {
    reply = (init) => ((init?.headers as Record<string, string> | undefined)?.["x-approver-key"] === "k1" ? json(status(0)) : json({ error: { code: "UNAUTHORIZED" } }, 401));
    render(<SubmissionsPage />);
    expect(await screen.findByText(DECIDE_COPY.keyNeeded)).toBeTruthy();
    expect(screen.queryByText("0/30")).toBeNull();
    // 上の並びにも同じ見出しの欄があるので、この画面の自前の欄（id=submissions-key）に絞る
    const ownKey = screen.getAllByLabelText(DECIDE_COPY.keyLabel).find((element) => element.id === "submissions-key");
    expect(ownKey).toBeTruthy();
    fireEvent.change(ownKey as HTMLElement, { target: { value: "k1" } });
    fireEvent.click(screen.getByRole("button", { name: SUBMISSIONS_COPY.keyApply }));
    expect(await screen.findByText("0/30")).toBeTruthy();
  });

  it("30秒ごとに新しくし、つながらない時は前の数を残して知らせる", async () => {
    vi.useFakeTimers();
    render(<SubmissionsPage />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText("1/30")).toBeTruthy();
    reply = () => json(status(2));
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_MS); });
    expect(screen.getByText("2/30")).toBeTruthy();
    reply = () => { throw new TypeError("network"); };
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_MS); });
    expect(screen.getByText("2/30")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe(SUBMISSIONS_COPY.connError("10:42:30"));
  });

  it("画面が隠れている間は新しくしない", async () => {
    vi.useFakeTimers();
    render(<SubmissionsPage />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const calls = fetchMock.mock.calls.length;
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_MS * 2); });
    expect(fetchMock.mock.calls.length).toBe(calls);
    hidden.mockReturnValue(false);
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(0); });
    expect(fetchMock.mock.calls.length).toBe(calls + 1);
    hidden.mockRestore();
  });
});
