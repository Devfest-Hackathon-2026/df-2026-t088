import type { Context, Hono } from "hono";
import type { LoopStore, Suggestion } from "./store.ts";
import { LOOP_LIMITS } from "./store.ts";
import { NAMED_PATTERNS, patternBelongsToChapter, patternDraftsWithAi } from "./hint-table.ts";
import { buildAssistantItems } from "./assistant.ts";
import { apiFailure } from "../errors.ts";
import { parseExpression } from "../check/expression.ts";
import { HINT_BY_PATTERN } from "./hint-table.ts";
import { checkLoopHint } from "./check-hint.ts";
import type { AiClient } from "../ai/client.ts";
import type { SuggestionCandidate } from "./store.ts";
import { readNamedPattern, readStumble, readAfterHint } from "./validate.ts";

const SAMPLE_BATCH_LIMIT = 100;
const SAMPLE_PROBLEM = { chapterId: "fraction", lessonKey: "main-6", problem: "1/3+1/4" };

// 学級ごとの置き場（scope が同じ object を返すので、学級の数だけの組ができる）
const suggestionsByStore = new WeakMap<LoopStore, Map<string, Suggestion>>();
const generationsByStore = new WeakMap<LoopStore, Map<string, Promise<Suggestion>>>();

function cachesOf(store: LoopStore) {
  const generated = suggestionsByStore.get(store) ?? new Map<string, Suggestion>();
  suggestionsByStore.set(store, generated);
  const generations = generationsByStore.get(store) ?? new Map<string, Promise<Suggestion>>();
  generationsByStore.set(store, generations);
  return { generated, generations };
}

function targetKey(lessonKey: string, problem: string, pattern: string): string {
  return `${lessonKey}|${problem.replace(/\s+/g, "")}|${pattern}`;
}

function isSuggestion(value: unknown): value is Suggestion {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"
    && "candidates" in value && Array.isArray(value.candidates);
}

class HintTimeout extends Error {}

async function withHintTimeout<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new HintTimeout()); }, 8_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function createSuggestion(context: Context, store: LoopStore, lessonKey: string, problem: string, pattern: (typeof NAMED_PATTERNS)[number], count: number, mayUseAi: () => boolean): Promise<Suggestion> {
  const parsed = parseExpression(problem);
  const operator = parsed.ok ? parsed.expression.operator : "+";
  const tableHint = operator === "+" ? HINT_BY_PATTERN[pattern] : HINT_BY_PATTERN[pattern]
    .replace(/たそう|足そう/g, "ひこう").replace(/たそ|足そ/g, "ひこ")
    .replace(/たす|足す|たし|足し/g, "ひく").replace(/加算/g, "ひき算");
  const candidates: SuggestionCandidate[] = [];
  let generatedBy: "table" | "gemini" = "table";
  let aiFallback: "check_failed" | "timeout" | "error" | undefined;
  const aiClient = (context as unknown as Context<{ Variables: { aiClient: AiClient } }>).get("aiClient");
  // 学級ごとの 1 日の上限を超えたら、Gemini を呼ばずに表の案だけにする
  if (aiClient?.loopHintDraftEnabled && patternDraftsWithAi(pattern) && mayUseAi()) {
    try {
      const results = await withHintTimeout((signal) => Promise.allSettled(Array.from({ length: 3 }, () =>
        aiClient.draftLoopHint?.({ pattern, operator }, signal) ?? Promise.reject(new Error("AI の下書き機能がありません。")))));
      for (const result of results) {
        if (result.status === "rejected") {
          candidates.push({ number: candidates.length + 1, source: "gemini", hint: "", passed: false, reason: "error" });
          continue;
        }
        const hint = result.value.trim();
        const checked = checkLoopHint(hint, operator, problem);
        candidates.push({ number: candidates.length + 1, source: "gemini", hint, passed: checked.ok, ...(checked.ok ? {} : { reason: checked.reason }) });
      }
      if (candidates.some((candidate) => candidate.source === "gemini" && candidate.passed)) generatedBy = "gemini";
      else aiFallback = candidates.some((candidate) => candidate.reason === "error") ? "error" : "check_failed";
    } catch (error) {
      aiFallback = error instanceof HintTimeout ? "timeout" : "error";
      candidates.push(...Array.from({ length: 3 }, (_, index) => ({ number: index + 1, source: "gemini" as const, hint: "", passed: false, reason: aiFallback! })));
    }
  }
  const checked = checkLoopHint(tableHint, operator, problem);
  candidates.push({ number: candidates.length + 1, source: "table", hint: tableHint, passed: checked.ok, ...(checked.ok ? {} : { reason: checked.reason }) });
  const selected = candidates.find((candidate) => candidate.source === "gemini" && candidate.passed);
  return store.createSuggestion({ lessonKey, problem, pattern, hint: selected?.hint ?? tableHint, count, generatedBy, candidates, aiFallback });
}

/** アシスタントを開いた時にだけ、未作成の型の候補を用意する。scopeOf は押した人の学級（権限が無ければ undefined）、mayUseAi は学級ごとの Gemini の上限 */
export function registerLoopAssistantRoutes<Env extends object>(app: Hono<Env>, rootStore: LoopStore, scopeOf: (context: Context) => string | undefined, mayUseAi: (workspaceId: string) => boolean): void {

  app.get("/api/v1/loop/assistant", async (context) => {
    const workspaceId = scopeOf(context);
    if (workspaceId === undefined) {
      const response = apiFailure("UNAUTHORIZED");
      return context.json(response.body, response.status as 401);
    }
    const store = rootStore.scope(workspaceId);
    const { generated, generations } = cachesOf(store);
    const summaries = store.summary();
    for (const summary of summaries) {
      for (const pattern of NAMED_PATTERNS) {
        if (!patternBelongsToChapter(pattern, summary.chapterId)) continue;
        const count = summary.patterns.find((entry) => entry.pattern === pattern)?.count ?? 0;
        if (count === 0) continue;
        const key = targetKey(summary.lessonKey, summary.problem, pattern);
        if (generated.has(key)) continue;
        const inFlight = generations.get(key);
        if (inFlight) {
          generated.set(key, await inFlight);
          continue;
        }
        const pending = store.findPending(summary.lessonKey, summary.problem, pattern);
        if (pending) {
          generated.set(key, pending);
          continue;
        }
        if (store.approvedHints(summary.lessonKey, summary.problem, pattern).length) continue;
        const generation = createSuggestion(context, store, summary.lessonKey, summary.problem, pattern, count, () => mayUseAi(workspaceId));
        generations.set(key, generation);
        try {
          const suggestion = await generation;
          if (isSuggestion(suggestion)) generated.set(key, suggestion);
        } finally {
          if (generations.get(key) === generation) generations.delete(key);
        }
      }
    }
    store.addAudit({ role: "teacher", action: "query", targetId: "loop-assistant", detail: null, reason: "学びの輪アシスタントを見る", result: "allowed" });
    return context.json({ items: buildAssistantItems(store, generated) });
  });

  app.post("/api/v1/loop/assistant/:id/alternatives", async (context) => {
    const workspaceId = scopeOf(context);
    if (workspaceId === undefined) {
      const response = apiFailure("UNAUTHORIZED");
      return context.json(response.body, response.status as 401);
    }
    const store = rootStore.scope(workspaceId);
    const { generated, generations } = cachesOf(store);
    const previous = store.findSuggestion(context.req.param("id"));
    if (!previous) {
      const response = apiFailure("NOT_FOUND");
      return context.json(response.body, response.status as 404);
    }
    if (previous.status !== "approved") {
      const response = apiFailure("ALREADY_DECIDED");
      return context.json(response.body, response.status as 409);
    }
    const unused = previous.candidates
      .filter((candidate) => candidate.passed && candidate.number !== previous.selectedCandidateNumber)
      .map((candidate, index) => ({ ...candidate, number: index + 1 }));
    if (unused.length === 0) {
      const response = apiFailure("NOT_FOUND");
      return context.json(response.body, response.status as 404);
    }
    const first = unused[0]!;
    const suggestion = store.createSuggestion({
      lessonKey: previous.lessonKey,
      problem: previous.problem,
      pattern: previous.pattern,
      hint: first.hint,
      count: store.patternCount(previous.lessonKey, previous.problem, previous.pattern),
      generatedBy: first.source,
      candidates: unused,
    });
    generated.set(targetKey(previous.lessonKey, previous.problem, previous.pattern), suggestion);
    store.addAudit({ role: "teacher", action: "suggest", targetId: suggestion.id, detail: first.source, reason: "別の検査済み候補を試す", result: "allowed" });
    return context.json(suggestion, 201);
  });

  app.post("/api/v1/loop/assistant/samples", async (context) => {
    const workspaceId = scopeOf(context);
    if (workspaceId === undefined) {
      const response = apiFailure("UNAUTHORIZED");
      return context.json(response.body, response.status as 401);
    }
    const store = rootStore.scope(workspaceId);
    const { generated, generations } = cachesOf(store);
    let body: unknown;
    try { body = await context.req.json(); } catch { body = undefined; }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      const response = apiFailure("ADULT_INVALID_REQUEST");
      return context.json(response.body, response.status as 400);
    }
    const request = body as Record<string, unknown>;
    const patterns = request.stage === "base" ? NAMED_PATTERNS : request.stage === "approved" && readNamedPattern(request.pattern) ? [readNamedPattern(request.pattern)!] : undefined;
    const total = patterns ? request.stage === "base" ? patterns.length * 11 : 5 : 0;
    if (!patterns || total > SAMPLE_BATCH_LIMIT) {
      const response = apiFailure("ADULT_INVALID_REQUEST");
      return context.json(response.body, response.status as 400);
    }
    const occurredAt = new Date().toISOString();
    let stumbles = 0;
    let afterHints = 0;
    for (const pattern of patterns) {
      if (request.stage === "base") {
        for (let index = 0; index < 6; index += 1) {
          const record = readStumble({ ...SAMPLE_PROBLEM, hintsShown: 0, pattern, source: "dummy", occurredAt });
          if (!record || !store.addStumble(record)) {
            const response = apiFailure("STORE_FULL");
            return context.json(response.body, response.status as 400);
          }
          stumbles += 1;
        }
      }
      for (let index = 0; index < 5; index += 1) {
        const record = readAfterHint({ lessonKey: SAMPLE_PROBLEM.lessonKey, problem: SAMPLE_PROBLEM.problem, pattern,
          hintVersion: request.stage === "approved" ? "approved" : "base",
          // 見本は「選ぶ前 40% → 選んだ後 80%」。効いた形を見せる（効かなかったときの「別の案を試す」はテストで確かめる）
          next: request.stage === "approved" ? (index < 4 ? "correct" : "same") : (index < 2 ? "correct" : "same"),
          source: "dummy", occurredAt });
        if (!record || !store.addAfterHint(record)) {
          const response = apiFailure("STORE_FULL");
          return context.json(response.body, response.status as 400);
        }
        afterHints += 1;
      }
    }
    store.addAudit({ role: "teacher", action: "query", targetId: "loop-assistant-samples", detail: String(request.stage), reason: "見本の記録を追加", result: "allowed" });
    return context.json({ received: true, stumbles, afterHints }, 201);
  });
}
