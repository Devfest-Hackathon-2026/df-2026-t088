import type { LoopStore, Suggestion } from "./store.ts";
import { LOOP_LIMITS } from "./store.ts";
import { NAMED_PATTERNS, patternBelongsToChapter, type NamedPattern } from "./hint-table.ts";

export type AssistantEffectSide = { count: number; correct: number | null };
export type AssistantEffect = {
  status: "undetermined" | "compared";
  before: AssistantEffectSide;
  after: AssistantEffectSide;
  tryAlternatives: boolean;
  alternatives: Suggestion["candidates"];
  /** 承認済みの行にだけ付く */
  stumbles?: AssistantStumbles;
};

/** 承認の前日までと翌日からのつまずきの件数（#519）。5 件に届かない側は count を null にして伏せる */
export type AssistantStumbles = { before: { count: number | null }; after: { count: number | null } };

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

function stumblesOf(store: LoopStore, lessonKey: string, problem: string, pattern: NamedPattern): AssistantStumbles | undefined {
  const around = store.stumblesAround(lessonKey, problem, pattern);
  if (!around) return undefined;
  const show = (count: number) => ({ count: count >= LOOP_LIMITS.minGroupSize ? count : null });
  return { before: show(around.before), after: show(around.after) };
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
      const status = suggestion?.status ?? (approved ? "approved" : "unavailable");
      const stumbles = status === "approved" ? stumblesOf(store, summary.lessonKey, summary.problem, pattern) : undefined;
      items.push({
        chapterId: summary.chapterId,
        lessonKey: summary.lessonKey,
        problem: summary.problem,
        pattern,
        count,
        status,
        ...(suggestion ? { suggestion: { id: suggestion.id, candidates: suggestion.candidates.filter((candidate) => candidate.passed), ...(suggestion.selectedCandidateNumber === undefined ? {} : { selectedCandidateNumber: suggestion.selectedCandidateNumber }) } } : {}),
        effect: { status: compared ? "compared" : "undetermined", before, after, tryAlternatives, alternatives, ...(stumbles ? { stumbles } : {}) },
        source: hasApproved ? "dummy" : "demo",
      });
    }
  }
  return items.sort((a, b) => b.count - a.count || a.lessonKey.localeCompare(b.lessonKey) || a.problem.localeCompare(b.problem) || a.pattern.localeCompare(b.pattern));
}
