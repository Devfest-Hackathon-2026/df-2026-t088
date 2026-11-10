import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExplainCard } from "./ExplainCard";
import type { ReadProblem } from "./types";
import { getBgm } from "../../audio/use-bgm";

const lever: ReadProblem = {
  templateId: "rika-lever",
  approved: true,
  questionText: "左の 2 のめもりに 30g。右の 3 のめもりに何gつるすとつり合うか。",
  params: { left: { pos: 2, g: 30 }, right: { pos: 3 } },
};
const moon: ReadProblem = { templateId: "rika-moon", approved: false, questionText: "月の形", params: {} };

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const figureLabel = () => screen.getByRole("img", { name: /てこ|月は/ }).getAttribute("aria-label");

describe("説明のカード（てこ）", () => {
  it("説明の言語は確認済みの日本語だけを選べる", () => {
    render(<ExplainCard problem={lever} onRetake={vi.fn()} />);
    const language = screen.getByRole("combobox", { name: "説明の言語" }) as HTMLSelectElement;
    expect(Array.from(language.options).map((option) => option.value)).toEqual(["ja"]);
    expect(language.value).toBe("ja");
  });

  it("選択肢は答えと ±10g を小さい順に出し、承認の札を出す", () => {
    render(<ExplainCard problem={lever} onRetake={vi.fn()} />);
    const names = screen.getAllByRole("button").map((b) => b.textContent);
    expect(names.slice(0, 3)).toEqual(["10g", "20g", "30g"]);
    expect(screen.getByText(/承認/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("てこ");
  });

  it("approved が false なら承認の札を出さない", () => {
    render(<ExplainCard problem={{ ...lever, approved: false }} onRetake={vi.fn()} />);
    expect(screen.queryByText(/承認/)).toBeNull();
  });

  it("軽すぎ・重すぎは一言を出して進まず、合う重さで手順 2 へ、外へずらして終わる", () => {
    render(<ExplainCard problem={lever} onRetake={vi.fn()} />);
    const before = figureLabel();
    click("10g");
    expect(screen.getByRole("status").textContent).toContain("左が 下がっています");
    expect(screen.getByText(/手順 1 \/ 2/)).toBeTruthy();
    expect(figureLabel()).not.toBe(before);
    click("30g");
    expect(screen.getByRole("status").textContent).toContain("右が 下がっています");
    expect(screen.getByText(/手順 1 \/ 2/)).toBeTruthy();
    click("20g");
    expect(screen.getByText(/手順 2 \/ 2/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("1つ");
    expect(figureLabel()).toContain("つり合っています");
    click("外へ ずらす");
    expect(screen.getByText("わかったこと")).toBeTruthy();
    expect(screen.getByText(/つり合います/)).toBeTruthy();
    expect(figureLabel()).toContain("右に かたむいています");
    expect(screen.getByText("はじめから")).toBeTruthy();
  });

  it("読みとりに「重さ × めもり = 積」を出す", () => {
    render(<ExplainCard problem={lever} onRetake={vi.fn()} />);
    expect(screen.getByText("30 × 2 = 60")).toBeTruthy();
    expect(screen.getByText("?")).toBeTruthy();
    click("20g");
    expect(screen.getByText("20 × 3 = 60")).toBeTruthy();
  });

  it("最初の間違いを学びの輪へ送り、承認済みヒントを結果の下に出す", async () => {
    vi.stubEnv("VITE_LOOP_SEND", "on");
    const calls: { url: string; method: string; body?: string }[] = [];
    vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body?.toString() });
      if (method === "POST") return new Response("{}", { status: 201 });
      return new Response(JSON.stringify({ items: [{ pattern: "lever-same-weight", replacesHintIndex: 0, hint: "先生が選んだ、きょりを見直すヒント" }] }), { status: 200 });
    });
    render(<ExplainCard problem={lever} onRetake={vi.fn()} />);
    click("30g");
    await waitFor(() => expect(screen.getByText("先生が選んだ、きょりを見直すヒント")).toBeTruthy());
    expect(screen.getByText("先生が選んだヒント")).toBeTruthy();
    expect(calls.filter(({ method }) => method === "POST")).toHaveLength(1);
    expect(JSON.parse(calls.find(({ method }) => method === "POST")?.body ?? "{}")).toMatchObject({
      chapterId: "rika", lessonKey: "print:rika-lever", problem: "左2-30g-右3", pattern: "lever-same-weight", source: "demo",
    });
    const approvedUrl = new URL(calls.find(({ method }) => method === "GET")?.url ?? "", "http://x");
    expect(approvedUrl.pathname).toBe("/api/v1/approved-hints");
    expect(Object.fromEntries(approvedUrl.searchParams)).toEqual({ lessonKey: "print:rika-lever", problem: "左2-30g-右3", pattern: "lever-same-weight" });
    click("10g");
    expect(calls.filter(({ method }) => method === "POST")).toHaveLength(1);
  });

  it("承認済みヒントが無いときは規則表のヒントを出す", async () => {
    vi.stubEnv("VITE_LOOP_SEND", "on");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    render(<ExplainCard problem={lever} onRetake={vi.fn()} />);
    click("30g");
    expect(await screen.findByText("左と右では、支点からのきょりがちがうよ。重さ × きょりで比べよう")).toBeTruthy();
    expect(screen.queryByText("先生が選んだヒント")).toBeNull();
  });

  it("最初の間違いが分類できない形でも、同じ問題では記録を重ねない", () => {
    vi.stubEnv("VITE_LOOP_SEND", "on");
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_input: string, init?: RequestInit) => {
      calls.push(init ?? {});
      return new Response("{}", { status: 201 });
    });
    render(<ExplainCard problem={lever} onRetake={vi.fn()} />);
    click("10g");
    click("30g");
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("正解したら、間違いのヒントを消す", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    render(<ExplainCard problem={lever} onRetake={vi.fn()} />);
    click("30g");
    expect(await screen.findByText("左と右では、支点からのきょりがちがうよ。重さ × きょりで比べよう")).toBeTruthy();
    click("20g");
    expect(screen.queryByText("左と右では、支点からのきょりがちがうよ。重さ × きょりで比べよう")).toBeNull();
  });

  it("onRetake を渡さない（配られた説明）ときは「とりなおす」を出さない", () => {
    render(<ExplainCard problem={lever} />);
    expect(screen.queryByRole("button", { name: "とりなおす" })).toBeNull();
  });

  it("とりなおすで onRetake を呼ぶ", () => {
    const onRetake = vi.fn();
    render(<ExplainCard problem={lever} onRetake={onRetake} />);
    click("とりなおす");
    expect(onRetake).toHaveBeenCalledOnce();
  });
});

describe("説明のカード（月）", () => {
  it("月を押すだけで 3 手順を終え、結論を出す。図の名前も変わる", () => {
    render(<ExplainCard problem={moon} onRetake={vi.fn()} />);
    expect(screen.queryByText(/承認/)).toBeNull();
    expect(figureLabel()).toContain("横");
    click("月を まわす");
    expect(screen.getByText(/手順 2 \/ 3/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("ぜんぶ 地球を 向いています");
    expect(figureLabel()).toContain("太陽と 反対");
    click("月を まわす");
    expect(screen.getByText(/手順 3 \/ 3/)).toBeTruthy();
    click("月を まわす");
    expect(screen.getByText("わかったこと")).toBeTruthy();
    expect(screen.getByText(/いつも 太陽の 側が 光っています/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("反対を 向いています");
  });
});

describe("さいせい", () => {
  beforeEach(() => { vi.useFakeTimers(); getBgm().setMuted(true); });
  afterEach(() => { vi.useRealTimers(); getBgm().setMuted(false); vi.unstubAllGlobals(); });

  it("最後まで進んで「はじめから」になり、押すと最初へ戻る", () => {
    render(<ExplainCard problem={moon} onRetake={vi.fn()} />);
    click("さいせい");
    expect(screen.getByRole("button", { name: "とめる" })).toBeTruthy();
    expect(screen.getByText(/手順 1 \/ 3/)).toBeTruthy();
    act(() => void vi.advanceTimersByTime(1820));
    expect(screen.getByText(/手順 2 \/ 3/)).toBeTruthy();
    act(() => void vi.advanceTimersByTime(1820));
    expect(screen.getByText(/手順 3 \/ 3/)).toBeTruthy();
    act(() => void vi.advanceTimersByTime(1820));
    expect(screen.getByText("わかったこと")).toBeTruthy();
    expect(screen.getByRole("button", { name: "はじめから" })).toBeTruthy();
    click("はじめから");
    expect(screen.queryByText("わかったこと")).toBeNull();
    expect(screen.getByText(/手順 1 \/ 3/)).toBeTruthy();
  });

  it("てこも最後まで進む", () => {
    render(<ExplainCard problem={lever} onRetake={vi.fn()} />);
    click("さいせい");
    act(() => void vi.advanceTimersByTime(1820));
    act(() => void vi.advanceTimersByTime(1820));
    expect(screen.getByText("わかったこと")).toBeTruthy();
  });

  it("図の操作を押すと止まる。とめるでも止まる", () => {
    render(<ExplainCard problem={moon} onRetake={vi.fn()} />);
    click("さいせい");
    click("すこし すすめる");
    expect(screen.getByRole("button", { name: "さいせい" })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(5000));
    expect(screen.queryByText("わかったこと")).toBeNull();
    click("さいせい");
    click("とめる");
    act(() => void vi.advanceTimersByTime(5000));
    expect(screen.queryByText("わかったこと")).toBeNull();
  });

  it("手順の声が終わるまで自動再生を進めない", () => {
    const audioInstances: MockAudio[] = [];
    class MockAudio {
      src: string;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play = vi.fn(() => Promise.resolve());
      pause = vi.fn();
      constructor(src: string) { this.src = src; audioInstances.push(this); }
    }
    vi.stubGlobal("Audio", MockAudio);
    getBgm().setMuted(false);
    render(<ExplainCard problem={moon} onRetake={vi.fn()} />);
    click("さいせい");
    expect(audioInstances[0].src).toContain("narration/moon-full.mp3");
    act(() => void vi.advanceTimersByTime(5000));
    expect(screen.getByText(/手順 1 \/ 3/)).toBeTruthy();
    act(() => audioInstances[0].onended?.());
    act(() => void vi.advanceTimersByTime(1820));
    expect(screen.getByText(/手順 2 \/ 3/)).toBeTruthy();
  });

  it("手動で次の手順に進むと前の声を止め、新しい手順の声を鳴らす", () => {
    const audioInstances: MockAudio[] = [];
    class MockAudio {
      src: string;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play = vi.fn(() => Promise.resolve());
      pause = vi.fn();
      constructor(src: string) { this.src = src; audioInstances.push(this); }
    }
    vi.stubGlobal("Audio", MockAudio);
    getBgm().setMuted(false);
    render(<ExplainCard problem={moon} onRetake={vi.fn()} />);
    click("さいせい");
    expect(audioInstances[0].src).toContain("narration/moon-full.mp3");
    click("月を まわす");
    expect(audioInstances[0].pause).toHaveBeenCalled();
    expect(audioInstances[1].src).toContain("narration/moon-half.mp3");
  });

  it("音声ファイルが無い時は待たずに再生を続ける", async () => {
    class MissingAudio {
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play = vi.fn(() => Promise.reject(new Error("音声ファイルがありません")));
      pause = vi.fn();
      constructor(_src: string) {}
    }
    vi.stubGlobal("Audio", MissingAudio);
    getBgm().setMuted(false);
    render(<ExplainCard problem={moon} onRetake={vi.fn()} />);
    click("さいせい");
    await act(async () => { await Promise.resolve(); });
    act(() => void vi.advanceTimersByTime(1820));
    expect(screen.getByText(/手順 2 \/ 3/)).toBeTruthy();
  });

  it("音を消している間は声を鳴らさず、説明を進める", () => {
    const playAudio = vi.fn(() => Promise.resolve());
    class MockAudio {
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      pause = vi.fn();
      play = playAudio;
      constructor(_src: string) {}
    }
    vi.stubGlobal("Audio", MockAudio);
    getBgm().setMuted(true);
    render(<ExplainCard problem={moon} onRetake={vi.fn()} />);
    click("さいせい");
    act(() => void vi.advanceTimersByTime(1820));
    expect(playAudio).not.toHaveBeenCalled();
    expect(screen.getByText(/手順 2 \/ 3/)).toBeTruthy();
    getBgm().setMuted(false);
  });
});
