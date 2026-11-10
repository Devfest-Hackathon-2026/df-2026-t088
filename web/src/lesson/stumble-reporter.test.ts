import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findLesson } from "./fraction-lessons";
import { createSession, showHint, submitAnswer, typeAnswer } from "./session";
import type { LessonSession } from "./session";
import { reportIfRecordable, reportPrintLeverWrong } from "./stumble-reporter";

type Sent = { url: string; body: Record<string, unknown> };
let sent: Sent[] = [];

const lessonOf = (id: string) => {
  const lesson = findLesson("fraction", id.startsWith("main-") ? { kind: "main", index: Number(id.slice(5)) } : id === "test" ? { kind: "test" } : { kind: "side", sideId: id });
  if (!lesson) throw new Error(`学習が無い: ${id}`);
  return lesson;
};

const answer = (session: LessonSession, text: string) => {
  const before = typeAnswer(session, text);
  return { before, after: submitAnswer(before) };
};

beforeEach(() => {
  sent = [];
  vi.stubEnv("VITE_LOOP_SEND", "on");
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)) });
    return new Response("{}", { status: 201 });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("reportIfRecordable", () => {
  it("ヒントもタイルも使わない 1 回目の間違いを、型つきで 1 件だけ送る", () => {
    const { before, after } = answer(createSession(lessonOf("main-6")), "2/7");
    reportIfRecordable(before, after);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe("/api/v1/stumbles");
    expect(sent[0]?.body).toMatchObject({ chapterId: "fraction", lessonKey: "main-6", problem: "1/3+1/4", hintsShown: 0, pattern: "sum-both", source: "demo" });
    expect(Object.keys(sent[0]?.body ?? {}).sort()).toEqual(["chapterId", "hintsShown", "lessonKey", "occurredAt", "pattern", "problem", "source"]);
  });

  it("送ったときは、宛先（問題の位置と型）を返し、送らなかったときは null を返す", () => {
    const sentCase = answer(createSession(lessonOf("main-6")), "2/7");
    expect(reportIfRecordable(sentCase.before, sentCase.after)).toEqual({ lessonKey: "main-6", problem: "1/3+1/4", problemIndex: 0, pattern: "sum-both" });
    const right = answer(createSession(lessonOf("main-6")), "7/12");
    expect(reportIfRecordable(right.before, right.after)).toBeNull();
    vi.stubEnv("VITE_LOOP_SEND", "");
    expect(reportIfRecordable(sentCase.before, sentCase.after)).toBeNull();
  });

  it("規則に合わない間違いは unclassified で送る", () => {
    const { before, after } = answer(createSession(lessonOf("main-6")), "1/5");
    reportIfRecordable(before, after);
    expect(sent[0]?.body.pattern).toBe("unclassified");
  });

  it("設定が on でなければ、何も送らない（既定は送らない）", () => {
    vi.stubEnv("VITE_LOOP_SEND", "");
    const { before, after } = answer(createSession(lessonOf("main-6")), "2/7");
    reportIfRecordable(before, after);
    expect(sent).toHaveLength(0);
  });

  it("正解や、読めない答えは送らない", () => {
    const right = answer(createSession(lessonOf("main-6")), "7/12");
    reportIfRecordable(right.before, right.after);
    const unreadable = answer(createSession(lessonOf("main-6")), "たなか");
    reportIfRecordable(unreadable.before, unreadable.after);
    expect(sent).toHaveLength(0);
  });

  it("2 回目以降の間違いは送らない", () => {
    const first = answer(createSession(lessonOf("main-6")), "2/7");
    reportIfRecordable(first.before, first.after);
    const second = answer(first.after, "2/12");
    reportIfRecordable(second.before, second.after);
    expect(sent).toHaveLength(1);
  });

  it("ヒントを見たあとの間違いは送らない", () => {
    const withHint = showHint(createSession(lessonOf("main-6")));
    const { before, after } = answer(withHint, "2/7");
    reportIfRecordable(before, after);
    expect(sent).toHaveLength(0);
  });

  it("計算の問題でなければ送らない（約分の問題）", () => {
    const { before, after } = answer(createSession(lessonOf("main-3")), "1/3");
    reportIfRecordable(before, after);
    expect(sent).toHaveLength(0);
  });

  it("タイルを先に開く学習の間違いは送らない", () => {
    const base = createSession(lessonOf("main-6"));
    const before = typeAnswer({ ...base, lesson: { ...base.lesson, isTilesFirst: true } }, "2/7");
    reportIfRecordable(before, { ...before, message: "wrongToTiles", rejectedAnswer: "2/7" });
    expect(sent).toHaveLength(0);
  });

  it("送れなくても、例外にしない", () => {
    vi.stubGlobal("fetch", async () => { throw new TypeError("network"); });
    const { before, after } = answer(createSession(lessonOf("main-6")), "2/7");
    expect(() => reportIfRecordable(before, after)).not.toThrow();
  });
});

describe("reportPrintLeverWrong", () => {
  it("送信設定が on のとき、数値だけの問題と型を送る", () => {
    const target = reportPrintLeverWrong({ left: { pos: 2, g: 40 }, right: { pos: 4 } }, 40);
    expect(target).toMatchObject({ lessonKey: "print:rika-lever", problem: "左2-40g-右4", pattern: "lever-same-weight" });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe("/api/v1/stumbles");
    expect(sent[0]?.body).toMatchObject({ chapterId: "rika", lessonKey: "print:rika-lever", problem: "左2-40g-右4", hintsShown: 0, pattern: "lever-same-weight", source: "demo" });
    expect(Object.keys(sent[0]?.body ?? {}).sort()).toEqual(["chapterId", "hintsShown", "lessonKey", "occurredAt", "pattern", "problem", "source"]);
  });

  it("配られた説明から開いたときは、handoutId を足して送る。学級の id は送らない", () => {
    const target = reportPrintLeverWrong({ left: { pos: 2, g: 40 }, right: { pos: 4 } }, 40, "handout-1");
    expect(target?.handoutId).toBe("handout-1");
    expect(sent[0]?.body.handoutId).toBe("handout-1");
    expect(Object.keys(sent[0]?.body ?? {}).sort()).toEqual(["chapterId", "handoutId", "hintsShown", "lessonKey", "occurredAt", "pattern", "problem", "source"]);
  });

  it("分類できない予想も unclassified で送る", () => {
    reportPrintLeverWrong({ left: { pos: 2, g: 40 }, right: { pos: 4 } }, 30);
    expect(sent[0]?.body.pattern).toBe("unclassified");
  });

  it("設定が on でなければ送らない", () => {
    vi.stubEnv("VITE_LOOP_SEND", "");
    expect(reportPrintLeverWrong({ left: { pos: 2, g: 40 }, right: { pos: 4 } }, 40)).toBeNull();
    expect(sent).toHaveLength(0);
  });
});
