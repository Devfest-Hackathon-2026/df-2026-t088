// 数の問題の答えの判定（FR-006）。小数は 10 の累乗の分数にして比べ、浮動小数では比べない。
// 読めない入力は間違いに数えない。文は作らず、結果だけを返す（文は wording.ts）
import { parseDecimal } from "./makers/decimal-text";
import { fractionsEqual } from "./fraction";
import type { Fraction } from "./fraction";
import { ANSWER_MAX_LENGTH, judgeAnswer, normalizeText, readWhole } from "./judge";
import type { AnswerResult } from "./judge";
import type { NumberAnswer } from "./number-problem";

/** correct と wrong のほかは、画面で言うことが決まる結果。invalid は分数の欄、invalidDecimal・invalidInteger は小数と整数の欄 */
export type NumberResult =
  | AnswerResult
  | "invalidDecimal" | "invalidInteger" | "remainderEmpty" | "multiEmpty" | "multiMissing" | "multiExtra";

/** 全角の数字と小数点を半角にして、前後の空白を除く。長さは打った文字のまま見る */
const normalizeNumber = (text: string): string => normalizeText(text).replace(/．/g, ".").trim();

/** 打った小数（整数も可）を、10 の累乗の分数にする。読めない・長すぎる時は null */
export function readDecimal(text: string): Fraction | null {
  return text.length > ANSWER_MAX_LENGTH ? null : parseDecimal(normalizeNumber(text));
}

/** 値が同じなら正解。`0.5` と `0.50`、`3` と `3.0` は同じ */
export function judgeDecimal(text: string, expected: string): NumberResult {
  const typed = readDecimal(text);
  const answer = parseDecimal(expected);
  if (!typed || !answer) return "invalidDecimal";
  return fractionsEqual(typed, answer) ? "correct" : "wrong";
}

/** 整数の答え。分子だけを入れる欄もこれで読む */
export function judgeInteger(text: string, expected: number): NumberResult {
  const typed = readWhole(text);
  if (typed === null) return "invalidInteger";
  return typed === expected ? "correct" : "wrong";
}

/** 商とあまり。どちらかが空なら remainderEmpty。商は整数、あまりは小数で読む */
export function judgeRemainder(texts: readonly [string, string], expected: { quotient: number; remainder: string }): NumberResult {
  if (texts.some((text) => !text.trim())) return "remainderEmpty";
  const quotient = readWhole(texts[0]);
  if (quotient === null) return "invalidInteger";
  const remainder = readDecimal(texts[1]);
  const answer = parseDecimal(expected.remainder);
  if (!remainder || !answer) return "invalidDecimal";
  return quotient === expected.quotient && fractionsEqual(remainder, answer) ? "correct" : "wrong";
}

/** 1つ選ぶ。選択肢の id が同じなら正解 */
export const judgeChoice = (picked: string, correct: string): NumberResult => (picked === correct ? "correct" : "wrong");

/** 全部えらぶ。入らない数がまじっていれば、足りなくても multiExtra */
export function judgeMulti(picked: readonly number[], correct: readonly number[]): NumberResult {
  if (picked.length === 0) return "multiEmpty";
  if (picked.some((card) => !correct.includes(card))) return "multiExtra";
  return correct.every((card) => picked.includes(card)) ? "correct" : "multiMissing";
}

/** 文字で答える形（選ぶ形以外）の判定。空の答えは呼ぶ前に弾く */
export function judgeNumberText(texts: readonly [string, string], answer: NumberAnswer): NumberResult {
  const [text] = texts;
  switch (answer.type) {
    case "integer": return judgeInteger(text, answer.value);
    case "numerator": return judgeInteger(text, answer.value);
    case "decimal": return judgeDecimal(text, answer.value);
    case "fraction": return judgeAnswer(text, answer.value);
    case "remainder": return judgeRemainder(texts, answer);
    default: return "invalid";
  }
}
