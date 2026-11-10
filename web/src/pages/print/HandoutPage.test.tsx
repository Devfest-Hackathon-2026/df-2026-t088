import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GradeProvider } from "../../grade";
import { HandoutPage } from "./HandoutPage";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.localStorage.clear();
});

const MOON = { id: "h-1", templateId: "rika-moon", questionText: "月の形が日によって変わるのはなぜ？", params: {}, createdAt: "2026-11-10T00:00:00.000Z" };
const SUN = { id: "h-2", templateId: "rika-moon", questionText: "太陽はどこにある？", params: {}, createdAt: "2026-11-10T00:00:00.000Z" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const notFound = () => reply({ error: { code: "NOT_FOUND", message: "not found" } }, 404);

it("配布済みの説明を一覧に出して開き、子ども画面では読み取り API を呼ばない", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    void input;
    return new Response(JSON.stringify({ items: [
    { id: "h-1", templateId: "rika-moon", questionText: "月の形が日によって変わるのはなぜ？", params: {}, createdAt: "2026-11-10T00:00:00.000Z" },
    ] }), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<GradeProvider><HandoutPage onGoHome={vi.fn()} /></GradeProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "月の形が日によって変わるのはなぜ？" }));
  expect(await screen.findByText("月の形が日によって変わるのはなぜ？")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/print/handouts");
});

it("共有リンクの説明 ID で、一覧ではなく by-id の経路を読んで開く", async () => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => reply(SUN));
  vi.stubGlobal("fetch", fetchMock);
  render(<GradeProvider><HandoutPage handoutId="h-2" onGoHome={vi.fn()} /></GradeProvider>);
  expect(await screen.findByText("太陽はどこにある？")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "月の形が日によって変わるのはなぜ？" })).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/api\/v1\/print\/handouts\/h-2$/);
});

it("共有リンクの説明が 404 の時は見つからないと知らせる", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => notFound()));
  render(<GradeProvider><HandoutPage handoutId="missing-id" onGoHome={vi.fn()} /></GradeProvider>);
  expect((await screen.findByRole("alert")).textContent).toBe("この説明は見つかりませんでした。");
});

it("共有リンクの説明が 404 以外で読めない時は、読みこめなかったと知らせる", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 500 })));
  render(<GradeProvider><HandoutPage handoutId="h-2" onGoHome={vi.fn()} /></GradeProvider>);
  expect((await screen.findByRole("alert")).textContent).toBe("説明を読みこめませんでした。もう一度お試しください。");
});

it("学級コードで開くと、学級の名前と説明の一覧を出し、コードを端末に残す", async () => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => reply({ name: "5年1組", items: [MOON, SUN] }));
  vi.stubGlobal("fetch", fetchMock);
  render(<GradeProvider><HandoutPage classCode="AB23CD" onGoHome={vi.fn()} /></GradeProvider>);
  expect(await screen.findByRole("heading", { name: "5年1組" })).toBeTruthy();
  expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/api\/v1\/join\/AB23CD$/);
  expect(window.localStorage.getItem("sugoroku:class-code")).toBe("AB23CD");
  fireEvent.click(screen.getByRole("button", { name: "太陽はどこにある？" }));
  expect(await screen.findByText("太陽はどこにある？")).toBeTruthy();
});

it("無い学級コードは、断りの文を出し、コードを残さない", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => notFound()));
  render(<GradeProvider><HandoutPage classCode="ZZZZZZ" onGoHome={vi.fn()} /></GradeProvider>);
  expect((await screen.findByRole("alert")).textContent).toBe("この学級コードは見つかりませんでした。先生にたしかめてね");
  expect(window.localStorage.getItem("sugoroku:class-code")).toBeNull();
});

it("/home/handouts は、残したコードがあればその学級の一覧を出す", async () => {
  window.localStorage.setItem("sugoroku:class-code", "AB23CD");
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => reply({ name: "5年1組", items: [SUN] }));
  vi.stubGlobal("fetch", fetchMock);
  render(<GradeProvider><HandoutPage onGoHome={vi.fn()} /></GradeProvider>);
  expect(await screen.findByRole("button", { name: "太陽はどこにある？" })).toBeTruthy();
  expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/api\/v1\/join\/AB23CD$/);
});

it("残したコードで読めないときは、今までの一覧に戻す", async () => {
  window.localStorage.setItem("sugoroku:class-code", "OLD234");
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).includes("/join/") ? notFound() : reply({ items: [MOON] }));
  vi.stubGlobal("fetch", fetchMock);
  render(<GradeProvider><HandoutPage onGoHome={vi.fn()} /></GradeProvider>);
  expect(await screen.findByRole("button", { name: "月の形が日によって変わるのはなぜ？" })).toBeTruthy();
});

it("localStorage が使えなくても、学級コードの一覧は出る", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.stubGlobal("fetch", vi.fn(async () => reply({ name: "5年1組", items: [SUN] })));
  render(<GradeProvider><HandoutPage classCode="AB23CD" onGoHome={vi.fn()} /></GradeProvider>);
  expect(await screen.findByRole("button", { name: "太陽はどこにある？" })).toBeTruthy();
  vi.restoreAllMocks();
});

it("先生が子どもの撮影を入れた学級には、「じぶんの プリントを とる」が出る。押すと撮る画面（とる段）になる", async () => {
  vi.stubEnv("VITE_PRINT_READ", "api");
  vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL) => reply({ name: "5年1組", childCapture: true, items: [MOON] })));
  const { container } = render(<GradeProvider><HandoutPage classCode="AB23CD" onGoHome={vi.fn()} /></GradeProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "じぶんの プリントを とる" }));
  expect(container.querySelector('[data-stage="take"]')).toBeTruthy();
});

it("本物の読み取りでない build では、childCapture が true の学級でも「じぶんの プリントを とる」を出さない（見本の応答に入らない。#281）", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL) => reply({ name: "5年1組", childCapture: true, items: [MOON] })));
  render(<GradeProvider><HandoutPage classCode="AB23CD" onGoHome={vi.fn()} /></GradeProvider>);
  await screen.findByRole("button", { name: "月の形が日によって変わるのはなぜ？" });
  expect(screen.queryByRole("button", { name: "じぶんの プリントを とる" })).toBeNull();
});

it("切の学級（childCapture が false か無い）では、撮るボタンを出さない", async () => {
  for (const body of [{ name: "5年1組", childCapture: false, items: [MOON] }, { name: "5年1組", items: [MOON] }]) {
    vi.stubGlobal("fetch", vi.fn(async () => reply(body)));
    const { unmount } = render(<GradeProvider><HandoutPage classCode="AB23CD" onGoHome={vi.fn()} /></GradeProvider>);
    await screen.findByRole("button", { name: "月の形が日によって変わるのはなぜ？" });
    expect(screen.queryByRole("button", { name: "じぶんの プリントを とる" })).toBeNull();
    unmount();
  }
});

it("端末に残した学級コードで /home/handouts を開いたときも、入れた学級なら撮るボタンが出る", async () => {
  window.localStorage.setItem("sugoroku:class-code", "AB23CD");
  vi.stubEnv("VITE_PRINT_READ", "api");
  vi.stubGlobal("fetch", vi.fn(async () => reply({ name: "5年1組", childCapture: true, items: [] })));
  render(<GradeProvider><HandoutPage onGoHome={vi.fn()} /></GradeProvider>);
  expect(await screen.findByRole("button", { name: "じぶんの プリントを とる" })).toBeTruthy();
});

it("配られた説明に「とりなおす」は出さない", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => reply({ name: "5年1組", items: [MOON] })));
  render(<GradeProvider><HandoutPage classCode="AB23CD" onGoHome={vi.fn()} /></GradeProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "月の形が日によって変わるのはなぜ？" }));
  expect(await screen.findByRole("heading", { level: 2, name: /月/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "とりなおす" })).toBeNull();
});

it("ログインしていない子：一覧には「← ホーム」を出さず、説明を開いたら一覧へ戻す手にする", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => reply({ name: "5年1組", items: [MOON] })));
  render(<GradeProvider><HandoutPage classCode="AB23CD" /></GradeProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "月の形が日によって変わるのはなぜ？" }));
  fireEvent.click(await screen.findByRole("button", { name: "ホームに もどる" }));
  expect(await screen.findByRole("heading", { name: "5年1組" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "ホームに もどる" })).toBeNull();
});
