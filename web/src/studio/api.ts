import type { StudioLesson } from "./lesson-ir";
import type { StudioApi, StudioMode } from "./StudioPanel";
import type { EvidenceVersion } from "./EvidencePanel";
import type { TournamentAlternative } from "./Tournament";

export type StudioValidationResult = { ok: true } | { ok: false; issues: string[] };

export const STUDIO_FIXTURES: {
  valid: StudioLesson;
  invalidShape: unknown;
  invalidMath: unknown;
} = {
  valid: {
    schemaVersion: 1,
    objective: "分母をそろえる意味をタイルで考えます",
    strategy: "visual",
    problems: [{ kind: "calculate", left: { num: 1, den: 2 }, right: { num: 1, den: 3 }, operator: "+", hints: ["同じ大きさのタイルでうめられるか考えましょう"] }],
  },
  invalidShape: {
    schemaVersion: 1,
    objective: "分母をそろえます",
    strategy: "visual",
    problems: [{ kind: "unknown", left: { num: 1, den: 2 }, right: { num: 1, den: 3 }, hints: ["タイルを見ましょう"] }],
  },
  invalidMath: {
    schemaVersion: 1,
    objective: "分数をたしかめます",
    strategy: "numeric",
    problems: [{ kind: "calculate", left: { num: 1, den: 3 }, right: { num: 1, den: 2 }, operator: "-", hints: ["タイルを見ましょう"] }],
  },
};

export const STUDIO_MOCK_LESSON = STUDIO_FIXTURES.valid;

export type StudioDiff = { from: number; to: number; changes: { path: string; before: unknown; after: unknown }[]; fallbackReason?: string };

const apiBase = (import.meta.env.VITE_LOOP_API_URL as string | undefined) ?? "";

async function request<T>(method: "GET" | "POST", path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiBase + path, {
      method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("サーバーにつながりません");
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (json as { error?: { message?: string } } | null)?.error?.message;
    throw new Error(message ?? "教材スタジオの API で問題が起きました");
  }
  return json as T;
}

type StudioGeneration = { source: "mock" | "gemini"; model: string; elapsedMs: number };
type CompileResponse = { lesson?: StudioLesson; source: "mock" | "gemini"; model: string; elapsedMs: number; validation: StudioValidationResult };
type VersionResponse = { id: string; lessonId: string; number: number; lesson: StudioLesson; validation: StudioValidationResult; generation?: StudioGeneration };
type DecisionResponse = { version: VersionResponse };
type TournamentResponse = { alternatives: TournamentAlternative[]; source: "mock" | "gemini"; model: string; elapsedMs: number };
type PatchDraftResponse = { patch: { baseVersion: number; operations: unknown[] }; source: "mock" | "gemini"; model: string; elapsedMs: number };

/** サーバー API を使い、利用できない場合は明示してローカル見本へ切り替える。 */
export function createConnectedStudioApi(fallback: StudioApi): StudioApi {
  let offline = false;
  const lessons = new Map<string, Map<number, StudioLesson>>();
  const modes = new Map<string, StudioMode>();
  const tournamentGenerations = new WeakMap<StudioLesson, StudioGeneration>();
  const fallbackError = (error: unknown) => error instanceof Error ? error.message : "サーバーにつながりません";
  const useFallback = async <T extends { mode: StudioMode }>(operation: () => Promise<T>): Promise<T> => {
    offline = true;
    return { ...await operation(), fallbackReason: "server" } as T;
  };

  return {
    async generate(lessonKey, prompt) {
      if (offline) return useFallback(() => fallback.generate(lessonKey, prompt));
      try {
        const compiled = await request<CompileResponse>("POST", "/api/v1/studio/compile", { prompt });
        if (!compiled.validation.ok || !compiled.lesson) {
          return { draftId: "invalid-draft", lessonId: "invalid-draft", lesson: STUDIO_MOCK_LESSON, validation: compiled.validation, version: 1, mode: compiled.source === "gemini" ? "real" : "mock" };
        }
        const generation: StudioGeneration = { source: compiled.source, model: compiled.model, elapsedMs: compiled.elapsedMs };
        const version = await request<VersionResponse>("POST", "/api/v1/studio/lessons", { lesson: compiled.lesson, generation });
        lessons.set(version.lessonId, new Map([[version.number, version.lesson]]));
        const mode = compiled.source === "gemini" ? "real" : "mock";
        modes.set(version.lessonId, mode);
        return { draftId: version.lessonId, lessonId: version.lessonId, lesson: version.lesson, validation: version.validation, version: version.number, mode };
      } catch (error) {
        const draft = await useFallback(() => fallback.generate(lessonKey, prompt));
        return { ...draft, fallbackReason: fallbackError(error) };
      }
    },
    async createRevision(draft, prompt) {
      if (offline || !draft.lessonId) return useFallback(() => fallback.createRevision?.(draft, prompt) ?? Promise.reject(new Error("版を作れませんでした")));
      try {
        const suggestion = await request<PatchDraftResponse>("POST", "/api/v1/studio/patch-draft", { lesson: draft.lesson, prompt: prompt || draft.lesson.objective, baseVersion: draft.version });
        const generation: StudioGeneration = { source: suggestion.source, model: suggestion.model, elapsedMs: suggestion.elapsedMs };
        const result = await request<{ version: VersionResponse }>("POST", `/api/v1/studio/lessons/${encodeURIComponent(draft.lessonId)}/patch`, { patch: suggestion.patch, generation });
        const version = result.version;
        lessons.get(draft.lessonId)?.set(version.number, version.lesson);
        const mode = suggestion.source === "mock" ? "mock" : modes.get(draft.lessonId) ?? "real";
        modes.set(draft.lessonId, mode);
        return { ...draft, lesson: version.lesson, validation: version.validation, version: version.number, mode };
      } catch (error) {
        const revised = await useFallback(() => fallback.createRevision?.(draft, prompt) ?? Promise.reject(new Error("版を作れませんでした")));
        return { ...revised, fallbackReason: fallbackError(error) };
      }
    },
    async decide(draftId, decision, reason, headers, versionNumber = 1) {
      if (offline) return useFallback(() => fallback.decide(draftId, decision, reason, headers, versionNumber));
      try {
        const result = await request<DecisionResponse>("POST", `/api/v1/studio/lessons/${encodeURIComponent(draftId)}/versions/${versionNumber}/decision`, { decision, reason }, headers);
        return { status: decision, version: result.version.number, mode: modes.get(draftId) ?? "mock" };
      } catch (error) {
        const result = await useFallback(() => fallback.decide(draftId, decision, reason, headers, versionNumber));
        return { ...result, fallbackReason: fallbackError(error) };
      }
    },
    async revoke(draftId, reason, headers, versionNumber = 1) {
      if (offline) return useFallback(() => fallback.revoke(draftId, reason, headers, versionNumber));
      try {
        const result = await request<{ currentVersion: number | { number: number; lesson?: StudioLesson } }>("POST", `/api/v1/studio/lessons/${encodeURIComponent(draftId)}/versions/${versionNumber}/revoke`, { reason }, headers);
        // サーバーは戻り先の版のオブジェクトを返す。数で返す古い形も受ける。
        const restored = result.currentVersion;
        const number = typeof restored === "number" ? restored : restored.number;
        const lesson = (typeof restored === "number" ? undefined : restored.lesson) ?? lessons.get(draftId)?.get(number);
        return { status: "revoked", version: number, lesson, mode: modes.get(draftId) ?? "mock" };
      } catch (error) {
        const result = await useFallback(() => fallback.revoke(draftId, reason, headers, versionNumber));
        return { ...result, fallbackReason: fallbackError(error) };
      }
    },
    async tournament(prompt) {
      if (!fallback.tournament) throw new Error("3 つの教え方を作れません");
      if (offline) return { ...await fallback.tournament(prompt), fallbackReason: "server" };
      try {
        const result = await request<TournamentResponse>("POST", "/api/v1/studio/tournament", { prompt });
        for (const alternative of result.alternatives) {
          if (alternative.lesson) tournamentGenerations.set(alternative.lesson, {
            source: alternative.source, model: alternative.model, elapsedMs: alternative.elapsedMs,
          });
        }
        return result;
      } catch (error) {
        offline = true;
        return { ...await fallback.tournament(prompt), fallbackReason: fallbackError(error) };
      }
    },
    async adopt(lesson, mode) {
      if (!fallback.adopt) throw new Error("選んだ案を置けません");
      const local = fallback.adopt;
      if (offline) return useFallback(() => local(lesson, mode));
      try {
        const version = await request<VersionResponse>("POST", "/api/v1/studio/lessons", {
          lesson, ...(tournamentGenerations.get(lesson) ? { generation: tournamentGenerations.get(lesson) } : {}),
        });
        lessons.set(version.lessonId, new Map([[version.number, version.lesson]]));
        modes.set(version.lessonId, mode);
        return { draftId: version.lessonId, lessonId: version.lessonId, lesson: version.lesson, validation: version.validation, version: version.number, mode };
      } catch (error) {
        const draft = await useFallback(() => local(lesson, mode));
        return { ...draft, fallbackReason: fallbackError(error) };
      }
    },
    async versions(lessonId) {
      const result = await request<{ items: EvidenceVersion[] }>("GET", `/api/v1/studio/lessons/${encodeURIComponent(lessonId)}/versions`);
      return result.items;
    },
    async diff(draftId, from, to) {
      if (offline) return fallback.diff?.(draftId, from, to) ?? { from, to, changes: [] };
      try {
        const result = await request<StudioDiff>("GET", `/api/v1/studio/lessons/${encodeURIComponent(draftId)}/diff?from=${from}&to=${to}`);
        return result;
      } catch (error) {
        offline = true;
        return { ...(fallback.diff ? await fallback.diff(draftId, from, to) : { from, to, changes: [] }), fallbackReason: fallbackError(error) };
      }
    },
  };
}
