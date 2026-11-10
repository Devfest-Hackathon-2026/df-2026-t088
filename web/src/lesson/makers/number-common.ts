// 数の問題の関数（number.ts・integer.ts・decimal.ts・expression.ts）に共通の道具。
// 問題の関数の形（defineNumberMaker）と、args を読む道具、ヒントに答えが入っていないかを調べる道具
import type { NumberProblem } from "../number-problem";
import type { LessonProblem } from "../problems";
import { mentionsNumber } from "./format";
import type { Arg, CheckResult, ProblemMaker } from "./types";

export type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

export const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });
export const succeed = <T>(value: T): Parsed<T> => ({ ok: true, value });

/** args の数。ちょうど count 個 */
export function parseCount(args: unknown[], count: number): string | null {
  return args.length === count ? null : `args は ${count} 個にしてください（${args.length} 個）`;
}

/** min〜max の整数。型違い・小数・範囲外は理由を返す */
export function parseIntArg(arg: unknown, label: string, min: number, max: number): Parsed<number> {
  if (typeof arg !== "number" || !Number.isSafeInteger(arg)) return fail(`${label}は整数にしてください`);
  if (arg < min || arg > max) return fail(`${label}は ${min}〜${max} にしてください（${arg}）`);
  return succeed(arg);
}

/** min〜max の整数（範囲外の文言だけ parseIntArg と違う） */
export function parseWhole(arg: unknown, label: string, min: number, max: number): Parsed<number> {
  if (typeof arg !== "number" || !Number.isSafeInteger(arg)) return fail(`${label}は整数にしてください`);
  return arg >= min && arg <= max ? succeed(arg) : fail(`${label}は ${min}〜${max} の整数にしてください（${arg}）`);
}

/** `[語|よみ]` を語だけにする。ヒントの言い切りを調べる時に、ふりがなをはさんだ字を切らないため */
export const stripRuby = (text: string): string => text.replace(/\[([^|\]]*)\|[^\]]*\]/g, "$1");

/** ヒントに、その数（整数・小数・数の並びの文字）が入っていれば理由 */
export function leakedNumberReason(hints: string[], value: string): string | null {
  return hints.some((hint) => mentionsNumber(hint, value)) ? `ヒントに答えの数 ${value} が入っています` : null;
}

/** ヒントに、いずれかの数が入っていれば理由 */
export function leakReason(hints: readonly string[], numbers: readonly string[]): string | null {
  const leaked = numbers.find((value) => hints.some((hint) => mentionsNumber(hint, value)));
  return leaked === undefined ? null : `ヒントに答えの数 ${leaked} が入っています`;
}

/** ヒントに、選択肢の言葉を言い切った文（「偶数です」など）が入っていれば理由。ふりがなは外して調べる */
export function leakedPhraseReason(hints: string[], phrases: readonly string[]): string | null {
  const found = phrases.find((phrase) => hints.some((hint) => stripRuby(hint).includes(phrase)));
  return found ? `ヒントに答えの言葉「${found}」が入っています` : null;
}

/** どの数の問題にも言えること：タイルを出さない。ヒントは 2〜3 個（FR-009） */
export function shapeReason(problem: NumberProblem): string | null {
  if (problem.pieces.length > 0) return "数の問題はタイルを出しません";
  if (problem.hints.length < 2 || problem.hints.length > 3) return `ヒントは 2〜3 個にしてください（${problem.hints.length} 個）`;
  if (problem.hints.some((hint) => hint.trim() === "")) return "ヒントが空です";
  return null;
}

interface MakerParts<Spec> {
  name: string;
  parse(args: unknown[]): Parsed<Spec>;
  toArgs(spec: Spec): Arg[];
  make(spec: Spec): NumberProblem;
  verify(problem: NumberProblem): string | null;
}

/** check は組み立てた問題を verify にかけ、ヒントに答えが入ってしまう組も落とす */
export function defineNumberMaker<Spec>(parts: MakerParts<Spec>): ProblemMaker {
  const verify = (problem: LessonProblem): string | null => {
    if (problem.kind !== "number") return `${parts.name} は数の問題です`;
    return shapeReason(problem) ?? parts.verify(problem);
  };
  const check = (args: unknown[]): CheckResult => {
    const parsed = parts.parse(args);
    if (!parsed.ok) return parsed;
    const reason = verify(parts.make(parsed.value));
    return reason ? fail(reason) : { ok: true, args: parts.toArgs(parsed.value) };
  };
  const build = (args: Arg[]): LessonProblem => {
    const parsed = parts.parse(args);
    if (!parsed.ok) throw new RangeError(`${parts.name}: ${parsed.reason}`);
    return parts.make(parsed.value);
  };
  return { name: parts.name, kind: "number", check, build, verify };
}
