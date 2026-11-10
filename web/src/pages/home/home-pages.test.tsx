import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GradeProvider } from "../../grade";
import { displayText } from "../../ruby-text";
import { COPY } from "../../copy";
import { HomeEntries } from "./HomeEntries";
import { AssignmentsPage } from "./AssignmentsPage";
import { TimetablePage } from "./TimetablePage";

const text = (value: string) => displayText(value, 5);
// 2026-11-09（月）10:00 日本時間
const NOW = "2026-11-09T10:00:00+09:00";
const ASSIGNMENTS = [
  { id: "hw-kanji-12", subjectId: "kokugo", title: "[漢字|かんじ]ドリル 12ページ", dueAt: "2026-11-08T08:30:00+09:00", submittedAt: null },
  { id: "hw-fraction-print", subjectId: "sansu", title: "[分数|ぶんすう]のプリント", dueAt: "2026-11-09T08:30:00+09:00", submittedAt: null },
  { id: "hw-medaka-card", subjectId: "rika", title: "メダカの[観察|かんさつ]カード", dueAt: "2026-11-09T15:00:00+09:00", submittedAt: null },
  { id: "hw-rice-report", subjectId: "shakai", title: "[米|こめ]づくりのしらべ[学習|がくしゅう]", dueAt: "2026-11-10T08:30:00+09:00", submittedAt: null },
  { id: "hw-english-card", subjectId: "eigo", title: "じこしょうかいカード", dueAt: "2026-11-14T08:30:00+09:00", submittedAt: null },
];
const DAYS = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  periods: Array.from({ length: weekday === 3 ? 5 : 6 }, (_, index) => ({ period: index + 1, subjectId: index === 4 && weekday === 3 ? "doutoku" : "kokugo" })),
}));

type Handler = (method: string, url: string) => Response | Promise<Response>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
let handler: Handler;
const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(handler(init?.method ?? "GET", String(input))));

function serve(overrides: Partial<Record<"PUT" | "DELETE", () => Response>> = {}) {
  handler = (method, url) => {
    if (method === "GET" && url.includes("/home/assignments?student=A-01")) return json({ now: NOW, assignments: ASSIGNMENTS });
    if (method === "GET" && url.endsWith("/home/timetable")) return json({ now: NOW, days: DAYS });
    if (method === "PUT") return overrides.PUT?.() ?? json({ assignmentId: url.split("/")[5], studentNumber: "A-01", submittedAt: "2026-11-09T10:00:05+09:00", late: url.includes("kanji") });
    if (method === "DELETE") return overrides.DELETE?.() ?? json({ assignmentId: url.split("/")[5], studentNumber: "A-01", submittedAt: null, late: false });
    return json({ error: { code: "INTERNAL" } }, 500);
  };
}

const renderEntries = () => {
  const showToast = vi.fn();
  const onOpen = vi.fn();
  render(<GradeProvider><HomeEntries onOpen={onOpen} showToast={showToast} /></GradeProvider>);
  return { showToast, onOpen };
};
const renderAssignments = () => {
  const showToast = vi.fn();
  render(<GradeProvider><AssignmentsPage onGoHome={vi.fn()} showToast={showToast} /></GradeProvider>);
  return { showToast };
};
const frame = (title: string) => screen.getByRole("heading", { level: 2, name: text(title) }).closest("section") as HTMLElement;
const submitButtons = (section: HTMLElement) => within(section).getAllByRole("button", { name: new RegExp(`^${text(COPY.CP_730)}`) });
const rowIds = (section: HTMLElement) => within(section).queryAllByRole("listitem").map((item) => item.getAttribute("data-assignment"));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  serve();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("PG-001 の上の帯の入口（D-250）", () => {
  it("「出すもの」にまだ出していない数の札を付け、名前は 見える文字＋CP-1278。押すと PG-007 へ。時間割は読まない", async () => {
    const { onOpen } = renderEntries();
    const button = await screen.findByRole("button", { name: `${text(COPY.CP_1277)}5${text(COPY.CP_1278)}` });
    expect(button.querySelector(".home-entries__count")?.textContent).toBe("5");
    expect(button.hasAttribute("aria-label")).toBe(false);
    expect(button.getAttribute("data-home-entry")).toBe("assignments");
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledWith("/home/assignments");
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/home/timetable"))).toBe(false);
    // 時間割の入口は出さない（D-249）
    expect(screen.queryByRole("button", { name: /じかんわり|時間割/ })).toBeNull();
  });

  it("出したものは数えない。全部出していれば札を出さない", async () => {
    handler = (method, url) => method === "GET" && url.includes("/home/assignments?")
      ? json({ now: NOW, assignments: ASSIGNMENTS.map((a) => ({ ...a, submittedAt: "2026-11-09T09:00:00+09:00" })) })
      : json({});
    renderEntries();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {});
    const button = screen.getByRole("button", { name: text(COPY.CP_1277) });
    expect(button.querySelector(".home-entries__count")).toBeNull();
  });

  it("読み込み中とつながらない時は札を出さずにボタンだけ。トーストも出さない", async () => {
    handler = () => { throw new TypeError("network"); };
    const { showToast, onOpen } = renderEntries();
    expect(screen.getByRole("button", { name: text(COPY.CP_1277) }).querySelector(".home-entries__count")).toBeNull();
    await act(async () => {});
    const button = screen.getByRole("button", { name: text(COPY.CP_1277) });
    expect(button.querySelector(".home-entries__count")).toBeNull();
    expect(showToast).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledWith("/home/assignments");
  });

  it("設定が on でなければカメラは出さない（D-164）", () => {
    renderEntries();
    expect(screen.queryByRole("button", { name: text(COPY.CP_861) })).toBeNull();
  });

  it("設定が on なら、カメラを「出すもの」の右に出す", () => {
    vi.stubEnv("VITE_PRINT_CHILD_CAPTURE", "on");
    vi.stubEnv("VITE_PRINT_READ", "api");
    const { onOpen } = renderEntries();
    const buttons = screen.getAllByRole("button");
    const camera = screen.getByRole("button", { name: text(COPY.CP_861) });
    expect(buttons.indexOf(camera)).toBe(1);
    expect(camera.getAttribute("data-home-entry")).toBe("print");
    fireEvent.click(camera);
    expect(onOpen).toHaveBeenCalledWith("/home/print");
  });

  it("本物の読み取りでない build（VITE_PRINT_READ が api でない）では、設定が on でもカメラを出さない（#281）", () => {
    vi.stubEnv("VITE_PRINT_CHILD_CAPTURE", "on");
    renderEntries();
    expect(screen.queryByRole("button", { name: text(COPY.CP_861) })).toBeNull();
  });
});

describe("PG-007 提出物で出す（PG-006 から移した）", () => {
  it("「出した」を押すとすぐ まだ から消えて 出したもの に入り、読み上げる", async () => {
    renderAssignments();
    const todo = await waitFor(() => {
      const section = frame(COPY.CP_762);
      expect(within(section).getAllByRole("listitem")).toHaveLength(5);
      return section;
    });
    fireEvent.click(submitButtons(todo)[0] as HTMLElement);
    expect(rowIds(frame(COPY.CP_762))).toEqual(["hw-fraction-print", "hw-medaka-card", "hw-rice-report", "hw-english-card"]);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(text(COPY.CP_733("[漢字|かんじ]ドリル 12ページ"))));
    expect(rowIds(frame(COPY.CP_763))).toEqual(["hw-kanji-12"]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/v1/home/assignments/hw-kanji-12/submissions/A-01"), expect.objectContaining({ method: "PUT" }));
  });

  it("「出した」のボタンは、見える文字から始まり、どの宿題かが名前で分かる（#371）", async () => {
    renderAssignments();
    const todo = await waitFor(() => {
      const section = frame(COPY.CP_762);
      expect(within(section).getAllByRole("listitem")).toHaveLength(5);
      return section;
    });
    const names = submitButtons(todo).map((button) => button.getAttribute("aria-label"));
    expect(names.slice(0, 3)).toEqual([text(COPY.CP_736("[漢字|かんじ]ドリル 12ページ")), text(COPY.CP_736("[分数|ぶんすう]のプリント")), text(COPY.CP_736("メダカの[観察|かんさつ]カード"))]);
    expect(new Set(names).size).toBe(5);
  });

  it("出すのに失敗したら行を戻し、トーストで知らせる。回数の上限は別の文", async () => {
    serve({ PUT: () => json({ error: { code: "INTERNAL" } }, 500) });
    const { showToast } = renderAssignments();
    await screen.findAllByRole("button", { name: new RegExp(`^${text(COPY.CP_730)}`) });
    fireEvent.click(submitButtons(frame(COPY.CP_762))[0] as HTMLElement);
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(COPY.CP_753));
    expect(rowIds(frame(COPY.CP_762))).toEqual(["hw-kanji-12", "hw-fraction-print", "hw-medaka-card", "hw-rice-report", "hw-english-card"]);
    serve({ PUT: () => json({ error: { code: "RATE_LIMITED" } }, 429) });
    fireEvent.click(submitButtons(frame(COPY.CP_762))[0] as HTMLElement);
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(COPY.CP_752));
  });

  it("サーバにつながらない時は知らせと「もう一度」を出し、押すと読み直す", async () => {
    handler = () => { throw new TypeError("network"); };
    renderAssignments();
    await waitFor(() => expect(screen.getAllByText(text(COPY.CP_750))).toHaveLength(1));
    serve();
    fireEvent.click(screen.getByRole("button", { name: text(COPY.CP_751) }));
    expect(await within(await waitFor(() => frame(COPY.CP_762))).findAllByRole("listitem")).toHaveLength(5);
  });
});

describe("PG-007 提出物と PG-008 時間割", () => {
  it("出したものは「出したのを 取り消す」で、まだ に戻る", async () => {
    render(<GradeProvider><AssignmentsPage onGoHome={vi.fn()} showToast={vi.fn()} /></GradeProvider>);
    const todo = await waitFor(() => frame(COPY.CP_762));
    fireEvent.click(within(todo).getAllByRole("button", { name: new RegExp(`^${text(COPY.CP_730)}`) })[0] as HTMLElement);
    const done = frame(COPY.CP_763);
    await waitFor(() => expect(within(done).getByText(text(COPY.CP_734("10:00")))).toBeTruthy());
    fireEvent.click(within(done).getByRole("button", { name: new RegExp(`^${text(COPY.CP_732)}`) }));
    await act(async () => {});
    expect(within(frame(COPY.CP_763)).queryAllByRole("listitem")).toHaveLength(0);
    expect(within(frame(COPY.CP_762)).getAllByRole("listitem")).toHaveLength(5);
  });

  it("時間割の画面は今日のコマを左に並べる", async () => {
    render(<GradeProvider><TimetablePage onGoHome={vi.fn()} showToast={vi.fn()} /></GradeProvider>);
    expect(await screen.findByRole("heading", { level: 2, name: text(COPY.CP_771("[月|げつ]")) })).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
  });
});

describe("PG-007・PG-008 の上の帯（D-149）", () => {
  it("「← ホーム」を出す。音は右上の CMP-043 に移ったので帯には無い（D-245）", async () => {
    const onGoHome = vi.fn();
    render(<GradeProvider><TimetablePage onGoHome={onGoHome} showToast={vi.fn()} /></GradeProvider>);
    fireEvent.click(screen.getByRole("button", { name: text(COPY.CP_760) }));
    expect(onGoHome).toHaveBeenCalled();
    expect(document.querySelector(".home-back")?.textContent).toContain(text(COPY.CP_784));
    expect(document.querySelector(".sound-button")).toBeNull();
    await screen.findByRole("heading", { level: 1 });
  });
});
