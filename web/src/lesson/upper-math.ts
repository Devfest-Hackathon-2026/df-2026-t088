import type { LessonTarget } from "../game/logic";
import type { SixVisual } from "./grade-six-types";
import { GRADE_SIX_ADDITIONS } from "./grade-six";

export type UpperVisual =
  | SixVisual
  | { kind: "bundles"; groups: { label: string; count: number }[] }
  | { kind: "rectangles"; rectangles: { width: number; height: number }[] }
  | { kind: "volume"; width: number; height: number; depth: number; unit: "cm" | "m" }
  | { kind: "bars"; values: number[]; labels: string[]; unit: string }
  | { kind: "ratio"; values: [number, number]; labels: [string, string]; unit: string; showBase?: boolean }
  | { kind: "number-lines"; lines: { value: number; low: number; high: number }[] }
  | { kind: "prism"; shape: "triangle" | "cylinder"; baseArea: number; height: number }
  | { kind: "collection"; count: number; size: number }
  | { kind: "number-lists"; rows: { label: string; values: number[] }[] }
  | { kind: "area-shape"; shape: "parallelogram" | "triangle" | "trapezoid" | "rhombus"; base: number; height: number; top?: number }
  | { kind: "function-table"; xLabel: string; yLabel: string; xs: number[]; ys: (number | null)[]; operation: "multiply" | "divide"; factor: number; increment?: string }
  | { kind: "circle-area"; radius: number }
  | { kind: "part-whole"; whole: number; part: number; unit: string; partLabel: string; revealRestPercent?: boolean; showPercent?: boolean }
  | { kind: "split-bars"; rows: { label: string; total: number; parts: number; unit: string }[] }
  | { kind: "area-parts"; shape: "parallelogram" | "triangle" | "trapezoid" | "rhombus" }
  | { kind: "circle-parts" };
export interface UpperQuestion {
  title: string; problem: string; visual: UpperVisual; hints: [string, string]; answer: string; unit: string; retry: string; explanation: string;
  followUps?: UpperQuestion[];
  answerFormat?: "fraction";
  acceptedAnswers?: string[];
}
export interface UpperChapter { main: { practice: UpperQuestion; test: UpperQuestion }[]; sides?: Record<string, UpperQuestion> }
export const q = (title: string, problem: string, visual: UpperVisual, hints: [string, string], answer: string, unit: string, retry: string, explanation: string): UpperQuestion => ({ title, problem, visual, hints, answer, unit, retry, explanation });
export const rect = (width: number, height: number): UpperVisual => ({ kind: "rectangles", rectangles: [{ width, height }] });
export const box = (width: number, height: number, depth: number, unit: "cm" | "m" = "cm"): UpperVisual => ({ kind: "volume", width, height, depth, unit });
export const bars = (values: number[], unit: string, period = "人目"): UpperVisual => ({ kind: "bars", values, labels: values.map((_, i) => `${i + 1}${period}`), unit });
export const ratio = (a: number, b: number, unit: string, showBase = false): UpperVisual => ({ kind: "ratio", values: [a, b], labels: ["ジュース", "水"], unit, showBase });
export const bundles = (big: string, n: number, small: string, m: number): UpperVisual => ({ kind: "bundles", groups: [{ label: big, count: n }, { label: small, count: m }] });
export const lines = (...values: [number, number, number][]): UpperVisual => ({ kind: "number-lines", lines: values.map(([value, low, high]) => ({ value, low, high })) });
export const prism = (shape: "triangle" | "cylinder", baseArea: number, height: number): UpperVisual => ({ kind: "prism", shape, baseArea, height });
export const collection = (count: number, size: number): UpperVisual => ({ kind: "collection", count, size });
export const numberLists = (a: string, av: number[], b: string, bv: number[]): UpperVisual => ({ kind: "number-lists", rows: [{ label: a, values: av }, { label: b, values: bv }] });
export const areaShape = (shape: "parallelogram" | "triangle" | "trapezoid" | "rhombus", base: number, height: number, top?: number): UpperVisual => ({ kind: "area-shape", shape, base, height, top });
export const functionTable = (xLabel: string, yLabel: string, xs: number[], ys: (number | null)[], operation: "multiply" | "divide", factor: number, increment?: string): UpperVisual => ({ kind: "function-table", xLabel, yLabel, xs, ys, operation, factor, increment });
export const circleArea = (radius: number): UpperVisual => ({ kind: "circle-area", radius });
export const partWhole = (whole: number, part: number, unit: string, partLabel: string, revealRestPercent = false, showPercent = true): UpperVisual => ({ kind: "part-whole", whole, part, unit, partLabel, revealRestPercent, showPercent });
export const splitBars = (...rows: { label: string; total: number; parts: number; unit: string }[]): UpperVisual => ({ kind: "split-bars", rows });
export const pair = (practice: UpperQuestion, test: UpperQuestion) => ({ practice, test });

/** 内容を用意した章だけを接続し、問題のないマスを解放しない。 */
export const UPPER_MATH: Record<string, UpperChapter> = {
  ...GRADE_SIX_ADDITIONS,
};

export function findUpperMath(chapterId: string, target: LessonTarget): UpperQuestion | undefined {
  const chapter = UPPER_MATH[chapterId];
  if (!chapter) return undefined;
  if (target.kind === "main") return chapter.main[target.index]?.practice;
  if (target.kind === "test") return chapter.main[0]?.test;
  return chapter.sides?.[target.sideId];
}
export function upperMathSummary(chapterId: string): UpperQuestion[] { return (UPPER_MATH[chapterId]?.main ?? []).flatMap((item) => [item.test, ...(item.test.followUps ?? [])]); }
export function hasUpperMath(chapterId: string): boolean { return Object.hasOwn(UPPER_MATH, chapterId); }
