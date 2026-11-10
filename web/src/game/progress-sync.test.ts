import { afterEach, describe, expect, it, vi } from "vitest";
import { changedSquares, reportProgress, sendProgress, SQUARES_PER_REQUEST } from "./progress-sync";

afterEach(() => vi.unstubAllGlobals());

describe("子どもの進みを送る（仮）", () => {
  it("終えた数が増えた章だけ、0 から終えた数までの位置を作る", () => {
    const previous = { integer: { done: 2 }, decimal: { done: 1 } };
    const next = { integer: { done: 3 }, decimal: { done: 1 }, fraction: { done: 2 }, empty: { done: 0 } };
    expect(changedSquares(previous, next)).toEqual([
      { chapterId: "integer", squares: [0, 1, 2] },
      { chapterId: "fraction", squares: [0, 1] },
    ]);
  });

  it("送る位置は 200 までに抑える（サーバの上限）", () => {
    const changed = changedSquares({}, { long: { done: 500 } });
    expect(changed[0]?.squares).toHaveLength(SQUARES_PER_REQUEST);
    expect(Math.max(...(changed[0]?.squares ?? []))).toBe(199);
  });

  it("番号は口（currentStudentNumber）から、章の id と位置だけを送る。答えや時間は入れない", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ received: true }), { status: 201 });
    });
    expect(await sendProgress("decimal", [0, 1], "A-03")).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.endsWith("/api/v1/student/progress")).toBe(true);
    expect((calls[0]?.init.headers as Record<string, string>)["x-student-number"]).toBe("A-03");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ chapterId: "decimal", squares: [0, 1] });
  });

  it("送れなくても投げない（学習の画面は止めない）", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("offline");
    });
    expect(await sendProgress("decimal", [0], "A-03")).toBe(false);
    expect(() => reportProgress({}, { decimal: { done: 1 } })).not.toThrow();
  });
});
