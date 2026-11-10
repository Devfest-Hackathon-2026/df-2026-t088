import { addFractions, subtractFractions } from "../check/fraction.ts";
import { parseExpression } from "../check/expression.ts";
import { hintLeaksAnswer } from "../check/hint-leak.ts";

export type LoopHintFailure = "empty" | "too_long" | "multiple_paragraphs" | "has_digit" | "has_link" | "leak" | "wrong_operator";
export type LoopHintCheck = { ok: true } | { ok: false; reason: LoopHintFailure };

const DIGITS = /[0-9０-９〇零一二三四五六七八九十百千万億兆壱弐参拾]/u;
const LINK = /(?:https?:\/\/|www\.|mailto:|\[[^\]]+\]\([^)]*\)|(?:[\p{L}\d-]+\.)+(?:com|net|org|edu|gov|jp|io)(?:\/\S*)?)/iu;
// 活用形も見る（たそう、たさない、足そう、足さない）
const ADD_WORDS = /(?:たす|足す|たし|足し|たそ|足そ|たさ|足さ|加える|加算)/u;
// 活用形も見る（ひこう、ひかない、引こう、引かない）
const SUBTRACT_WORDS = /(?:ひく|引く|ひき|引き|ひこ|引こ|ひか|引か|減らす|差し引く|減算)/u;

/** AI の文案を、子どもの画面へ渡す前に検査する。 */
export function checkLoopHint(hint: string, operator: "+" | "-", problem: string): LoopHintCheck {
  const text = hint.trim();
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > 80) return { ok: false, reason: "too_long" };
  if (/[\r\n\u2028\u2029]/u.test(text)) return { ok: false, reason: "multiple_paragraphs" };
  if (LINK.test(text)) return { ok: false, reason: "has_link" };

  const parsed = parseExpression(problem);
  if (parsed.ok) {
    const { left, right } = parsed.expression;
    const answer = operator === "+" ? addFractions(left, right) : subtractFractions(left, right);
    if (hintLeaksAnswer([text], answer, answer)) return { ok: false, reason: "leak" };
  }

  if (DIGITS.test(text)) return { ok: false, reason: "has_digit" };

  if ((operator === "+" && SUBTRACT_WORDS.test(text)) || (operator === "-" && ADD_WORDS.test(text))) {
    return { ok: false, reason: "wrong_operator" };
  }
  return { ok: true };
}
