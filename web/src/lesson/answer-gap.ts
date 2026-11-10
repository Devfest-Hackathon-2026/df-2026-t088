// まちがえた答えと、問題の大きさのずれ。図にして見くらべるための値だけを出し、答えの値は画面に書かない
import { compareFractions } from "./fraction";
import type { Fraction } from "./fraction";
import { readAnswer } from "./judge";
import { currentProblem } from "./session";
import type { LessonMessage, LessonSession } from "./session";

/** 大きすぎる答えでも図が細くなりすぎないように、問題の大きさから先はこの数の整数までで切る */
export const GAP_EXTRA_WHOLES = 2;

// 値がちがった時だけ。約分が足りない（同じ大きさ）や、読めない答えは図にしない
const WRONG_MESSAGES: ReadonlySet<LessonMessage> = new Set<LessonMessage>(["wrong", "wrongToTiles", "wrongToHints", "wrongInReview"]);

export interface AnswerGap {
  /** 本人の答え */
  answer: Fraction;
  /** 問題の大きさ。画面では値を書かず、長さだけで見せる */
  expected: Fraction;
  /** 図の目盛りの整数の数 */
  wholes: number;
  /** 答えが図の右端より先まである */
  isClipped: boolean;
  /** short は答えが小さい、long は大きい */
  direction: "short" | "long";
}

const valueOf = ({ num, den }: Fraction): number => num / den;

/** 図にできるずれ。計算と約分で、値のちがう分数を答えた時だけ返す */
export function answerGap(session: LessonSession): AnswerGap | null {
  const { message, rejectedAnswer } = session;
  if (message === null || !WRONG_MESSAGES.has(message) || rejectedAnswer === null) return null;
  const { kind } = currentProblem(session);
  if (kind !== "calculate" && kind !== "reduce") return null;
  const answer = readAnswer(rejectedAnswer);
  if (!answer) return null;
  const expected = session.game.problem.answer;
  const order = compareFractions(answer, expected);
  if (order === 0) return null;
  const expectedWholes = Math.max(1, Math.ceil(valueOf(expected)));
  const wholes = Math.min(Math.max(expectedWholes, Math.ceil(valueOf(answer))), expectedWholes + GAP_EXTRA_WHOLES);
  return { answer, expected, wholes, isClipped: valueOf(answer) > wholes, direction: order < 0 ? "short" : "long" };
}
