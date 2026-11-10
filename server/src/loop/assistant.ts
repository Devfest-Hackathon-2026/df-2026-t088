import type { LoopStore, Suggestion } from "./store.ts";
import { LOOP_LIMITS } from "./store.ts";
import { NAMED_PATTERNS, patternBelongsToChapter } from "./hint-table.ts";

export type AssistantEffectSide = { count: number; correct: number | null };
export type AssistantEffect = {
  status: "undetermined" | "compared";
  before: AssistantEffectSide;
  after: AssistantEffectSide;
  tryAlternatives: boolean;
  alternatives: Suggestion["candidates"];
};

export type AssistantItem = {
  chapterId: string;
  lessonKey: string;
  problem: string;
  pattern: string;
  count: number;
  status: Suggestion["status"] | "approved" | "unavailable";
  suggestion?: Pick<Suggestion, "id" | "candidates" | "selectedCandidateNumber">;
  effect: AssistantEffect;
  source: "dummy" | "demo";
};

function side(count: number, correct: number): AssistantEffectSide {
  return { count, correct: count >= LOOP_LIMITS.minGroupSize ? correct / count : null };
}

/** 型の一覧・規則表から対象を集計し、少人数の効果は画面に出さない。 */
export function buildAssistantItems(store: LoopStore, suggestions: Map<string, Suggestion>): AssistantItem[] {
  const cells = store.hintEffect().cells;
  const records = store.records();
  const items: AssistantItem[] = [];
  for (const summary of store.summary()) {
    for (const pattern of NAMED_PATTERNS) {
      if (!patternBelongsToChapter(pattern, summary.chapterId)) continue;
      const count = summary.patterns.find((entry) => entry.pattern === pattern)?.count ?? 0;
      // まとめの内訳は、出してよい件数（presenceMinimum）に届いた型だけを持つ
      if (count === 0) continue;
      const key = `${summary.lessonKey}|${summary.problem.replace(/\s+/g, "")}|${pattern}`;
      const suggestion = suggestions.get(key);
      const approved = store.approvedHints(summary.lessonKey, summary.problem, pattern).length > 0;
      const beforeCell = cells.find((cell) => cell.lessonKey === summary.lessonKey && cell.problem.replace(/\s+/g, "") === summary.problem.replace(/\s+/g, "") && cell.pattern === pattern && cell.hintVersion === "base");
      const afterCell = cells.find((cell) => cell.lessonKey === summary.lessonKey && cell.problem.replace(/\s+/g, "") === summary.problem.replace(/\s+/g, "") && cell.pattern === pattern && cell.hintVersion === "approved");
      const before = side(beforeCell?.count ?? 0, beforeCell?.correct ?? 0);
      const after = side(afterCell?.count ?? 0, afterCell?.correct ?? 0);
      const compared = before.correct !== null && after.correct !== null;
      const tryAlternatives = compared && after.correct! < before.correct!;
      const candidates = suggestion?.candidates ?? [];
      const alternatives = tryAlternatives
        ? candidates.filter((candidate) => candidate.passed && candidate.number !== suggestion?.selectedCandidateNumber)
        : [];
      const hasApproved = records.some((record) => record.lessonKey === summary.lessonKey && record.problem.replace(/\s+/g, "") === summary.problem.replace(/\s+/g, "") && record.source === "dummy");
      items.push({
        chapterId: summary.chapterId,
        lessonKey: summary.lessonKey,
        problem: summary.problem,
        pattern,
        count,
        status: suggestion?.status ?? (approved ? "approved" : "unavailable"),
        ...(suggestion ? { suggestion: { id: suggestion.id, candidates: suggestion.candidates.filter((candidate) => candidate.passed), ...(suggestion.selectedCandidateNumber === undefined ? {} : { selectedCandidateNumber: suggestion.selectedCandidateNumber }) } } : {}),
        effect: { status: compared ? "compared" : "undetermined", before, after, tryAlternatives, alternatives },
        source: hasApproved ? "dummy" : "demo",
      });
    }
  }
  return items.sort((a, b) => b.count - a.count || a.lessonKey.localeCompare(b.lessonKey) || a.problem.localeCompare(b.problem) || a.pattern.localeCompare(b.pattern));
}
