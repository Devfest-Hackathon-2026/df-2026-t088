import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PrintHandoutPage } from "./PrintHandoutPage";
import { setApproverKey } from "./approver-key";
import { TeacherSessionContext } from "./workspace";

vi.mock("../pages/print/capture", () => ({
  cropToLasso: vi.fn(async () => new Blob(["crop"], { type: "image/jpeg" })),
  scaledSize: (width: number, height: number) => ({ width, height }),
  JPEG_QUALITY: 0.85,
  isTooSmall: () => false,
  lassoBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
}));
vi.mock("../pages/print/LassoFrame", () => ({
  LassoFrame: ({ onPathChange }: { onPathChange: (path: { x: number; y: number }[]) => void }) => <button onClick={() => onPathChange([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])}>囲みを作る</button>,
}));
vi.mock("../pages/print/ExplainCard", () => ({
  ExplainCard: ({ problem }: { problem: { params: { left?: { pos: number; g: number }; right?: { pos: number } } } }) => <output aria-label="説明に使う数">{JSON.stringify(problem.params)}</output>,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  document.querySelectorAll('script[src="https://apis.google.com/js/platform.js"]').forEach((script) => script.remove());
});

function mockHandoutsFetch() {
  return vi.fn(async () => new Response(JSON.stringify({ items: [
    { id: "handout-1", templateId: "rika-moon", questionText: "月の形が日によって変わるのはなぜ？", params: {}, createdAt: "2026-11-10T00:00:00.000Z" },
  ] }), { status: 200, headers: { "content-type": "application/json" } }));
}
function mockHandouts() {
  vi.stubGlobal("fetch", mockHandoutsFetch());
}

it("配った説明に公式共有ボタンを置き、説明を開ける URL を渡す", async () => {
  mockHandouts();
  render(<PrintHandoutPage />);
  const script = await waitFor(() => document.querySelector<HTMLScriptElement>('script[src="https://apis.google.com/js/platform.js"]'));
  expect(script).toBeTruthy();
  act(() => { script!.dispatchEvent(new Event("load")); });
  await waitFor(() => expect(document.querySelector(".g-sharetoclassroom")).toBeTruthy());
  expect(document.querySelector(".g-sharetoclassroom")?.getAttribute("data-url")).toBe(`${window.location.origin}/home/handouts/handout-1`);
});

it("共有スクリプトが読み込めない時は共有 URL のリンクを出す", async () => {
  mockHandouts();
  render(<PrintHandoutPage />);
  const script = await waitFor(() => document.querySelector<HTMLScriptElement>('script[src="https://apis.google.com/js/platform.js"]'));
  act(() => { script!.dispatchEvent(new Event("error")); });
  const link = await screen.findByRole("link", { name: "Classroom で共有" });
  const sharedUrl = `${window.location.origin}/home/handouts/handout-1`;
  expect(link.getAttribute("href")).toBe(`https://classroom.google.com/share?url=${encodeURIComponent(sharedUrl)}`);
});


// プリントの画面は、型の無い単元の需要（PrintDemandPanel）も読む。順番に答える見本とは別に返す
function withDemand(sequence: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => String(url).includes("/api/v1/print/demand")
    ? new Response(JSON.stringify({ items: [] }), { status: 200 })
    : sequence(url, init));
}

it("読み取り後に切り出した写真と、編集できるてこの数を表示し、確認前は配れない", async () => {
  const sequence = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ problems: [{ templateId: "rika-lever", questionText: "てこの問題", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } }, approved: true }], unsupportedCount: 0, demandRecorded: false }), { status: 200 }))
    .mockResolvedValueOnce(new Response("{}", { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }));
  const fetchMock = withDemand(sequence);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 100, height: 100, close: vi.fn() })));
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:local-crop"), revokeObjectURL: vi.fn() });
  render(<PrintHandoutPage />);

  const file = new File(["photo"], "print.jpg", { type: "image/jpeg" });
  await act(async () => {
    Object.defineProperty(screen.getByLabelText(/プリントを撮る/), "files", { value: [file] });
    screen.getByLabelText(/プリントを撮る/).dispatchEvent(new Event("change", { bubbles: true }));
  });
  await screen.findByRole("button", { name: "囲みを作る" });
  fireEvent.click(screen.getByRole("button", { name: "囲みを作る" }));
  fireEvent.click(screen.getByRole("button", { name: "囲んだ問題を読み取る" }));

  const photo = await screen.findByRole("img", { name: "読み取った問題の写真" });
  expect(photo.getAttribute("src")).toBe("blob:local-crop");
  expect(screen.getByRole("table", { name: "写真と見比べてください" })).toBeTruthy();
  const deliver = screen.getByRole("button", { name: /確かめた/ }) as HTMLButtonElement;
  expect(deliver.getAttribute("aria-disabled")).toBe("false");
  expect(screen.getByLabelText("左の目もり")).toBeTruthy();
  expect(screen.getByLabelText("左の重さ")).toBeTruthy();
  expect(screen.getByLabelText("右の目もり")).toBeTruthy();
  expect(screen.queryByRole("option", { name: "80g" })).toBeNull();

  fireEvent.change(screen.getByLabelText("左の重さ"), { target: { value: "60" } });
  expect(screen.getByLabelText("説明に使う数").textContent).toBe(JSON.stringify({ left: { pos: 2, g: 60 }, right: { pos: 3 } }));

  await act(async () => {
    screen.getByLabelText("写真と数を確かめました").click();
  });
  expect(deliver.getAttribute("aria-disabled")).toBe("false");
  fireEvent.change(screen.getByLabelText("右の目もり"), { target: { value: "6" } });
  expect(deliver.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(screen.getByLabelText("写真と数を確かめました"));
  expect(deliver.getAttribute("aria-disabled")).toBe("false");
  await act(async () => { fireEvent.click(deliver); });
  const post = fetchMock.mock.calls.find((call) => call[0] === "/api/v1/print/handouts" && call[1]?.method === "POST");
  expect(post).toBeTruthy();
  expect(JSON.parse((post?.[1] as RequestInit).body as string).params).toEqual({ left: { pos: 2, g: 60 }, right: { pos: 6 } });
});

it("月は数の表に params を表示し、数の編集欄は出さない", async () => {
  vi.stubGlobal("fetch", withDemand(vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ problems: [{ templateId: "rika-moon", questionText: "月の形の問題", params: {}, approved: true }], unsupportedCount: 0, demandRecorded: false }), { status: 200 }))));
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 100, height: 100, close: vi.fn() })));
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:local-crop"), revokeObjectURL: vi.fn() });
  render(<PrintHandoutPage />);
  await act(async () => {
    Object.defineProperty(screen.getByLabelText(/プリントを撮る/), "files", { value: [new File(["photo"], "print.jpg", { type: "image/jpeg" })] });
    screen.getByLabelText(/プリントを撮る/).dispatchEvent(new Event("change", { bubbles: true }));
  });
  fireEvent.click(screen.getByRole("button", { name: "囲みを作る" }));
  fireEvent.click(screen.getByRole("button", { name: "囲んだ問題を読み取る" }));
  await screen.findByRole("table", { name: "写真と見比べてください" });
  expect(screen.getByRole("cell", { name: "この型には数がありません" })).toBeTruthy();
  expect(screen.queryByLabelText("左の目もり")).toBeNull();
});

it.each([
  ["429", () => new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 })],
  ["500", () => new Response("oops", { status: 500 })],
  ["200 で items 無し", () => new Response("{}", { status: 200 })],
])("一覧の読みこみが失敗（%s）しても落ちず、読みこめなかった文ともう一度のボタンを出す", async (_name, failure) => {
  const fetchMock = vi.fn()
    .mockImplementationOnce(async () => failure())
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [
      { id: "handout-1", templateId: "rika-moon", questionText: "月の形が日によって変わるのはなぜ？", params: {}, createdAt: "2026-11-10T00:00:00.000Z" },
    ] }), { status: 200 }));
  vi.stubGlobal("fetch", withDemand(fetchMock));
  render(<PrintHandoutPage />);
  expect(await screen.findByText("配った説明を読みこめませんでした。")).toBeTruthy();
  expect(screen.queryByText("まだ配っていません。")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "もう一度読みこむ" }));
  expect(await screen.findByText("月の形が日によって変わるのはなぜ？")).toBeTruthy();
  expect(screen.queryByText("配った説明を読みこめませんでした。")).toBeNull();
});

it.each([401, 403])("写真の読み取りが %s で断られたら、写真ではなく承認キーを案内する", async (status) => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input).includes("/api/v1/print/read")
    ? new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status })
    : new Response(JSON.stringify({ items: [] }), { status: 200 })));
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 100, height: 100, close: vi.fn() })));
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:local-crop"), revokeObjectURL: vi.fn() });
  render(<PrintHandoutPage />);
  const file = new File(["photo"], "print.jpg", { type: "image/jpeg" });
  await act(async () => {
    Object.defineProperty(screen.getByLabelText(/プリントを撮る/), "files", { value: [file] });
    screen.getByLabelText(/プリントを撮る/).dispatchEvent(new Event("change", { bubbles: true }));
  });
  await screen.findByRole("button", { name: "囲みを作る" });
  fireEvent.click(screen.getByRole("button", { name: "囲みを作る" }));
  fireEvent.click(screen.getByRole("button", { name: "囲んだ問題を読み取る" }));
  expect(await screen.findByText(/「承認キー」を確かめてください/, undefined, { timeout: 5000 })).toBeTruthy();
  expect(screen.queryByText(/写真を確かめて/)).toBeNull();
});

// 学級に入っているとき（TeacherGate が渡す）
const inWorkspace = (ui: React.ReactNode) => render(
  <TeacherSessionContext.Provider value={{ session: { workspace: { id: "w-1", name: "わたしの学級", joinCode: "AB23CD" } }, setWorkspace: () => {} }}>{ui}</TeacherSessionContext.Provider>,
);

async function pickAndRead() {
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 100, height: 100, close: vi.fn() })));
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:local-crop"), revokeObjectURL: vi.fn() });
  await act(async () => {
    Object.defineProperty(screen.getByLabelText(/プリントを撮る/), "files", { value: [new File(["photo"], "print.jpg", { type: "image/jpeg" })] });
    screen.getByLabelText(/プリントを撮る/).dispatchEvent(new Event("change", { bubbles: true }));
  });
  fireEvent.click(await screen.findByRole("button", { name: "囲みを作る" }));
  fireEvent.click(screen.getByRole("button", { name: "囲んだ問題を読み取る" }));
}

it("学級に入っているときは、承認キーが空でも案内を出さず、読み取りに承認キーのヘッダーを付けない", async () => {
  setApproverKey("");
  const fetchMock = withDemand(vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ problems: [{ templateId: "rika-moon", questionText: "月の形の問題", params: {}, approved: true }], unsupportedCount: 0, demandRecorded: false }), { status: 200 })));
  vi.stubGlobal("fetch", fetchMock);
  inWorkspace(<PrintHandoutPage />);
  expect(screen.queryByText("読み取りと配るには、画面の上の「承認キー」が要ります。")).toBeNull();
  await pickAndRead();
  await screen.findByRole("table", { name: "写真と見比べてください" });
  const read = fetchMock.mock.calls.find((call) => String(call[0]).endsWith("/api/v1/print/read"));
  expect((read?.[1] as RequestInit).headers).toEqual({});
});

it("学級に入っていないときは、承認キーが空だと案内を出す（今のまま）", () => {
  setApproverKey("");
  vi.stubGlobal("fetch", mockHandoutsFetch());
  render(<PrintHandoutPage />);
  expect(screen.getByText("読み取りと配るには、画面の上の「承認キー」が要ります。")).toBeTruthy();
});

it("読み取りが 429 のときは、server の文をそのまま出す", async () => {
  const message = "今日の読み取りの回数を使い切りました。あしたまた使えます";
  vi.stubGlobal("fetch", withDemand(vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "RATE_LIMITED", message } }), { status: 429 }))));
  inWorkspace(<PrintHandoutPage />);
  await pickAndRead();
  expect(await screen.findByText(message)).toBeTruthy();
});

it("読み取りが 1 分の上限（scope が minute）のときは、待つ秒数を先生向けの文で出す", async () => {
  vi.stubGlobal("fetch", withDemand(vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "RATE_LIMITED", message: "少し休んでから、もういちど押してね", scope: "minute", retryAfterSeconds: 42 } }), { status: 429 }))));
  inWorkspace(<PrintHandoutPage />);
  await pickAndRead();
  expect(await screen.findByText("続けて読み取りすぎました。あと 42 秒待ってから、もう一度押してください")).toBeTruthy();
  expect(screen.queryByText("少し休んでから、もういちど押してね")).toBeNull();
});

it("対応していないプリント（PRINT_NOT_SUPPORTED）は、読めなかったときの文にせず、撮り直しを促さない", async () => {
  vi.stubGlobal("fetch", withDemand(vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "PRINT_NOT_SUPPORTED", message: "この問題の せつめいは、まだ ありません", demandRecorded: true } }), { status: 422 }))));
  inWorkspace(<PrintHandoutPage />);
  await pickAndRead();
  expect(await screen.findByText("この写真の問題には、まだ動く説明がありません。撮り直しても変わりません。どの単元かを数えて、クラスの画面に出します。")).toBeTruthy();
  expect(screen.queryByText(/読みこめませんでした/)).toBeNull();
});

it("読めなかったプリント（PRINT_UNREADABLE）は、今までどおり撮り直しを促す", async () => {
  vi.stubGlobal("fetch", withDemand(vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "PRINT_UNREADABLE", message: "x" } }), { status: 422 }))));
  inWorkspace(<PrintHandoutPage />);
  await pickAndRead();
  expect(await screen.findByText("読みこめませんでした。写真を確かめて、もう一度お試しください。")).toBeTruthy();
});

it("分数の式は写真と並べて出し、5 つの値を直せる。範囲の外に直すと理由が出て配れない", async () => {
  const fraction = { templateId: "sansu-fraction-addsub", questionText: "1/2 + 1/3", params: { left: { num: 1, den: 2 }, op: "+", right: { num: 1, den: 3 } }, approved: true };
  const sequence = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ problems: [fraction], unsupportedCount: 0, demandRecorded: false }), { status: 200 }))
    .mockResolvedValueOnce(new Response("{}", { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }));
  const fetchMock = withDemand(sequence);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 100, height: 100, close: vi.fn() })));
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:local-crop"), revokeObjectURL: vi.fn() });
  render(<PrintHandoutPage />);
  const file = new File(["photo"], "print.jpg", { type: "image/jpeg" });
  await act(async () => {
    Object.defineProperty(screen.getByLabelText(/プリントを撮る/), "files", { value: [file] });
    screen.getByLabelText(/プリントを撮る/).dispatchEvent(new Event("change", { bubbles: true }));
  });
  await screen.findByRole("button", { name: "囲みを作る" });
  fireEvent.click(screen.getByRole("button", { name: "囲みを作る" }));
  fireEvent.click(screen.getByRole("button", { name: "囲んだ問題を読み取る" }));

  expect((await screen.findByRole("img", { name: "読み取った問題の写真" })).getAttribute("src")).toBe("blob:local-crop");
  expect(screen.getByLabelText("読み取った式").textContent).toBe("1/2 + 1/3");
  for (const label of ["左の分子", "左の分母", "記号", "右の分子", "右の分母"]) expect(screen.getByLabelText(label)).toBeTruthy();
  expect(screen.queryByLabelText("説明に使う数")).toBeNull();

  // 範囲の外（分母 7 と 11 は通分した分母が 24 を超える）に直すと、理由が出て配れない
  fireEvent.change(screen.getByLabelText("左の分母"), { target: { value: "7" } });
  fireEvent.change(screen.getByLabelText("右の分母"), { target: { value: "11" } });
  expect(screen.getByLabelText("読み取った式").textContent).toBe("1/7 + 1/11");
  expect(screen.getByRole("alert").textContent).toContain("通分した分母");
  fireEvent.click(screen.getByLabelText("写真と数を確かめました"));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /確かめた/ })); });
  expect(fetchMock.mock.calls.some((call) => call[1]?.method === "POST" && String(call[0]).endsWith("/api/v1/print/handouts"))).toBe(false);

  // 範囲の中に直し、ひき算にすると、直した値で配れる
  fireEvent.change(screen.getByLabelText("左の分母"), { target: { value: "4" } });
  fireEvent.change(screen.getByLabelText("左の分子"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("右の分母"), { target: { value: "6" } });
  fireEvent.change(screen.getByLabelText("記号"), { target: { value: "-" } });
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByLabelText("写真と数を確かめました"));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /確かめた/ })); });
  const post = fetchMock.mock.calls.find((call) => call[1]?.method === "POST" && String(call[0]).endsWith("/api/v1/print/handouts"));
  expect(JSON.parse((post?.[1] as RequestInit).body as string)).toEqual({ templateId: "sansu-fraction-addsub", questionText: "3/4 - 1/6", params: { left: { num: 3, den: 4 }, op: "-", right: { num: 1, den: 6 } } });
});

it("写真全体から3問を読み、型ごとの確認と編集解除を反映して失敗後も配り続ける", async () => {
  const result = { problems: [
    { templateId: "rika-lever", questionText: "てこの問題", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } }, approved: true },
    { templateId: "rika-moon", questionText: "月の問題", params: {}, approved: true },
    { templateId: "sansu-fraction-addsub", questionText: "1/2 + 1/3", params: { left: { num: 1, den: 2 }, op: "+", right: { num: 1, den: 3 } }, approved: true },
  ], unsupportedCount: 0, demandRecorded: false };
  const sequence = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(result), { status: 200 }))
    .mockResolvedValueOnce(new Response("failed", { status: 500 }))
    .mockResolvedValueOnce(new Response("{}", { status: 201 }));
  const fetchMock = withDemand(sequence);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 100, height: 100, close: vi.fn() })));
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:whole-photo"), revokeObjectURL: vi.fn() });
  const context = { drawImage: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["scaled"], { type: "image/jpeg" })));
  render(<PrintHandoutPage />);
  const input = screen.getByLabelText(/プリントを撮る/);
  await act(async () => {
    Object.defineProperty(input, "files", { value: [new File(["photo"], "print.jpg", { type: "image/jpeg" })] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  fireEvent.click(await screen.findByRole("button", { name: "この写真を読み取る" }));
  expect(await screen.findByRole("heading", { name: "てこ" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "月" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "分数" })).toBeTruthy();
  const checks = screen.getAllByLabelText("写真と数を確かめました") as HTMLInputElement[];
  expect(checks.map((check) => check.checked)).toEqual([true, true, false]);
  fireEvent.change(screen.getByLabelText("左の重さ"), { target: { value: "60" } });
  expect((screen.getAllByLabelText("写真と数を確かめました") as HTMLInputElement[])[0]!.checked).toBe(false);
  fireEvent.click(screen.getAllByLabelText("写真と数を確かめました")[0]!);
  const deliver = screen.getByRole("button", { name: "確かめた 2 問を配る" });
  await act(async () => { fireEvent.click(deliver); });
  const posts = fetchMock.mock.calls.filter((call) => call[1]?.method === "POST" && String(call[0]).endsWith("/api/v1/print/handouts"));
  expect(posts).toHaveLength(2);
  expect(await screen.findByText("1 問を配りました。1 問は配れませんでした")).toBeTruthy();
  expect(screen.getByText("てこの問題")).toBeTruthy();
});

// #374：「取り下げる」は確認の枠を出してから送る（D-11 と同じ形）
it("「取り下げる」を押しても、確認の枠で「取り下げる」を押すまで消さない。「やめる」で閉じる", async () => {
  const fetchMock = withDemand(vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => init?.method === "DELETE"
    ? new Response(null, { status: 204 })
    : new Response(JSON.stringify({ items: [{ id: "handout-1", templateId: "rika-moon", questionText: "月の形が日によって変わるのはなぜ？", params: {}, createdAt: "2026-11-10T00:00:00.000Z" }] }), { status: 200 })));
  vi.stubGlobal("fetch", fetchMock);
  render(<PrintHandoutPage />);
  fireEvent.click(await screen.findByRole("button", { name: "取り下げる" }));
  const group = screen.getByRole("group", { name: "取り下げる" });
  expect(group.textContent).toContain("月の形が日によって変わるのはなぜ？");
  expect(fetchMock.mock.calls.some((call) => call[1]?.method === "DELETE")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "やめる" }));
  expect(screen.queryByRole("group", { name: "取り下げる" })).toBeNull();
  expect(fetchMock.mock.calls.some((call) => call[1]?.method === "DELETE")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "取り下げる" }));
  const confirm = screen.getByRole("group", { name: "取り下げる" });
  await act(async () => { fireEvent.click(within(confirm).getByRole("button", { name: "取り下げる" })); });
  expect(fetchMock.mock.calls.filter((call) => call[1]?.method === "DELETE")).toHaveLength(1);
  expect(String(fetchMock.mock.calls.find((call) => call[1]?.method === "DELETE")?.[0])).toBe("/api/v1/print/handouts/handout-1");
});

// #374：印刷する（window.print）
it("「印刷する」を押すと window.print を呼ぶ", async () => {
  const print = vi.fn();
  vi.stubGlobal("print", print);
  vi.stubGlobal("fetch", withDemand(vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }))));
  render(<PrintHandoutPage />);
  fireEvent.click(screen.getByRole("button", { name: "印刷する" }));
  expect(print).toHaveBeenCalledTimes(1);
});
