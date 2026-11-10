import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GradeProvider } from "../../grade";
import { HandoutFractionPage } from "./HandoutFractionPage";
import { HandoutPage } from "./HandoutPage";

const PARAMS = { left: { num: 1, den: 2 }, op: "+", right: { num: 1, den: 3 } };
const HANDOUT = { id: "h-frac-1", templateId: "sansu-fraction-addsub", questionText: "1/2 + 1/3", params: PARAMS, createdAt: "2026-11-10T00:00:00.000Z" };
const OUT_OF_RANGE = { ...HANDOUT, id: "h-frac-2", questionText: "1/7 + 1/11", params: { left: { num: 1, den: 7 }, op: "+", right: { num: 1, den: 11 } } };

type Call = { method: string; url: string; body?: Record<string, unknown> };
let calls: Call[] = [];
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const answer = (text: string) => {
  fireEvent.change(screen.getByLabelText(/^こたえ/), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "こたえる" }));
};
const renderPage = (params: unknown = PARAMS, text = "1/2 + 1/3", onBack = vi.fn()) => {
  render(<GradeProvider><HandoutFractionPage handoutId="h-frac-1" questionText={text} params={params} onBack={onBack} /></GradeProvider>);
  return onBack;
};

beforeEach(() => {
  calls = [];
  Element.prototype.scrollIntoView = vi.fn();
  window.localStorage.clear();
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url: String(input), body: typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined });
    if (method === "POST") return new Response("{}", { status: 201 });
    return reply({ items: [{ pattern: "sum-both", replacesHintIndex: 0, hint: "分母がちがうときは、分母どうしをたさないよ" }] });
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("配られた分数の式は、説明カードではなくタイルの学習の画面で出る", () => {
  renderPage();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("分数");
  expect(screen.getByLabelText(/^こたえ/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "分かんない" })).toBeTruthy();
  expect(document.querySelector(".lesson-card")?.textContent).toContain("2");
  expect(document.querySelector(".explain")).toBeNull();
});

it("範囲の外の式は「ひらけませんでした」になり、落ちない", () => {
  renderPage(OUT_OF_RANGE.params, OUT_OF_RANGE.questionText);
  expect(screen.getByRole("alert").textContent).toBe("この説明は ひらけませんでした");
  renderPage({ nonsense: 1 });
  expect(screen.getAllByRole("alert")).toHaveLength(2);
});

it("わざと間違えると、handoutId と lessonKey と分数の型を付けて送る", async () => {
  vi.stubEnv("VITE_LOOP_SEND", "on");
  renderPage();
  answer("2/5");
  await flush();
  const post = calls.find((call) => call.method === "POST");
  expect(post?.url).toContain("/api/v1/stumbles");
  expect(post?.body).toMatchObject({ handoutId: "h-frac-1", lessonKey: "print:sansu-fraction-addsub", problem: "1/2 + 1/3", pattern: "sum-both", chapterId: "sansu-5-fraction" });
  // 承認されたヒントを、今の分数の学習と同じ場所（ヒントの 1 つ目）に出す
  await waitFor(() => expect(calls.some((call) => call.method === "GET" && call.url.includes("handoutId=h-frac-1"))).toBe(true));
  await flush();
  fireEvent.click(screen.getByRole("button", { name: "分かんない" }));
  fireEvent.click(screen.getByRole("button", { name: "次のヒント" }));
  expect(screen.getByRole("list", { name: "ヒント" }).textContent).toContain("分母どうしをたさないよ");
});

it("送信の設定が無ければ何も送らない", async () => {
  vi.stubEnv("VITE_LOOP_SEND", "");
  renderPage();
  answer("2/5");
  await flush();
  expect(calls).toHaveLength(0);
});

it("解き終えると「もどる」だけが出て、経験値・進み・続きの保存は何も変わらない", async () => {
  vi.stubEnv("VITE_LOOP_SEND", "on");
  const onBack = renderPage();
  answer("2/5");
  await flush();
  expect(window.localStorage.length).toBe(0);
  answer("5/6");
  await flush();
  expect(screen.getByRole("heading", { name: "やったね" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "もどる" }));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(window.localStorage.length).toBe(0);
  expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
});

it("学級の一覧から分数を選ぶと、タイルの学習になる", async () => {
  vi.stubGlobal("fetch", async () => reply({ items: [HANDOUT, OUT_OF_RANGE] }));
  render(<GradeProvider><HandoutPage onGoHome={vi.fn()} /></GradeProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "1/2 + 1/3" }));
  expect(await screen.findByLabelText(/^こたえ/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "もどる" }));
  fireEvent.click(await screen.findByRole("button", { name: "1/7 + 1/11" }));
  expect((await screen.findByRole("alert")).textContent).toBe("この説明は ひらけませんでした");
});

it("配られたリンク 1 件でも、タイルの学習で開く", async () => {
  vi.stubGlobal("fetch", async () => reply(HANDOUT));
  render(<GradeProvider><HandoutPage handoutId="h-frac-1" onGoHome={vi.fn()} /></GradeProvider>);
  expect(await screen.findByLabelText(/^こたえ/)).toBeTruthy();
});
