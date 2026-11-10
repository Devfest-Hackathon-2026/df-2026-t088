import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT_TIMEOUT_MS, MOCK_DELAY_MS, PrintReadError, readPrint, validateReadResponse } from "./api";
import okMock from "./mocks/ok.json";

const image = new Blob(["x"], { type: "image/jpeg" });
const lever = (left: { pos: number; g: number }, right: { pos: number }) => ({
  templateId: "rika-lever",
  questionText: "てこ",
  params: { left, right },
  approved: true,
});
const moon = { templateId: "rika-moon", questionText: "月", params: {}, approved: false };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const errorBody = (code: string, demandRecorded = false) => ({ error: { code, message: "x", demandRecorded } });

async function kindOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(PrintReadError);
    return (error as PrintReadError).kind;
  }
  throw new Error("失敗しなかった");
}

describe("見本（既定）", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    window.history.pushState({}, "", "/");
  });

  const run = async (mock?: string) => {
    window.history.pushState({}, "", mock ? `/?print-mock=${mock}` : "/");
    const promise = readPrint(image);
    const settled = promise.then(
      (v) => ({ v }),
      (e: unknown) => ({ e }),
    );
    await vi.advanceTimersByTimeAsync(MOCK_DELAY_MS);
    return settled;
  };

  it("ok（既定）は2問", async () => {
    const result = await run();
    expect(result).toEqual({ v: { problems: okMock.problems, unsupportedCount: 0, demandRecorded: false } });
  });

  it("partial はてこ1問と unsupportedCount 1", async () => {
    const result = (await run("partial")) as { v: { problems: unknown[]; unsupportedCount: number } };
    expect(result.v.problems).toHaveLength(1);
    expect(result.v.unsupportedCount).toBe(1);
  });

  it.each([
    ["unreadable", "unreadable"],
    ["unsupported", "not-supported"],
    ["busy", "unavailable"],
  ])("%s は %s", async (mock, kind) => {
    const result = (await run(mock)) as { e: PrintReadError };
    expect(result.e).toBeInstanceOf(PrintReadError);
    expect(result.e.kind).toBe(kind);
  });

  it("待つ間に signal で止めると AbortError", async () => {
    const controller = new AbortController();
    const promise = readPrint(image, controller.signal);
    const settled = promise.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(300);
    controller.abort();
    const error = await settled;
    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe("AbortError");
  });

  it("最初から止まっている signal も AbortError", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(readPrint(image, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("本物の API（VITE_PRINT_READ=api）", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_PRINT_READ", "api");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("image を multipart で POST し、成功の応答を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(okMock));
    vi.stubGlobal("fetch", fetchMock);
    const result = await readPrint(image);
    expect(result.problems).toHaveLength(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/print/read");
    expect(init.method).toBe("POST");
    expect((init.body as FormData).get("image")).toBeInstanceOf(Blob);
  });

  it("成功の demandRecorded 追加項目を読む", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      problems: [moon], unsupportedCount: 1, demandRecorded: true,
    })));
    expect(await readPrint(image)).toMatchObject({ unsupportedCount: 1, demandRecorded: true });
  });

  it.each([
    ["PRINT_UNREADABLE", 422, "unreadable"],
    ["IMAGE_INVALID", 400, "unreadable"],
    ["PRINT_NOT_SUPPORTED", 422, "not-supported"],
    ["AI_UNAVAILABLE", 503, "unavailable"],
    ["BUSY", 503, "unavailable"],
    ["INTERNAL", 500, "unavailable"],
    ["NANIKA_SHIRANAI", 500, "unavailable"],
    ["TIMEOUT", 504, "timeout"],
    ["RATE_LIMITED", 429, "rate"],
  ])("code %s は %s", async (code, status, kind) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(errorBody(code), status)));
    expect(await kindOf(readPrint(image))).toBe(kind);
  });

  it("422の需要記録フラグを PrintReadError に渡す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(errorBody("PRINT_NOT_SUPPORTED", true), 422)));
    const error = await readPrint(image).catch((value: unknown) => value);
    expect(error).toMatchObject({ kind: "not-supported", demandRecorded: true });
  });

  it("JSON として読めない応答は unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 502 })));
    expect(await kindOf(readPrint(image))).toBe("unavailable");
  });

  it("形が合わない応答は unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ hello: 1 })));
    expect(await kindOf(readPrint(image))).toBe("unavailable");
  });

  it("fetch が投げたら offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await kindOf(readPrint(image))).toBe("offline");
  });

  it("navigator.onLine が false なら送らずに offline", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(await kindOf(readPrint(image))).toBe("offline");
    expect(fetchMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("40 秒で timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("a", "AbortError"))))),
    );
    const kind = kindOf(readPrint(image));
    await vi.advanceTimersByTimeAsync(CLIENT_TIMEOUT_MS);
    expect(await kind).toBe("timeout");
  });

  it("呼び出し側が止めたら AbortError（PrintReadError にしない）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("a", "AbortError"))))),
    );
    const controller = new AbortController();
    const settled = readPrint(image, controller.signal).catch((e: unknown) => e);
    controller.abort();
    const error = await settled;
    expect(error).not.toBeInstanceOf(PrintReadError);
    expect((error as DOMException).name).toBe("AbortError");
  });
});

describe("成功の応答の検証", () => {
  it("範囲外のてこを落として unsupportedCount に足す", () => {
    const result = validateReadResponse({
      problems: [
        lever({ pos: 2, g: 30 }, { pos: 3 }),
        lever({ pos: 7, g: 30 }, { pos: 3 }), // めもりが範囲外
        lever({ pos: 2, g: 35 }, { pos: 3 }), // 10 刻みでない
        lever({ pos: 1, g: 30 }, { pos: 4 }), // 割り切れない
        lever({ pos: 6, g: 100 }, { pos: 1 }), // 答えが 100 を超える
        moon,
      ],
      unsupportedCount: 1,
    });
    expect(result.problems.map((p) => p.templateId)).toEqual(["rika-lever", "rika-moon"]);
    expect(result.unsupportedCount).toBe(5);
  });

  it("知らない templateId は落とす", () => {
    const result = validateReadResponse({ problems: [moon, { ...moon, templateId: "sansu-x" }], unsupportedCount: 0 });
    expect(result.problems).toHaveLength(1);
    expect(result.unsupportedCount).toBe(1);
  });

  it("7問目以降は unsupportedCount に数える", () => {
    const result = validateReadResponse({ problems: Array.from({ length: 8 }, () => moon), unsupportedCount: 0 });
    expect(result.problems).toHaveLength(6);
    expect(result.unsupportedCount).toBe(2);
  });

  it("全部落ちたら not-supported", () => {
    expect(() => validateReadResponse({ problems: [lever({ pos: 9, g: 30 }, { pos: 3 })], unsupportedCount: 0 })).toThrowError(
      expect.objectContaining({ kind: "not-supported" }),
    );
    expect(() => validateReadResponse({ problems: [], unsupportedCount: 0 })).toThrowError(expect.objectContaining({ kind: "not-supported" }));
  });

  it("problems が配列でない・unsupportedCount が整数でないなら unavailable", () => {
    expect(() => validateReadResponse({ problems: "x", unsupportedCount: 0 })).toThrowError(expect.objectContaining({ kind: "unavailable" }));
    expect(() => validateReadResponse({ problems: [moon], unsupportedCount: -1 })).toThrowError(expect.objectContaining({ kind: "unavailable" }));
  });
});

describe("分数のたし算・ひき算の検査", () => {
  const fraction = (params: unknown, questionText = "1/2 + 1/3") => ({ templateId: "sansu-fraction-addsub", questionText, params, approved: true });
  const half = { left: { num: 1, den: 2 }, op: "+", right: { num: 1, den: 3 } };
  const validate = (problem: unknown) => validateReadResponse({ problems: [problem, moon], unsupportedCount: 0 });

  it("範囲の中で式が params と同じなら通す", () => {
    expect(validate(fraction(half)).problems[0]).toEqual(fraction(half));
  });

  it.each([
    ["範囲の外", fraction({ left: { num: 1, den: 7 }, op: "+", right: { num: 1, den: 11 } }, "1/7 + 1/11")],
    ["式と params が違う", fraction(half, "1/2 + 1/4")],
    ["余計な項目", fraction({ ...half, extra: 1 })],
  ])("落として unsupportedCount に数える: %s", (_label, problem) => {
    const result = validate(problem);
    expect(result.problems).toHaveLength(1);
    expect(result.unsupportedCount).toBe(1);
  });

  it("見本 fraction は分数 1 問とてこ 1 問", async () => {
    vi.useFakeTimers();
    window.history.pushState({}, "", "/?print-mock=fraction");
    const promise = readPrint(image);
    await vi.advanceTimersByTimeAsync(MOCK_DELAY_MS);
    const result = await promise;
    vi.useRealTimers();
    window.history.pushState({}, "", "/");
    expect(result.problems.map((problem) => problem.templateId)).toEqual(["sansu-fraction-addsub", "rika-lever"]);
  });
});

describe("学級コードで撮る子ども（#485）", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_PRINT_READ", "api");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("学級コードを x-class-code に付けて送り、返った handoutId を問題に残す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ problems: [{ ...moon, handoutId: "h-1" }, { ...moon, handoutId: "bad id/*" }], unsupportedCount: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await readPrint(image, undefined, "AB23CD");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toEqual({ "x-class-code": "AB23CD" });
    expect(result.problems.map((problem) => problem.handoutId)).toEqual(["h-1", undefined]);
  });

  it("学級コードが無いときは、ヘッダーを付けない", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ problems: [moon], unsupportedCount: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    await readPrint(image);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toBeUndefined();
  });

  it("401 は学級が切っている（closed）。今日の上限は daily、少し待てば直る上限は rate", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(errorBody("UNAUTHORIZED"), 401)));
    expect(await kindOf(readPrint(image, undefined, "AB23CD"))).toBe("closed");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: { code: "RATE_LIMITED", message: "x", scope: "day" } }, 429)));
    expect(await kindOf(readPrint(image, undefined, "AB23CD"))).toBe("daily");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(errorBody("RATE_LIMITED"), 429)));
    expect(await kindOf(readPrint(image, undefined, "AB23CD"))).toBe("rate");
  });
});
