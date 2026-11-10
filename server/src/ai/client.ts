import type { ReflectionInput } from "../api-types.ts";
import type { NamedPattern } from "../loop/hint-table.ts";
import type { StudioLesson, StudioStrategy } from "../studio/lesson-ir.ts";

export type CompileLessonInput = { prompt: string; strategy?: StudioStrategy; validationIssues?: string[] };
export type DraftLessonPatchInput = { lesson: StudioLesson; prompt: string; baseVersion: number };
export type PrintReadInput = { image: { mimeType: "image/jpeg"; data: string }; validationIssues?: string[] };

export interface AiClient {
  readonly loopHintDraftEnabled?: boolean;
  readonly source?: "gemini" | "mock";
  readonly modelName?: string;
  createParts(expression: string, signal: AbortSignal): Promise<unknown>;
  createSimilarProblem(problem: string, signal: AbortSignal): Promise<unknown>;
  createReflection(input: ReflectionInput, signal: AbortSignal): Promise<string>;
  readPrint?(input: PrintReadInput, signal: AbortSignal): Promise<unknown>;
  compileLesson?(input: CompileLessonInput, signal: AbortSignal): Promise<unknown>;
  draftLessonPatch?(input: DraftLessonPatchInput, signal: AbortSignal): Promise<unknown>;
  draftLoopHint?(input: { pattern: NamedPattern; operator: "+" | "-" }, signal: AbortSignal): Promise<string>;
}
