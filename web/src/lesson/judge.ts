import { fractionsEqual, isLowestTerms } from "./fraction";
import type { Fraction } from "./fraction";

const FULL_WIDTH_DIGIT = /[０-９]/g;
const ANSWER = /^(?:(\d+)(?:\s*と\s*|\s+))?(\d+)\/(\d+)$|^(\d+)$/;

// 答えの欄の長さ。貼り付けた長い文を読むと、空白の処理で画面が止まる
export const ANSWER_MAX_LENGTH = 40;

export type AnswerResult = "correct" | "wrong" | "invalid";

/** 全角の数字と斜線を半角にする。数の答え（number-judge.ts）も使う */
export function normalizeText(text: string): string {
  return text.replace(FULL_WIDTH_DIGIT, (digit) => String(digit.charCodeAt(0) - 0xff10)).replace(/／/g, "/");
}

function toFraction(numText: string, denText: string): Fraction | null {
  const fraction = { num: Number(numText), den: Number(denText) };
  const isSafe = Number.isSafeInteger(fraction.num) && Number.isSafeInteger(fraction.den);
  return isSafe && fraction.den !== 0 ? fraction : null;
}

/** 打った文を分数にする。約分はしない（帯分数も分母はそのまま）。読めなければ null */
export function readAnswer(text: string): Fraction | null {
  const match = ANSWER.exec(normalizeText(text).trim().replace(/\s*\/\s*/g, "/"));
  if (!match) return null;
  const [, wholeText, numText, denText, integerText] = match;
  if (integerText !== undefined) return toFraction(integerText, "1");
  const fraction = toFraction(numText ?? "", denText ?? "");
  if (!fraction || wholeText === undefined) return fraction;
  // 帯分数は約分せず、分母を入力のまま残す（約分・通分の判定が分母の形を見るため）
  const whole = Number(wholeText);
  return toFraction(String(whole * fraction.den + fraction.num), String(fraction.den));
}

/** 約分していない答えも、値が同じなら正解にする。帯分数と整数も受ける */
export function judgeAnswer(text: string, expected: Fraction): AnswerResult {
  if (text.length > ANSWER_MAX_LENGTH) return "invalid";
  const answer = readAnswer(text);
  if (!answer) return "invalid";
  return fractionsEqual(answer, expected) ? "correct" : "wrong";
}

/** 約分の答え。値が同じでも、まだ約分できるなら別の結果にして声をかける */
export function judgeReduced(text: string, expected: Fraction): AnswerResult | "not_lowest" {
  const result = judgeAnswer(text, expected);
  if (result !== "correct") return result;
  const answer = readAnswer(text);
  return answer && isLowestTerms(answer) ? "correct" : "not_lowest";
}

/** 通分の答え。分母の形をそのまま見るので、約分せずに読む */
export function judgeCommon(texts: readonly [string, string], left: Fraction, right: Fraction): AnswerResult | "not_common" {
  if (texts.some((text) => text.length > ANSWER_MAX_LENGTH)) return "invalid";
  const [first, second] = [readAnswer(texts[0]), readAnswer(texts[1])];
  if (!first || !second) return "invalid";
  if (!fractionsEqual(first, left) || !fractionsEqual(second, right)) return "wrong";
  return first.den === second.den ? "correct" : "not_common";
}

/** □ に入れた分子。整数でなければ null */
export function readWhole(text: string): number | null {
  const normalized = normalizeText(text).trim();
  return /^\d+$/.test(normalized) && normalized.length <= ANSWER_MAX_LENGTH ? Number(normalized) : null;
}
