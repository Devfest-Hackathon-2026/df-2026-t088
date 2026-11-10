import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KOKUGO_CHAPTERS } from "../../data/kokugo";
import type { Game } from "../../game/use-game";
import type { QuizLesson } from "../../lesson/quiz";
import { saveResume } from "../../game/lesson-resume";
import { QuizLessonPage } from "./QuizLessonPage";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterEach(() => vi.unstubAllGlobals());

// 試験専用の小さな問題表を使う。本番データ（kokugo-lessons.ts）は空のまま。
const SAMPLE_LESSON: QuizLesson = {
  key: "kokugo-kanji-5:main-0",
  problems: [
    { kind: "choice", id: "kokugo-kanji-5:main-0-1", prompt: "kanji", subject: "山道", choices: ["さんどう", "やまみち"], answer: "やまみち", hints: ["山の道です"] },
    { kind: "input", id: "kokugo-kanji-5:main-0-2", prompt: "reading", subject: "漢字", answer: "かんじ", hints: ["二字のことばです"] },
  ],
};

function renderQuiz(lesson = SAMPLE_LESSON) {
  const completeLesson = vi.fn(async () => {});
  const game = {
    state: { chapterId: "kokugo-kanji-5" },
    chapter: KOKUGO_CHAPTERS[0],
    chapterProgress: { done: 0, sides: [], test: false },
    wornGear: [],
    completeLesson,
  } as unknown as Game;
  render(<QuizLessonPage game={game} lessonKey="main-0" lesson={lesson} />);
  return { completeLesson };
}

describe("国語の学習画面", () => {
  it("途中の問題番号を学習 id で読み直す", () => {
    saveResume("kokugo-kanji-5:main-0", 1);
    renderQuiz();
    expect(screen.getByText("2 / 2 問")).toBeTruthy();
    expect(screen.getByText("漢字")).toBeTruthy();
  });

  it("CP の問いを出し、誤答を無効にしてヒントを順に開く", () => {
    renderQuiz();
    expect(screen.getByText("□に 入る 字は どれかな")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "さんどう" }));
    expect(screen.getByText(/ちがうみたいです/)).toBeTruthy();
    // disabled は使わない（CMP-001）。押せないことは aria-disabled で伝え、もう一度押しても何も変わらない
    const wrong = screen.getByRole("button", { name: "さんどう" });
    expect(wrong.getAttribute("aria-disabled")).toBe("true");
    expect(wrong.className).toContain("is-wrong");
    fireEvent.click(wrong);
    expect(screen.getByText(/ちがうみたいです/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "分かんない" }));
    expect(screen.getByText("山の道です")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "やまみち" }));
    fireEvent.click(screen.getByRole("button", { name: "つぎの問題へ" }));
    expect(screen.getByText("読みを ひらがなで 入れよう")).toBeTruthy();
  });

  it("入力ではかな以外を知らせ、Enter で答え、最後に completeLesson を呼ぶ", () => {
    const { completeLesson } = renderQuiz({ ...SAMPLE_LESSON, problems: [SAMPLE_LESSON.problems[1]!] });
    const input = screen.getByLabelText("ひらがなで入れましょう") as HTMLInputElement;
    expect(input.lang).toBe("ja");
    fireEvent.change(input, { target: { value: "kanji" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getAllByText("ひらがなで入れましょう").length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: "分かんない" }));
    expect(screen.getByText("二字のことばです")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "分かんない" }));
    expect(screen.getByText("かんじ").parentElement?.textContent).toBe("答えは「かんじ」です");
    fireEvent.change(input, { target: { value: "カンジ" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByRole("heading", { level: 2, name: "やったね" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "盤面にもどる" }));
    expect(completeLesson).toHaveBeenCalledWith({ kind: "main", index: 0 });
  });
});
