import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COPY } from "../../copy";
import { displayText } from "../../ruby-text";
import type { PrintReadResponse, ReadProblem } from "./types";
import { PrintReadError } from "./api";
import { PrintPage } from "./PrintPage";
import { cropToLasso } from "./capture";
import { readPrint } from "./api";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  readPrint: vi.fn(),
}));
vi.mock("./capture", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./capture")>()),
  cropToLasso: vi.fn(),
}));
vi.mock("./ExplainCard", () => ({
  ExplainCard: ({ problem, onRetake, headingRef }: { problem: ReadProblem; onRetake: () => void; headingRef?: React.Ref<HTMLHeadingElement> }) => (
    <section data-testid="card">
      <h2 ref={headingRef} tabIndex={-1}>{problem.questionText}</h2>
      <button type="button" onClick={onRetake}>card-retake</button>
    </section>
  ),
}));

const text = (value: string) => displayText(value, null);
const readMock = vi.mocked(readPrint);
const cropMock = vi.mocked(cropToLasso);

const BOX = { left: 0, top: 0, width: 500, height: 400, right: 500, bottom: 400, x: 0, y: 0, toJSON: () => ({}) };
const lever = (questionText: string): ReadProblem => ({ templateId: "rika-lever", questionText, approved: true, params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } });
const response = (n: number, unsupportedCount = 0): PrintReadResponse => ({ problems: Array.from({ length: n }, (_, i) => lever(`もんだい${i + 1}`)), unsupportedCount, demandRecorded: false });

let urlCount = 0;
const revoke = vi.fn();
const goHome = vi.fn();
const BLOB = new Blob(["jpeg"], { type: "image/jpeg" });

function mockWide(wide: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: wide && query.includes("768"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  urlCount = 0;
  URL.createObjectURL = vi.fn(() => `blob:u${++urlCount}`);
  URL.revokeObjectURL = revoke;
  globalThis.createImageBitmap = vi.fn(async () => ({ width: 1000, height: 800, close: vi.fn() })) as unknown as typeof createImageBitmap;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(BOX as DOMRect);
  cropMock.mockResolvedValue(BLOB);
  readMock.mockResolvedValue(response(2));
  mockWide(false);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  // @ts-expect-error テストの後始末
  delete window.matchMedia;
});

async function pickPhoto(view: ReturnType<typeof render>, input: "camera" | "album" = "camera") {
  const el = view.container.querySelector(input === "camera" ? "input[capture]" : "input[type=file]:not([capture])") as HTMLInputElement;
  await act(async () => {
    fireEvent.change(el, { target: { files: [new File(["x"], "p.jpg", { type: "image/jpeg" })] } });
  });
  await screen.findByRole("group", { name: text(COPY.CP_875) });
}

function drawBox(view: ReturnType<typeof render>) {
  const svg = view.container.querySelector(".lasso__svg") as Element;
  const opt = { pointerId: 1, pointerType: "touch", button: 0 };
  fireEvent.pointerDown(svg, { ...opt, clientX: 50, clientY: 50 });
  fireEvent.pointerMove(svg, { ...opt, clientX: 400, clientY: 50 });
  fireEvent.pointerMove(svg, { ...opt, clientX: 400, clientY: 300 });
  fireEvent.pointerMove(svg, { ...opt, clientX: 50, clientY: 300 });
  fireEvent.pointerUp(svg, opt);
}

const click = (name: string) => fireEvent.click(screen.getByRole("button", { name: text(name) }));

/** 写真を選んで、囲んで、おくる まで進める */
async function sendFlow(view: ReturnType<typeof render>) {
  await pickPhoto(view);
  drawBox(view);
  click(COPY.CP_869);
}

describe("PrintPage とる", () => {
  it("2つのボタンと、capture の有る無しが違う input を出す", () => {
    const view = render(<PrintPage onGoHome={goHome} />);
    expect(screen.getByRole("heading", { level: 1, name: text(COPY.CP_860) })).toBeTruthy();
    expect(screen.getByRole("button", { name: text(COPY.CP_865) })).toBeTruthy();
    expect(screen.getByRole("button", { name: text(COPY.CP_866) })).toBeTruthy();
    expect(view.container.querySelector("input[capture=environment]")).not.toBeNull();
    expect(view.container.querySelectorAll("input[type=file]")).toHaveLength(2);
  });

  it("押すと対応する input の click が呼ばれる", () => {
    const view = render(<PrintPage onGoHome={goHome} />);
    const camera = view.container.querySelector("input[capture]") as HTMLInputElement;
    const album = view.container.querySelector("input[type=file]:not([capture])") as HTMLInputElement;
    const cameraClick = vi.spyOn(camera, "click");
    const albumClick = vi.spyOn(album, "click");
    click(COPY.CP_865);
    expect(cameraClick).toHaveBeenCalled();
    click(COPY.CP_866);
    expect(albumClick).toHaveBeenCalled();
  });

  it("写真を選ぶと かこむ へ進む（段の表示も変わる）", async () => {
    const view = render(<PrintPage onGoHome={goHome} />);
    await pickPhoto(view, "album");
    expect(screen.getByRole("button", { name: text(COPY.CP_869) })).toBeTruthy();
    expect(screen.getByText(text(COPY.CP_862.announce(2, "かこむ")))).toBeTruthy();
  });

  it("写真が読めない時は CP-879 を出して とる に残る", async () => {
    globalThis.createImageBitmap = vi.fn(async () => { throw new Error("bad"); }) as unknown as typeof createImageBitmap;
    const view = render(<PrintPage onGoHome={goHome} />);
    const el = view.container.querySelector("input[capture]") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(el, { target: { files: [new File(["x"], "p.jpg")] } });
    });
    expect((await screen.findByRole("alert")).textContent).toBe(text(COPY.CP_879));
    expect(revoke).toHaveBeenCalledWith("blob:u1");
  });
});

describe("PrintPage かこむ", () => {
  it("線が無いまま おくる → CP-873（role=alert）", async () => {
    const view = render(<PrintPage onGoHome={goHome} />);
    await pickPhoto(view);
    click(COPY.CP_869);
    expect(screen.getByRole("alert").textContent).toBe(text(COPY.CP_873));
    expect(readMock).not.toHaveBeenCalled();
  });

  it("小さすぎる囲み → CP-874", async () => {
    const view = render(<PrintPage onGoHome={goHome} />);
    await pickPhoto(view);
    const svg = view.container.querySelector(".lasso__svg") as Element;
    const opt = { pointerId: 1, pointerType: "touch", button: 0 };
    fireEvent.pointerDown(svg, { ...opt, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(svg, { ...opt, clientX: 70, clientY: 50 });
    fireEvent.pointerMove(svg, { ...opt, clientX: 70, clientY: 70 });
    fireEvent.pointerUp(svg, opt);
    click(COPY.CP_869);
    expect(screen.getByRole("alert").textContent).toBe(text(COPY.CP_874));
    expect(readMock).not.toHaveBeenCalled();
  });

  it("キーボードの Enter で四角を置いて送れる", async () => {
    const view = render(<PrintPage onGoHome={goHome} />);
    await pickPhoto(view);
    fireEvent.keyDown(screen.getByRole("group", { name: text(COPY.CP_875) }), { key: "Enter" });
    click(COPY.CP_869);
    await waitFor(() => expect(readMock).toHaveBeenCalledTimes(1));
    expect(cropMock).toHaveBeenCalledTimes(1);
    expect(cropMock.mock.calls[0][1]).toHaveLength(4);
  });

  it("線が無い時に写真を1回押すと四角を置いて送れる（読み上げのダブルタップ。D-204）", async () => {
    const view = render(<PrintPage onGoHome={goHome} />);
    await pickPhoto(view);
    const svg = view.container.querySelector(".lasso__svg") as Element;
    const opt = { pointerId: 1, pointerType: "touch", button: 0 };
    fireEvent.pointerDown(svg, { ...opt, clientX: 200, clientY: 150 });
    fireEvent.pointerUp(svg, opt);
    click(COPY.CP_869);
    await waitFor(() => expect(readMock).toHaveBeenCalledTimes(1));
    expect(cropMock.mock.calls[0][1]).toHaveLength(4);
  });

  it("かきなおす で線が消え、おくる は CP-873 に戻る", async () => {
    const view = render(<PrintPage onGoHome={goHome} />);
    await pickPhoto(view);
    drawBox(view);
    expect(view.container.querySelector(".lasso__dim")).not.toBeNull();
    click(COPY.CP_870);
    expect(view.container.querySelector(".lasso__dim")).toBeNull();
    click(COPY.CP_869);
    expect(screen.getByRole("alert").textContent).toBe(text(COPY.CP_873));
  });

  it("とりなおす で写真を捨てて とる へ戻る", async () => {
    const view = render(<PrintPage onGoHome={goHome} />);
    await pickPhoto(view);
    click(COPY.CP_871);
    expect(revoke).toHaveBeenCalledWith("blob:u1");
    expect(screen.getByRole("button", { name: text(COPY.CP_865) })).toBeTruthy();
  });

  it("やめる で写真を捨てて onGoHome", async () => {
    const view = render(<PrintPage onGoHome={goHome} />);
    await pickPhoto(view);
    click(COPY.CP_872);
    expect(revoke).toHaveBeenCalledWith("blob:u1");
    expect(goHome).toHaveBeenCalledTimes(1);
  });

  it("← ホーム で写真を捨てて onGoHome", async () => {
    const view = render(<PrintPage onGoHome={goHome} />);
    await pickPhoto(view);
    fireEvent.click(screen.getByRole("button", { name: text(COPY.CP_760) }));
    expect(revoke).toHaveBeenCalledWith("blob:u1");
    expect(goHome).toHaveBeenCalledTimes(1);
  });

  it("画面を離れる（unmount）と写真を捨てる", async () => {
    const view = render(<PrintPage onGoHome={goHome} />);
    await pickPhoto(view);
    view.unmount();
    expect(revoke).toHaveBeenCalledWith("blob:u1");
  });
});

describe("PrintPage まつ・失敗", () => {
  it("まつ では縮小と CP-877・CP-878 を出し、やめる で かこむ へ戻って写真と線が残る", async () => {
    let signal: AbortSignal | undefined;
    readMock.mockImplementation((_blob, s) => new Promise((_, reject) => {
      signal = s;
      s?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    const view = render(<PrintPage onGoHome={goHome} />);
    await sendFlow(view);
    await screen.findByText(text(COPY.CP_877));
    expect(screen.getByText(text(COPY.CP_878))).toBeTruthy();
    click(COPY.CP_872);
    expect(signal?.aborted).toBe(true);
    // 切り抜きの URL（u2）は捨て、写真（u1）は残す
    expect(revoke).toHaveBeenCalledWith("blob:u2");
    expect(revoke).not.toHaveBeenCalledWith("blob:u1");
    expect(goHome).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: text(COPY.CP_875) })).toBeTruthy();
    expect(view.container.querySelector(".lasso__dim")).not.toBeNull();
    expect((view.container.querySelector(".lasso__img") as HTMLImageElement).getAttribute("src")).toBe("blob:u1");
  });

  it.each([
    ["unreadable", COPY.CP_879],
    ["not-supported", COPY.CP_880],
  ] as const)("%s は文と「とりなおす」だけ", async (kind, copy) => {
    readMock.mockRejectedValue(new PrintReadError(kind));
    const view = render(<PrintPage onGoHome={goHome} />);
    await sendFlow(view);
    expect((await screen.findByRole("alert")).textContent).toBe(text(copy));
    if (kind === "not-supported") expect(screen.queryByText("先生に、この単元の説明がほしいと伝わりました")).toBeNull();
    const retake = screen.getByRole("button", { name: text(COPY.CP_871) });
    expect(screen.queryByRole("button", { name: text(COPY.CP_885) })).toBeNull();
    expect(retake.className).toContain("button--primary");
    await waitFor(() => expect(document.activeElement).toBe(retake));
    fireEvent.click(retake);
    expect(screen.getByRole("button", { name: text(COPY.CP_865) })).toBeTruthy();
  });

  it("需要を数えたときだけ、型が無い文の下に先生へ伝わったと知らせる", async () => {
    readMock.mockRejectedValue(new PrintReadError("not-supported", true));
    const view = render(<PrintPage onGoHome={goHome} />);
    await sendFlow(view);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(text(COPY.CP_880));
    expect(alert.parentElement?.textContent).toContain("先生に、この単元の説明がほしいと伝わりました");
  });

  it.each([
    ["unavailable", COPY.CP_881],
    ["timeout", COPY.CP_882],
    ["rate", COPY.CP_884],
    ["offline", COPY.CP_883],
  ] as const)("%s は文と「もう一度 おくる」「とりなおす」", async (kind, copy) => {
    readMock.mockRejectedValue(new PrintReadError(kind));
    const view = render(<PrintPage onGoHome={goHome} />);
    await sendFlow(view);
    expect((await screen.findByRole("alert")).textContent).toBe(text(copy));
    const again = screen.getByRole("button", { name: text(COPY.CP_885) });
    expect(again.className).toContain("button--primary");
    expect(screen.getByRole("button", { name: text(COPY.CP_871) }).className).toContain("button--secondary");
    await waitFor(() => expect(document.activeElement).toBe(again));
  });

  it("もう一度 おくる は同じ Blob を送り直す", async () => {
    readMock.mockRejectedValueOnce(new PrintReadError("offline"));
    const view = render(<PrintPage onGoHome={goHome} />);
    await sendFlow(view);
    await screen.findByRole("alert");
    readMock.mockResolvedValueOnce(response(1));
    click(COPY.CP_885);
    await screen.findAllByTestId("card");
    expect(readMock).toHaveBeenCalledTimes(2);
    expect(readMock.mock.calls[1][0]).toBe(readMock.mock.calls[0][0]);
    expect(cropMock).toHaveBeenCalledTimes(1);
  });
});

describe("PrintPage せつめい", () => {
  it("成功すると写真と切り抜きを捨て、カードを問題の数だけ縦に出す（767px 以下）", async () => {
    readMock.mockResolvedValue(response(3));
    const view = render(<PrintPage onGoHome={goHome} />);
    await sendFlow(view);
    expect(await screen.findAllByTestId("card")).toHaveLength(3);
    expect(revoke).toHaveBeenCalledWith("blob:u1");
    expect(revoke).toHaveBeenCalledWith("blob:u2");
    expect(screen.queryByRole("button", { name: text(COPY.CP_887) })).toBeNull();
    expect(screen.queryByText(text(COPY.CP_886(1, 3)))).toBeNull();
    // 最後に「べつの プリントを とる」
    expect(screen.getByRole("button", { name: text(COPY.CP_896) })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "もんだい1" })));
  });

  it("べつの プリントを とる で とる へ戻る", async () => {
    const view = render(<PrintPage onGoHome={goHome} />);
    await sendFlow(view);
    await screen.findAllByTestId("card");
    click(COPY.CP_896);
    expect(screen.getByRole("button", { name: text(COPY.CP_865) })).toBeTruthy();
  });

  it("カードの とりなおし でも とる へ戻る", async () => {
    const view = render(<PrintPage onGoHome={goHome} />);
    await sendFlow(view);
    fireEvent.click((await screen.findAllByText("card-retake"))[0]);
    expect(screen.getByRole("button", { name: text(COPY.CP_865) })).toBeTruthy();
  });

  it("768px 以上は1枚ずつ。CP-886 と前後のボタンで入れ替え、最後は べつの プリントを とる", async () => {
    mockWide(true);
    readMock.mockResolvedValue(response(2));
    const view = render(<PrintPage onGoHome={goHome} />);
    await sendFlow(view);
    expect(await screen.findAllByTestId("card")).toHaveLength(1);
    expect(screen.getByText(text(COPY.CP_886(1, 2)))).toBeTruthy();
    expect(screen.queryByRole("button", { name: text(COPY.CP_888) })).toBeNull();
    click(COPY.CP_887);
    expect(screen.getByText(text(COPY.CP_886(2, 2)))).toBeTruthy();
    expect(screen.getByRole("heading", { name: "もんだい2" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "もんだい2" })));
    expect(screen.queryByRole("button", { name: text(COPY.CP_887) })).toBeNull();
    click(COPY.CP_888);
    expect(screen.getByRole("heading", { name: "もんだい1" })).toBeTruthy();
    click(COPY.CP_887);
    click(COPY.CP_896);
    expect(screen.getByRole("button", { name: text(COPY.CP_865) })).toBeTruthy();
  });

  it("1問だけなら CP-886 と前後のボタンを出さない（768px 以上）", async () => {
    mockWide(true);
    readMock.mockResolvedValue(response(1));
    const view = render(<PrintPage onGoHome={goHome} />);
    await sendFlow(view);
    await screen.findAllByTestId("card");
    expect(screen.queryByText(text(COPY.CP_886(1, 1)))).toBeNull();
    expect(screen.queryByRole("button", { name: text(COPY.CP_887) })).toBeNull();
    expect(screen.queryByRole("button", { name: text(COPY.CP_888) })).toBeNull();
  });

  it("unsupportedCount が 1 以上なら CP-895 を1行（role=status）", async () => {
    readMock.mockResolvedValue(response(2, 2));
    const view = render(<PrintPage onGoHome={goHome} />);
    await sendFlow(view);
    await screen.findAllByTestId("card");
    const note = screen.getByText(text(COPY.CP_895(2)));
    expect(note.getAttribute("role")).toBe("status");
  });

  it("分数の式は説明カードに出さず、対象外に数える", async () => {
    const fraction: ReadProblem = { templateId: "sansu-fraction-addsub", questionText: "1/2 + 1/3", approved: true, params: { left: { num: 1, den: 2 }, op: "+", right: { num: 1, den: 3 } } };
    readMock.mockResolvedValue({ problems: [fraction, lever("てこ")], unsupportedCount: 0, demandRecorded: false });
    const view = render(<PrintPage onGoHome={goHome} />);
    await sendFlow(view);
    expect(await screen.findAllByTestId("card")).toHaveLength(1);
    expect(screen.getByText(text(COPY.CP_895(1)))).toBeTruthy();
  });

  it("分数の式だけなら、まだ説明できない問題として扱う", async () => {
    const fraction: ReadProblem = { templateId: "sansu-fraction-addsub", questionText: "1/2 + 1/3", approved: true, params: { left: { num: 1, den: 2 }, op: "+", right: { num: 1, den: 3 } } };
    readMock.mockResolvedValue({ problems: [fraction], unsupportedCount: 0, demandRecorded: false });
    const view = render(<PrintPage onGoHome={goHome} />);
    await sendFlow(view);
    await waitFor(() => expect(screen.queryAllByTestId("card")).toHaveLength(0));
    expect(screen.getByRole("button", { name: text(COPY.CP_871) })).toBeTruthy();
  });

  it("unsupportedCount が 0 なら CP-895 を出さない", async () => {
    const view = render(<PrintPage onGoHome={goHome} />);
    await sendFlow(view);
    await screen.findAllByTestId("card");
    expect(screen.queryByText(text(COPY.CP_895(0)))).toBeNull();
  });
});
