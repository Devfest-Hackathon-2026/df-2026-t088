/** 教科に依存しない、選ぶ問題と入力する問題 */
export interface ChoiceProblem {
  kind: "choice";
  id: string;
  /** 読みを選ぶか、□に入る字を選ぶか */
  prompt: "reading" | "kanji";
  /** ふりがなを付ける前の語や文 */
  subject: string;
  choices: string[];
  answer: string;
  hints: string[];
}

export interface InputProblem {
  kind: "input";
  id: string;
  /** 入力問題では読みを答える */
  prompt: "reading";
  /** ふりがなを付ける前の語や文 */
  subject: string;
  answer: string;
  hints: string[];
}

export type QuizProblem = ChoiceProblem | InputProblem;

export interface QuizLesson {
  key: string;
  problems: QuizProblem[];
}

/** 答えの前後の空白を取り、全角・半角とカタカナをひらがなにそろえる */
export function normalizeAnswer(answer: string): string {
  return answer.normalize("NFKC").trim().replace(/[ァ-ヶ]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0x60),
  );
}

/** ひらがなと長音記号だけでできているか */
export const isKanaOnly = (answer: string): boolean => /^[ぁ-ゖゝゞー]+$/.test(answer);

export type QuizAnswerResult = "correct" | "wrong" | "notKana";

/** 入力を整えてから、かな以外を含むかと正誤を判定する */
export function judgeInput(answer: string, expected: string): QuizAnswerResult {
  const normalized = normalizeAnswer(answer);
  if (!isKanaOnly(normalized)) return "notKana";
  return normalized === normalizeAnswer(expected) ? "correct" : "wrong";
}
