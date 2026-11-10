import ja from "./ja.json";
import en from "./en.json";
import ptBR from "./pt-BR.json";
import vi from "./vi.json";
import type { ExplanationLanguage } from "../locales";
import type { ExplainProblem } from "../types";

const narration = { ja, en, "pt-BR": ptBR, vi };
export const NARRATION_SEGMENTS: Readonly<Record<string, string>> = ja.segments;

export function narrationSegmentsFor(language: ExplanationLanguage): Readonly<Record<string, string>> {
  const selected = narration[language];
  const complete = Object.values(selected.segments).every(Boolean);
  return language === "ja" || (selected.verification.checkedBy && selected.verification.checkedAt && complete) ? selected.segments : ja.segments;
}

export function narrationForStep(problem: ExplainProblem, step: number, _language: ExplanationLanguage = "ja"): string[] {
  if (problem.templateId === "rika-moon") {
    const ids = ["moon-full", "moon-half", "moon-new"];
    return ids[step] ? [ids[step]] : [];
  }

  const { left, right } = problem.params;
  if (step === 0) {
    return ["lever-left", `number-${left.pos}`, "lever-mark", `weight-${left.g}`, "lever-right", `number-${right.pos}`, "lever-mark", "lever-weight", "lever-hang"];
  }
  if (step === 1) {
    return ["lever-right", `number-${right.pos}`, "lever-mark-within", "lever-weight", "lever-one", "lever-out", "lever-shift"];
  }
  return [];
}
