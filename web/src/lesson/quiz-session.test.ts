import { describe, expect, it } from "vitest";
import type { QuizLesson } from "./quiz";
import { createSession, nextProblem, pressHelp, submitAnswer, submitChoice, typeAnswer } from "./quiz-session";

const LESSON: QuizLesson = {
  key: "kokugo-kanji-5",
  problems: [
    { kind: "choice", id: "choice-1", prompt: "reading", subject: "学校", choices: ["がっこう", "がっこ", "がくこう"], answer: "がっこう", hints: ["「がく」と「こう」です"] },
    { kind: "input", id: "input-1", prompt: "reading", subject: "漢字", answer: "かんじ", hints: ["1字目は「かん」です"] },
  ],
};

describe("問題を進める", () => {
  it("間違えた選択肢を押せなくし、正解した後は次へ進む", () => {
    const wrong = submitChoice(createSession(LESSON), "がっこ");
    expect(wrong.disabledChoices).toEqual(["がっこ"]);
    expect(submitChoice(wrong, "がっこ")).toBe(wrong);
    const solved = submitChoice(wrong, "がっこう");
    expect(solved.isCorrect).toBe(true);
    expect(nextProblem(solved).problemIndex).toBe(1);
  });

  it("ヒントを順に開き、入力問題では最後に答えを見せられる", () => {
    let session = createSession(LESSON, 1);
    session = pressHelp(session);
    expect(session.shownHints).toBe(1);
    expect(session.isAnswerShown).toBe(false);
    session = pressHelp(session);
    expect(session.isAnswerShown).toBe(true);
    session = submitAnswer(typeAnswer(session, "かんじ"));
    expect(session.isCleared).toBe(true);
    expect(nextProblem(session)).toBe(session);
  });

  it("かな以外なら notKana 状態になり、途中の問題番号から戻せる", () => {
    const restored = createSession(LESSON, 1);
    const rejected = submitAnswer(typeAnswer(restored, "漢字"));
    expect(rejected.message).toBe("notKana");
    expect(rejected.isCorrect).toBe(false);
    expect(restored.problemIndex).toBe(1);
    expect(restored.answerText).toBe("");
  });
});
