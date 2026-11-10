import { readRequestedExpression } from "../request-check.ts";
import { LIMITS } from "../limits.ts";
import { isErrorPattern, isNamedPattern, type NamedPattern } from "./hint-table.ts";
import { LOOP_LIMITS, type AfterHint, type Role, type Source, type Stumble } from "./store.ts";

type JsonRecord = Record<string, unknown>;

// 学習の章（main-6 など）と、プリントの型（print:rika-lever。#293）
const LESSON_KEY = /^(?:print:)?[a-z0-9-]+$/;
// プリントのてこの問題は、数だけの形（左2-30g-右3）。自由な文は入れさせない
const LEVER_PROBLEM = /^左[1-6]-(?:[1-9]0|100)g-右[1-6]$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** 提案と承認したヒントの型。分類できなかったもの（unclassified）は、直し方の表が無いので受けない */
export const readNamedPattern = (value: unknown): NamedPattern | undefined => (isNamedPattern(value) ? value : undefined);

const DATE_PART = /^(\d{4})-(\d{2})-(\d{2})T/;
const MIN_YEAR = 2020;
const MAX_YEAR = 2100;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 日付の形、実在する日、年の範囲を確かめる（Date.parse は 2 月 31 日を 3 月 3 日にしてしまう）。残すのは、日本時間の日付だけ
function readOccurredOn(value: unknown): string | undefined {
  if (typeof value !== "string" || !ISO_DATETIME.test(value)) return undefined;
  const parts = DATE_PART.exec(value);
  if (!parts) return undefined;
  const [year, month, day] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12) return undefined;
  if (day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time + JST_OFFSET_MS).toISOString().slice(0, 10);
}

export const isRole = (value: unknown): value is Role => value === "teacher" || value === "researcher";

export function readLessonKey(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= LOOP_LIMITS.lessonKeyLength && LESSON_KEY.test(value) ? value : undefined;
}

// 自由な文を入れさせない。式の形を通ったものだけを受ける。
export function readProblem(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > LIMITS.expressionLength) return undefined;
  if (LEVER_PROBLEM.test(value)) return value;
  return readRequestedExpression(value, LIMITS.maxFractionTerm) ? value : undefined;
}

export function readText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= LOOP_LIMITS.textLength ? trimmed : undefined;
}

export function readStumble(body: JsonRecord): Stumble | undefined {
  const chapterId = readLessonKey(body.chapterId);
  const lessonKey = readLessonKey(body.lessonKey);
  const problem = readProblem(body.problem);
  const { hintsShown, source } = body;
  // 型は省かれてもよい（省略は分類できなかった扱い）。知らない名前は受けない
  const pattern = body.pattern === undefined ? "unclassified" : body.pattern;
  if (!chapterId || !lessonKey || !problem || !isErrorPattern(pattern)) return undefined;
  if (typeof hintsShown !== "number" || !Number.isInteger(hintsShown) || hintsShown < 0 || hintsShown > LIMITS.maxHints) return undefined;
  if (source !== "dummy" && source !== "demo") return undefined;
  const occurredOn = readOccurredOn(body.occurredAt);
  if (!occurredOn) return undefined;
  return { chapterId, lessonKey, problem, hintsShown, pattern, source: source as Source, occurredOn };
}

// ヒントを見たあとの最初の答え。名前のある型だけ受ける。知らない項目は読まずに捨てる（保存しない）
export function readAfterHint(body: JsonRecord): AfterHint | undefined {
  const lessonKey = readLessonKey(body.lessonKey);
  const problem = readProblem(body.problem);
  const pattern = readNamedPattern(body.pattern);
  const { hintVersion, next, source } = body;
  if (!lessonKey || !problem || !pattern) return undefined;
  if (hintVersion !== "base" && hintVersion !== "approved") return undefined;
  if (next !== "correct" && next !== "same" && next !== "other") return undefined;
  if (source !== "dummy" && source !== "demo") return undefined;
  const occurredOn = readOccurredOn(body.occurredAt);
  if (!occurredOn) return undefined;
  return { lessonKey, problem, pattern, hintVersion, next, source: source as Source, occurredOn };
}
