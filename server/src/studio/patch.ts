import { LIMITS } from "../limits.ts";
import type { StudioFraction, StudioLesson, StudioStrategy } from "./lesson-ir.ts";

export type StudioPatchOperation =
  | { type: "replaceHint"; problemNumber: number; hintNumber: number; text: string }
  | { type: "addHint"; problemNumber: number; text: string }
  | { type: "replaceNumbers"; problemNumber: number; left: StudioFraction; right: StudioFraction }
  | { type: "setStrategy"; strategy: StudioStrategy };

export type StudioPatch = { baseVersion: number; operations: StudioPatchOperation[] };
export type PatchResult = { ok: true; lesson: StudioLesson } | { ok: false; issues: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isFraction = (value: unknown): value is StudioFraction => isRecord(value)
  && Object.keys(value).length === 2 && Number.isInteger(value.num) && Number.isInteger(value.den);

export function readStudioPatch(value: unknown): StudioPatch | undefined {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "baseVersion" && key !== "operations")
    || !Number.isInteger(value.baseVersion) || (value.baseVersion as number) < 1
    || !Array.isArray(value.operations) || value.operations.length === 0) return undefined;
  if (!value.operations.every(isPatchOperation)) return undefined;
  return value as unknown as StudioPatch;
}

function isPatchOperation(value: unknown): value is StudioPatchOperation {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "replaceHint": return onlyKeys(value, ["type", "problemNumber", "hintNumber", "text"])
      && positiveInteger(value.problemNumber) && positiveInteger(value.hintNumber) && typeof value.text === "string";
    case "addHint": return onlyKeys(value, ["type", "problemNumber", "text"])
      && positiveInteger(value.problemNumber) && typeof value.text === "string";
    case "replaceNumbers": return onlyKeys(value, ["type", "problemNumber", "left", "right"])
      && positiveInteger(value.problemNumber) && isFraction(value.left) && isFraction(value.right);
    case "setStrategy": return onlyKeys(value, ["type", "strategy"])
      && (value.strategy === "visual" || value.strategy === "numeric" || value.strategy === "misconception");
    default: return false;
  }
}

function onlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

export function applyStudioPatch(lesson: StudioLesson, patch: StudioPatch): PatchResult {
  if (!readStudioPatch(patch)) return { ok: false, issues: ["パッチの形または操作が正しくありません。"] };
  const problems = lesson.problems.map((problem) => ({ ...problem, left: { ...problem.left }, right: { ...problem.right }, hints: [...problem.hints] }));
  let strategy = lesson.strategy;
  for (const operation of patch.operations) {
    if (operation.type === "setStrategy") {
      strategy = operation.strategy;
      continue;
    }
    const problem = problems[operation.problemNumber - 1];
    if (!problem) return { ok: false, issues: [`問題${operation.problemNumber}がありません。`] };
    if (operation.type === "replaceHint") {
      if (operation.hintNumber > problem.hints.length) return { ok: false, issues: [`問題${operation.problemNumber}にヒント${operation.hintNumber}がありません。`] };
      problem.hints[operation.hintNumber - 1] = operation.text;
    } else if (operation.type === "addHint") {
      if (problem.hints.length >= LIMITS.maxHints) return { ok: false, issues: [`ヒントは${LIMITS.maxHints}個までです。`] };
      problem.hints.push(operation.text);
    } else if (operation.type === "replaceNumbers") {
      problem.left = { ...operation.left };
      problem.right = { ...operation.right };
    }
  }
  return { ok: true, lesson: { ...lesson, strategy, problems } };
}
