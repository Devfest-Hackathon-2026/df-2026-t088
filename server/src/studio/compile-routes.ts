import type { Context, Env, Hono } from "hono";
import type { AiClient, CompileLessonInput, DraftLessonPatchInput } from "../ai/client.ts";
import { apiFailure } from "../errors.ts";
import { clientOf } from "../guard.ts";
import { LIMITS } from "../limits.ts";
import { validateLessonIr, type LessonIrValidation } from "./validate-ir.ts";
import type { StudioLesson, StudioStrategy } from "./lesson-ir.ts";
import { readStudioPatch, type StudioPatch } from "./patch.ts";

type AppVariables = { aiClient: AiClient };
type JsonRecord = Record<string, unknown>;
type CompileResult = {
  lesson?: StudioLesson;
  validation: LessonIrValidation;
  attempts: LessonIrValidation[];
  source: "gemini" | "mock";
  model: string;
  elapsedMs: number;
};
type PatchDraft = StudioPatch;
type PatchResult = {
  patch?: PatchDraft;
  validation: LessonIrValidation;
  source: "gemini" | "mock";
  model: string;
  elapsedMs: number;
};

const DUPLICATE_MS = 1_000;
const MAX_ACTIVE_GENERATIONS = 2;
const AI_RATE_WINDOW_MS = 60_000;
const MAX_TRACKED_RATE_KEYS = 5_000;

export function registerStudioCompileRoutes<E extends Env>(app: Hono<E>, timeoutMilliseconds: number = LIMITS.timeoutMilliseconds): void {
  const pending = new Map<string, Promise<CompileResult | PatchResult>>();
  const completed = new Map<string, { expiresAt: number; result: CompileResult | PatchResult }>();
  const rateWindows = new Map<string, { startedAt: number; count: number }>();
  let activeGenerations = 0;

  app.use("/api/v1/studio/*", async (context, next) => {
    if (context.req.method !== "POST" || ![
      "/api/v1/studio/compile",
      "/api/v1/studio/patch-draft",
      "/api/v1/studio/tournament",
    ].includes(context.req.path)) {
      await next();
      return;
    }
    const key = clientOf(context);
    const now = Date.now();
    for (const [trackedKey, trackedWindow] of rateWindows) {
      if (now - trackedWindow.startedAt >= AI_RATE_WINDOW_MS) rateWindows.delete(trackedKey);
    }
    if (rateWindows.size >= MAX_TRACKED_RATE_KEYS && !rateWindows.has(key)) rateWindows.clear();
    let window = rateWindows.get(key);
    if (!window || now - window.startedAt >= AI_RATE_WINDOW_MS) {
      window = { startedAt: now, count: 0 };
      rateWindows.set(key, window);
    }
    window.count += 1;
    if (window.count > LIMITS.aiRequestsPerMinute) {
      const failure = apiFailure("RATE_LIMITED");
      return context.json(failure.body, failure.status as 429);
    }
    await next();
  });

  app.post("/api/v1/studio/compile", async (context) => {
    const body = await readBody(context);
    const input = body && readCompileInput(body);
    if (!input) return adultInvalid(context);
    const key = `compile:${JSON.stringify(input)}`;
    let result: CompileResult | PatchResult | undefined;
    try {
      result = await getOrGenerate(key, async () => {
        const client = getAiClient(context);
        if (!client.compileLesson) throw new AiUnavailable();
        const startedAt = Date.now();
        const attempts: LessonIrValidation[] = [];
        let lesson: unknown;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const remaining = timeoutMilliseconds - (Date.now() - startedAt);
          if (remaining <= 0) throw new RequestTimeout();
          const request: CompileLessonInput = {
            ...input,
            ...(attempt === 1 ? { validationIssues: (attempts.at(-1) as Extract<LessonIrValidation, { ok: false }>).issues } : {}),
          };
          lesson = await withTimeout((signal) => client.compileLesson!(request, signal), remaining);
          const validation = validateLessonIr(lesson);
          attempts.push(validation);
          if (validation.ok) {
            return { lesson: lesson as StudioLesson, validation, attempts, ...aiIdentity(client), elapsedMs: Date.now() - startedAt };
          }
        }
        return { validation: attempts.at(-1)!, attempts, ...aiIdentity(client), elapsedMs: Date.now() - startedAt };
      }, () => activeGenerations, (change) => { activeGenerations += change; }, pending, completed);
    } catch (error) {
      return aiFailure(context, error);
    }
    if (!result) return busy(context);
    const compileResult = result as CompileResult;
    if (compileResult.validation.ok && compileResult.lesson) {
      return context.json({ lesson: compileResult.lesson, source: compileResult.source, model: compileResult.model, elapsedMs: compileResult.elapsedMs, validation: compileResult.validation });
    }
    return context.json({
      error: { code: "LESSON_NOT_READY", message: "教材の検査に通りませんでした。先生が内容を確かめてください。" },
      source: compileResult.source, model: compileResult.model, elapsedMs: compileResult.elapsedMs,
      validation: compileResult.validation, attempts: compileResult.attempts,
    }, 422);
  });

  app.post("/api/v1/studio/patch-draft", async (context) => {
    const body = await readBody(context);
    const input = body && readPatchInput(body);
    if (!input) return adultInvalid(context);
    const validation = validateLessonIr(input.lesson);
    if (!validation.ok) return adultInvalid(context);
    const key = `patch:${JSON.stringify(input)}`;
    let result: CompileResult | PatchResult | undefined;
    try {
      result = await getOrGenerate(key, async () => {
        const client = getAiClient(context);
        if (!client.draftLessonPatch) throw new AiUnavailable();
        const startedAt = Date.now();
        const patch = await withTimeout((signal) => client.draftLessonPatch!(input, signal), timeoutMilliseconds);
        if (!isPatchDraft(patch) || patch.baseVersion !== input.baseVersion) {
          return {
            validation: { ok: false, issues: ["Teaching Patch の形または baseVersion を確認してください。"] },
            ...aiIdentity(client), elapsedMs: Date.now() - startedAt,
          };
        }
        return { patch, validation, ...aiIdentity(client), elapsedMs: Date.now() - startedAt };
      }, () => activeGenerations, (change) => { activeGenerations += change; }, pending, completed);
    } catch (error) {
      return aiFailure(context, error);
    }
    if (!result) return busy(context);
    const patchResult = result as PatchResult;
    if (patchResult.patch) {
      return context.json({ patch: patchResult.patch, source: patchResult.source, model: patchResult.model, elapsedMs: patchResult.elapsedMs, validation: patchResult.validation });
    }
    return context.json({
      error: { code: "PATCH_NOT_READY", message: "Teaching Patch の下書きを作れませんでした。内容を確かめてください。" },
      source: patchResult.source, model: patchResult.model, elapsedMs: patchResult.elapsedMs, validation: patchResult.validation,
    }, 422);
  });

  async function getOrGenerate(
    key: string,
    generate: () => Promise<CompileResult | PatchResult>,
    getActive: () => number,
    changeActive: (change: number) => void,
    inFlight: Map<string, Promise<CompileResult | PatchResult>>,
    cache: Map<string, { expiresAt: number; result: CompileResult | PatchResult }>,
  ): Promise<CompileResult | PatchResult | undefined> {
    for (const [cachedKey, cachedValue] of cache) {
      if (cachedValue.expiresAt <= Date.now()) cache.delete(cachedKey);
    }
    const current = inFlight.get(key);
    if (current) return current;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.result;
    if (getActive() >= MAX_ACTIVE_GENERATIONS) return undefined;
    changeActive(1);
    const task = generate().then((result) => {
      cache.set(key, { expiresAt: Date.now() + DUPLICATE_MS, result });
      return result;
    }).finally(() => {
      changeActive(-1);
      inFlight.delete(key);
    });
    inFlight.set(key, task);
    return task;
  }
}

function getAiClient(context: Context): AiClient {
  return (context as Context<{ Variables: AppVariables }>).get("aiClient");
}

function aiIdentity(client: AiClient): { source: "gemini" | "mock"; model: string } {
  const source = client.source ?? "mock";
  return { source, model: client.modelName ?? (source === "mock" ? "mock" : "unknown") };
}

async function readBody(context: Context): Promise<JsonRecord | undefined> {
  try {
    const body: unknown = await context.req.json();
    return isRecord(body) ? body : undefined;
  } catch {
    return undefined;
  }
}

function readCompileInput(body: JsonRecord): CompileLessonInput | undefined {
  if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 200) return undefined;
  if (body.strategy !== undefined && !isStrategy(body.strategy)) return undefined;
  return { prompt: body.prompt.trim(), ...(body.strategy ? { strategy: body.strategy } : {}) };
}

function readPatchInput(body: JsonRecord): DraftLessonPatchInput | undefined {
  if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 200) return undefined;
  if (!Number.isInteger(body.baseVersion) || (body.baseVersion as number) < 1 || !isRecord(body.lesson)) return undefined;
  return { lesson: body.lesson as unknown as StudioLesson, prompt: body.prompt.trim(), baseVersion: body.baseVersion as number };
}

// パッチの形は版の API（patch.ts）と同じものだけを通す。当てられない下書きは返さない
function isPatchDraft(value: unknown): value is PatchDraft {
  return readStudioPatch(value) !== undefined;
}

function onlyKeys(value: JsonRecord, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isStrategy(value: unknown): value is StudioStrategy {
  return value === "visual" || value === "numeric" || value === "misconception";
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function adultInvalid(context: Context): Response {
  const failure = apiFailure("ADULT_INVALID_REQUEST");
  return context.json(failure.body, failure.status as 400);
}

function busy(context: Context): Response {
  const failure = apiFailure("BUSY");
  return context.json(failure.body, failure.status as 503);
}

function aiFailure(context: Context, error: unknown): Response {
  const failure = apiFailure(error instanceof RequestTimeout ? "TIMEOUT" : "AI_UNAVAILABLE");
  return context.json(failure.body, failure.status as 503 | 504);
}

class RequestTimeout extends Error {}
class AiUnavailable extends Error {}

async function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMilliseconds: number): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new RequestTimeout());
          controller.abort();
        }, timeoutMilliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
