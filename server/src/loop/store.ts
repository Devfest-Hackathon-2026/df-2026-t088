// 学びの輪の記録の置き場（仮・メモリだけ）。保存先は #72 で決まるまで置き換えない。
// docs/product/education-api-contract.md「学びの輪の API」と同じ形を守る。
import type { ErrorPattern, NamedPattern } from "./hint-table.ts";
import type { LoopHintFailure } from "./check-hint.ts";
import { DEMO_WORKSPACE_ID } from "../workspace/store.ts";

export type SuggestionCandidate = {
  number: number;
  source: "gemini" | "table";
  hint: string;
  passed: boolean;
  reason?: LoopHintFailure | "timeout" | "error" | "check_failed";
};

export const LOOP_LIMITS = {
  minGroupSize: 5, // 仮：これ未満の問題と型は、集計にも記録にも出さず、提案も作らない
  textLength: 100, // 仮：purpose と reason の上限
  lessonKeyLength: 32,
  capacity: 2000, // 仮：デモで受ける記録の上限
  auditCapacity: 5000,
} as const;

export type Role = "teacher" | "researcher";
export type Source = "dummy" | "demo";

export type Stumble = {
  chapterId: string;
  lessonKey: string;
  problem: string;
  hintsShown: number;
  pattern: ErrorPattern;
  source: Source;
  occurredOn: string; // 日付だけ。時刻は持たない
};

export type Suggestion = {
  id: string;
  status: "pending" | "approved" | "rejected" | "revoked";
  generatedBy: "table" | "gemini";
  aiFallback?: "check_failed" | "timeout" | "error";
  candidates: SuggestionCandidate[];
  selectedCandidateNumber?: number;
  lessonKey: string;
  problem: string;
  pattern: NamedPattern;
  replacesHintIndex: number;
  hint: string;
  basis: { count: number };
};

export type HintVersion = "base" | "approved";
export type NextOutcome = "correct" | "same" | "other";
// ヒントを見たあとの最初の答え（テーマ「ヒントを替えたあと、次の答えは近づいたか」）。名前・番号・時刻は持たない
export type AfterHint = {
  lessonKey: string; problem: string; pattern: NamedPattern; hintVersion: HintVersion; next: NextOutcome; source: Source; occurredOn: string;
};
export type ThemeCell = {
  lessonKey: string; problem: string; pattern: NamedPattern; hintVersion: HintVersion;
  count: number; correct: number; same: number; other: number;
};
export type ThemeStage = "collecting" | "proposal" | "approved" | "comparing";
export type HintEffect = { stage: ThemeStage; comparable: boolean; cells: ThemeCell[] };

export type AuditAction = "query" | "suggest" | "decide" | "revoke" | "audit-read";

export type AuditEntry = {
  id: number;
  at: string;
  role: Role;
  action: AuditAction;
  targetId: string | null;
  detail: string | null;
  reason: string | null;
  result: "allowed" | "denied";
};

export type AuditInput = Omit<AuditEntry, "id" | "at">;

export type PatternCount = { pattern: ErrorPattern; count: number };
export type SummaryItem = { chapterId: string; lessonKey: string; problem: string; count: number; patterns: PatternCount[] };
export type SummaryPeriod = "today" | "7days";
export type ApprovedHint = { pattern: NamedPattern; replacesHintIndex: number; hint: string };

export type LoopStore = {
  /** 学級ごとに分けた記録の置き場。学級の id が無い・見つからない記録は "demo"（このオブジェクト自身が demo の分） */
  scope(workspaceId: string): LoopStore;
  addStumble(stumble: Stumble): boolean;
  addAfterHint(record: AfterHint): boolean;
  hintEffect(): HintEffect;
  summary(period?: SummaryPeriod): SummaryItem[];
  records(): Omit<Stumble, "pattern" | "chapterId">[];
  patternCount(lessonKey: string, problem: string, pattern: NamedPattern): number;
  /** その問題と型が、表に出したり提案を作ったりしてよい件数に届いているか（presenceMinimum） */
  patternVisible(lessonKey: string, problem: string, pattern: NamedPattern): boolean;
  findPending(lessonKey: string, problem: string, pattern: NamedPattern): Suggestion | undefined;
  createSuggestion(input: { lessonKey: string; problem: string; pattern: NamedPattern; hint: string; count: number; generatedBy: "table" | "gemini"; candidates: SuggestionCandidate[]; aiFallback?: "check_failed" | "timeout" | "error" }): Suggestion;
  findSuggestion(id: string): Suggestion | undefined;
  decide(id: string, decision: "approved" | "rejected", candidateNumber?: number): string[];
  revoke(id: string): void;
  approvedHints(lessonKey: string, problem: string, pattern?: NamedPattern): ApprovedHint[];
  addAudit(entry: AuditInput): void;
  auditLog(): AuditEntry[];
};

export type LoopStoreOptions = {
  now?: () => Date;
  capacity?: number;
  /** デモ（source: demo）の記録だけのまとまりを、何件から出すか。既定は 5（minGroupSize と同じ）。審査・デモの公開版だけ 1 にする（LOOP_DEMO_MIN_GROUP） */
  demoMinimum?: number;
};

// 空白の違いで別の問題にしない
const problemKey = (lessonKey: string, problem: string) => `${lessonKey}|${problem.replace(/\s+/g, "")}`;

/**
 * 表に出す・提案を作るのに要る件数。既定はどの記録も 5 件（minGroupSize）。
 * デモ（source: demo）の記録だけのまとまりは、demoMinimum を設定したときだけ、その件数から出す（審査・デモで輪を目の前で回すため。2026-11-10 持ち主の判断）。
 * 見本（dummy）が混ざれば既定に戻る。効いたかの割合（前後の比べ）は統計として少なすぎるので、どの記録でも 5 件のまま。
 */
export function presenceMinimum(items: readonly { source: string }[], demoMinimum: number = LOOP_LIMITS.minGroupSize): number {
  return items.length > 0 && items.every((item) => item.source === "demo") ? demoMinimum : LOOP_LIMITS.minGroupSize;
}

export function createLoopStore(options: LoopStoreOptions = {}): LoopStore {
  // 学級ごとに記録・案・承認・操作の記録を別に持つ。番号（suggestion-N・操作の記録の id）は全体で通し、別の学級の番号を当てても見つからない
  const ids = { suggestion: 0, audit: 0 };
  const scopes = new Map<string, LoopStore>();
  const scope = (workspaceId: string): LoopStore => {
    const found = scopes.get(workspaceId);
    if (found) return found;
    const created = { ...createScopedStore(options, ids), scope };
    scopes.set(workspaceId, created);
    return created;
  };
  return scope(DEMO_WORKSPACE_ID);
}

type StoreIds = { suggestion: number; audit: number };

function createScopedStore(options: LoopStoreOptions, ids: StoreIds): Omit<LoopStore, "scope"> {
  const now = options.now ?? (() => new Date());
  const capacity = options.capacity ?? LOOP_LIMITS.capacity;
  const demoMinimum = Math.min(Math.max(Math.trunc(options.demoMinimum ?? LOOP_LIMITS.minGroupSize), 1), LOOP_LIMITS.minGroupSize);
  const minimumFor = (items: readonly { source: string }[]) => presenceMinimum(items, demoMinimum);
  const stumbles: Stumble[] = [];
  const suggestions: Suggestion[] = [];
  const audit: AuditEntry[] = [];
  const afterHints: AfterHint[] = [];

  const groups = (): Map<string, Stumble[]> => {
    const map = new Map<string, Stumble[]>();
    for (const item of stumbles) {
      const key = problemKey(item.lessonKey, item.problem);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  };
  const enoughGroups = () => [...groups().values()].filter((items) => items.length >= minimumFor(items));

  // 日本時間の YYYY-MM-DD（now は固定できる）。7days は今日を含む直近 7 日（今日と前の 6 日）
  const japanDate = (offsetDays: number) => new Date(now().getTime() + 9 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
  // 期間で絞った後の件数に、5 件未満を出さない決まりを当てる
  // summary のまとまりは 章・学習・問題 の組（提案と承認の経路は、今のまま lessonKey と problem で引く）
  const enoughGroupsIn = (period?: SummaryPeriod) => {
    const from = period ? japanDate(period === "today" ? 0 : -6) : "";
    const to = period ? japanDate(0) : "9999-12-31";
    const map = new Map<string, Stumble[]>();
    for (const item of stumbles) {
      if (item.occurredOn < from || item.occurredOn > to) continue;
      const key = `${item.chapterId}|${problemKey(item.lessonKey, item.problem)}`;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.values()].filter((items) => items.length >= minimumFor(items));
  };

  // 5 件以上の型だけを内訳に出す。出ない型の分は、問題の件数から引くと分かる（二次秘匿の限界。契約文書に書いた）
  const patternBreakdown = (items: Stumble[]): PatternCount[] => {
    const counts = new Map<ErrorPattern, number>();
    for (const item of items) counts.set(item.pattern, (counts.get(item.pattern) ?? 0) + 1);
    return [...counts.entries()]
      .filter(([pattern, count]) => count >= minimumFor(items.filter((item) => item.pattern === pattern)))
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count || a.pattern.localeCompare(b.pattern));
  };

  const sameTarget = (item: Suggestion, lessonKey: string, problem: string) =>
    problemKey(item.lessonKey, item.problem) === problemKey(lessonKey, problem);

  return {
    addStumble(stumble) {
      if (stumbles.length >= capacity && stumbles.length > 0) stumbles.shift();
      stumbles.push(stumble);
      return true;
    },
    addAfterHint(record) {
      if (afterHints.length >= capacity && afterHints.length > 0) afterHints.shift();
      afterHints.push(record);
      return true;
    },
    hintEffect() {
      // 5 件に届かない区画は、出さない。出ない分は、全体から引くと分かる（二次秘匿の限界）
      const buckets = new Map<string, ThemeCell>();
      for (const item of afterHints) {
        const key = [problemKey(item.lessonKey, item.problem), item.pattern, item.hintVersion].join("|");
        const cell = buckets.get(key) ?? { lessonKey: item.lessonKey, problem: item.problem, pattern: item.pattern, hintVersion: item.hintVersion, count: 0, correct: 0, same: 0, other: 0 };
        buckets.set(key, { ...cell, count: cell.count + 1, [item.next]: cell[item.next] + 1 });
      }
      const cells = [...buckets.values()]
        .filter((cell) => cell.count >= LOOP_LIMITS.minGroupSize)
        .sort((a, b) => a.lessonKey.localeCompare(b.lessonKey) || a.problem.localeCompare(b.problem) || a.pattern.localeCompare(b.pattern) || (a.hintVersion === "base" ? 0 : 1) - (b.hintVersion === "base" ? 0 : 1));
      const comparable = cells.some((base) => base.hintVersion === "base"
        && cells.some((next) => next.hintVersion === "approved" && next.lessonKey === base.lessonKey && next.problem === base.problem && next.pattern === base.pattern));
      const hasApprovedSuggestion = suggestions.some((item) => item.status === "approved");
      const hasApprovedRecords = afterHints.some((item) => item.hintVersion === "approved");
      const canPropose = enoughGroups().some((items) => patternBreakdown(items).some((entry) => entry.pattern !== "unclassified"));
      const stage: ThemeStage = hasApprovedSuggestion && hasApprovedRecords ? "comparing" : hasApprovedSuggestion ? "approved" : canPropose ? "proposal" : "collecting";
      return { stage, comparable, cells };
    },
    summary(period) {
      return enoughGroupsIn(period)
        .flatMap((items) => {
          const first = items[0];
          return first ? [{ chapterId: first.chapterId, lessonKey: first.lessonKey, problem: first.problem, count: items.length, patterns: patternBreakdown(items) }] : [];
        })
        .sort((a, b) => a.chapterId.localeCompare(b.chapterId) || a.lessonKey.localeCompare(b.lessonKey) || a.problem.localeCompare(b.problem));
    },
    records() {
      // 中身で並べ替える。型は出さない（型と日付が揃うと、1 人に絞れるため）。
      // 同じ値の記録は、並びが変わらず受けた順のままだが、出力の項目が同じなので、並びは情報にならない（source だけが違うときは、並びが出る）
      return enoughGroups()
        .flat()
        .map(({ pattern: _pattern, chapterId: _chapterId, ...rest }) => rest)
        .sort((a, b) =>
          a.lessonKey.localeCompare(b.lessonKey) || a.problem.localeCompare(b.problem)
          || a.hintsShown - b.hintsShown || a.occurredOn.localeCompare(b.occurredOn));
    },
    patternVisible(lessonKey, problem, pattern) {
      const items = (groups().get(problemKey(lessonKey, problem)) ?? []).filter((item) => item.pattern === pattern);
      return items.length > 0 && items.length >= minimumFor(items);
    },
    patternCount(lessonKey, problem, pattern) {
      return (groups().get(problemKey(lessonKey, problem)) ?? []).filter((item) => item.pattern === pattern).length;
    },
    findPending(lessonKey, problem, pattern) {
      return suggestions.find((item) => item.status === "pending" && item.pattern === pattern && sameTarget(item, lessonKey, problem));
    },
    createSuggestion({ lessonKey, problem, pattern, hint, count, generatedBy, candidates, aiFallback }) {
      const suggestion: Suggestion = {
        id: `suggestion-${(ids.suggestion += 1)}`, status: "pending", generatedBy, ...(aiFallback ? { aiFallback } : {}),
        lessonKey, problem, pattern, replacesHintIndex: 0, hint, candidates, basis: { count },
      };
      suggestions.push(suggestion);
      return suggestion;
    },
    findSuggestion(id) {
      return suggestions.find((item) => item.id === id);
    },
    decide(id, decision, candidateNumber) {
      const target = suggestions.find((item) => item.id === id);
      if (!target) return [];
      if (decision === "approved" && candidateNumber !== undefined) {
        const candidate = target.candidates.find((item) => item.number === candidateNumber && item.passed);
        if (candidate) {
          target.hint = candidate.hint;
          target.generatedBy = candidate.source;
          target.selectedCandidateNumber = candidate.number;
        }
      }
      target.status = decision;
      if (decision === "rejected") return [];
      const replaced = suggestions.filter((item) => item.id !== id && item.status === "approved"
        && item.pattern === target.pattern && sameTarget(item, target.lessonKey, target.problem));
      for (const item of replaced) item.status = "revoked";
      return replaced.map((item) => item.id);
    },
    revoke(id) {
      const target = suggestions.find((item) => item.id === id);
      if (target) target.status = "revoked";
    },
    approvedHints(lessonKey, problem, pattern) {
      return suggestions
        .filter((item) => item.status === "approved" && sameTarget(item, lessonKey, problem) && (!pattern || item.pattern === pattern))
        .map(({ pattern: itemPattern, replacesHintIndex, hint }) => ({ pattern: itemPattern, replacesHintIndex, hint }));
    },
    addAudit(entry) {
      ids.audit += 1;
      audit.push({ id: ids.audit, at: now().toISOString(), ...entry });
      if (audit.length > LOOP_LIMITS.auditCapacity) audit.shift();
    },
    auditLog() {
      return [...audit].sort((a, b) => b.id - a.id);
    },
  };
}
