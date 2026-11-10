import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyApprovedHints, loadApprovedHints } from "./approved-hints";
import { findLesson } from "./fraction-lessons";
import { currentProblem, createSession, showHint } from "./session";
import type { RecordTarget } from "./stumble-reporter";

const lesson = findLesson("fraction", { kind: "main", index: 6 });
if (!lesson) throw new Error("main-6 が無い");

const APPROVED = "分母がちがうときは、分母どうしをたさないよ。まず同じ大きさのタイルにそろえよう";
const target: RecordTarget = { lessonKey: "main-6", problem: "1/3+1/4", problemIndex: 0, pattern: "sum-both" };

describe("applyApprovedHints", () => {
  it("今の問題の、指定された番号のヒントだけを入れ替える", () => {
    const before = createSession(lesson);
    const after = applyApprovedHints(before, 0, [{ replacesHintIndex: 0, hint: APPROVED }]);
    const original = currentProblem(before).hints;
    expect(currentProblem(after).hints).toEqual([APPROVED, ...original.slice(1)]);
    expect(currentProblem(before).hints[0]).not.toBe(APPROVED);
    expect(after.lesson.problems[1]).toBe(before.lesson.problems[1]);
  });

  it("もう違う問題に進んでいたら、入れ替えない", () => {
    const before = createSession(lesson, 1);
    expect(applyApprovedHints(before, 0, [{ replacesHintIndex: 0, hint: APPROVED }])).toBe(before);
  });

  it("ヒントを 1 つでも見たあとは、見ている途中で文を変えない", () => {
    const before = showHint(createSession(lesson));
    expect(applyApprovedHints(before, 0, [{ replacesHintIndex: 0, hint: APPROVED }])).toBe(before);
  });

  it("ヒントの数より大きい番号や、空の一覧は何もしない", () => {
    const before = createSession(lesson);
    expect(applyApprovedHints(before, 0, [{ replacesHintIndex: 9, hint: APPROVED }])).toBe(before);
    expect(applyApprovedHints(before, 0, [])).toBe(before);
  });
});

describe("loadApprovedHints", () => {
  let requested: string[] = [];
  const reply = (body: unknown, status = 200) => async (url: string) => {
    requested.push(url);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };

  beforeEach(() => { requested = []; });
  afterEach(() => vi.unstubAllGlobals());

  it("問題と型を付けて読み、正しい形のものだけを返す", async () => {
    vi.stubGlobal("fetch", reply({ items: [{ pattern: "sum-both", replacesHintIndex: 0, hint: APPROVED }] }));
    expect(await loadApprovedHints(target)).toEqual([{ replacesHintIndex: 0, hint: APPROVED }]);
    const url = new URL(requested[0] ?? "", "http://x");
    expect(url.pathname).toBe("/api/v1/approved-hints");
    expect(Object.fromEntries(url.searchParams)).toEqual({ lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both" });
    expect(requested[0]).toContain("%2B");
  });

  it("配られた説明から開いたときは、handoutId を付けて読む。無いときは付けない", async () => {
    vi.stubGlobal("fetch", reply({ items: [] }));
    await loadApprovedHints({ ...target, handoutId: "handout-1" });
    await loadApprovedHints(target);
    expect(Object.fromEntries(new URL(requested[0] ?? "", "http://x").searchParams)).toEqual({ lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", handoutId: "handout-1" });
    expect(new URL(requested[1] ?? "", "http://x").searchParams.has("handoutId")).toBe(false);
  });

  it("プリントのてこも問題と型を付けて承認済みヒントを読む", async () => {
    const leverTarget: RecordTarget = { lessonKey: "print:rika-lever", problem: "左2-30g-右3", problemIndex: 0, pattern: "lever-same-weight" };
    vi.stubGlobal("fetch", reply({ items: [{ pattern: "lever-same-weight", replacesHintIndex: 0, hint: APPROVED }] }));
    expect(await loadApprovedHints(leverTarget)).toEqual([{ replacesHintIndex: 0, hint: APPROVED }]);
    const url = new URL(requested[0] ?? "", "http://x");
    expect(Object.fromEntries(url.searchParams)).toEqual({ lessonKey: "print:rika-lever", problem: "左2-30g-右3", pattern: "lever-same-weight" });
  });

  it("分類できなかった型では、読みに行かない", async () => {
    vi.stubGlobal("fetch", reply({ items: [] }));
    expect(await loadApprovedHints({ ...target, pattern: "unclassified" })).toEqual([]);
    expect(requested).toHaveLength(0);
  });

  it("子どもの画面に出す文は検査する。数字を含む、長すぎる、文でない、番号が範囲外のものは捨てる", async () => {
    vi.stubGlobal("fetch", reply({
      items: [
        { replacesHintIndex: 0, hint: "答えは 7/12 です" },
        { replacesHintIndex: 0, hint: "答えは１２分の７です" },
        { replacesHintIndex: 0, hint: "答えは十二分の七です" },
        { replacesHintIndex: 0, hint: "ここを見てね https://example.com/x" },
        { replacesHintIndex: 0, hint: "ここを見てね www.example.com" },
        { replacesHintIndex: 0, hint: "あ".repeat(81) },
        { replacesHintIndex: 0, hint: "   " },
        { replacesHintIndex: 0, hint: 42 },
        { replacesHintIndex: 5, hint: APPROVED },
        { replacesHintIndex: 1.5, hint: APPROVED },
        { replacesHintIndex: 1, hint: "  ちゃんとした文  " },
      ],
    }));
    expect(await loadApprovedHints(target)).toEqual([{ replacesHintIndex: 1, hint: "ちゃんとした文" }]);
  });

  it("失敗、形の違う返事は、空にする（例外にしない）", async () => {
    vi.stubGlobal("fetch", reply({ error: { code: "ADULT_INVALID_REQUEST" } }, 400));
    expect(await loadApprovedHints(target)).toEqual([]);
    vi.stubGlobal("fetch", reply({ items: "none" }));
    expect(await loadApprovedHints(target)).toEqual([]);
    vi.stubGlobal("fetch", async () => { throw new TypeError("network"); });
    expect(await loadApprovedHints(target)).toEqual([]);
  });
});
