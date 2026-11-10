// 選ぶ・入れる問題の進行。画面や保存に依存しない純粋な関数だけを置く
import { judgeInput } from "./quiz";
import type { QuizLesson, QuizProblem } from "./quiz";

export type QuizMessage = "empty" | "wrong" | "notKana" | "correct";

export interface QuizSession {
  lesson: QuizLesson;
  problemIndex: number;
  answerText: string;
  /** 間違えて押せなくなった選択肢 */
  disabledChoices: string[];
  shownHints: number;
  /** 入力問題でヒントを使い切った後に答えを見せたか */
  isAnswerShown: boolean;
  message: QuizMessage | null;
  isCorrect: boolean;
  isCleared: boolean;
}

const problemAt = (lesson: QuizLesson, index: number): QuizProblem => lesson.problems[index] as QuizProblem;

/** 問題番号は保存から戻す時にも受け取る */
export function createSession(lesson: QuizLesson, problemIndex = 0): QuizSession {
  return {
    lesson,
    problemIndex,
    answerText: "",
    disabledChoices: [],
    shownHints: 0,
    isAnswerShown: false,
    message: null,
    isCorrect: false,
    isCleared: false,
  };
}

export const currentProblem = (session: QuizSession): QuizProblem => problemAt(session.lesson, session.problemIndex);

const isLastProblem = (session: QuizSession): boolean => session.problemIndex >= session.lesson.problems.length - 1;

function correct(session: QuizSession): QuizSession {
  return { ...session, isCorrect: true, isCleared: isLastProblem(session), message: "correct" };
}

export function typeAnswer(session: QuizSession, answerText: string): QuizSession {
  return session.isCorrect ? session : { ...session, answerText, message: null };
}

/** 選択肢を選ぶ。間違えた選択肢はその後押せない */
export function submitChoice(session: QuizSession, choice: string): QuizSession {
  const problem = currentProblem(session);
  if (session.isCorrect || problem.kind !== "choice" || !problem.choices.includes(choice) || session.disabledChoices.includes(choice)) return session;
  if (choice === problem.answer) return correct(session);
  return { ...session, disabledChoices: [...session.disabledChoices, choice], message: "wrong" };
}

/** 入力を判定する。かな以外なら状態だけを返し、文言は画面で出す */
export function submitAnswer(session: QuizSession): QuizSession {
  const problem = currentProblem(session);
  if (session.isCorrect || problem.kind !== "input") return session;
  if (!session.answerText.trim()) return { ...session, message: "empty" };
  const result = judgeInput(session.answerText, problem.answer);
  if (result === "correct") return correct(session);
  return { ...session, message: result };
}

/** 「分かんない」でヒントを1つ開く。入力問題は最後に答えも表示する */
export function pressHelp(session: QuizSession): QuizSession {
  if (session.isCorrect) return session;
  const problem = currentProblem(session);
  if (session.shownHints < problem.hints.length) return { ...session, shownHints: session.shownHints + 1, message: null };
  if (problem.kind === "input" && !session.isAnswerShown) return { ...session, isAnswerShown: true, message: null };
  return session;
}

export function nextProblem(session: QuizSession): QuizSession {
  return session.isCorrect && !session.isCleared ? createSession(session.lesson, session.problemIndex + 1) : session;
}
