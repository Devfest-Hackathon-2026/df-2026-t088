import type { Context, Env, Hono } from "hono";
import type { AiClient, CompileLessonInput } from "../ai/client.ts";
import { apiFailure } from "../errors.ts";
import { clientOf } from "../guard.ts";
import { LIMITS } from "../limits.ts";
import { validateLessonIr, type LessonIrValidation } from "./validate-ir.ts";
import type { StudioLesson, StudioStrategy } from "./lesson-ir.ts";

type AppVariables = { aiClient: AiClient };
type JsonRecord = Record<string, unknown>;
type Checks = { structure: boolean; arithmetic: boolean; answerLeak: boolean; hintWording: boolean };
type TournamentAlternative = {
  strategy: StudioStrategy;
  lesson?: StudioLesson;
  validation: LessonIrValidation;
  checks: Checks;
  /** 1 回目が検査に落ち、理由を添えて作り直したか */
  retried: boolean;
  elapsedMs: number;
  source: "gemini" | "mock";
  model: string;
};

const STRATEGIES: readonly StudioStrategy[] = ["visual", "numeric", "misconception"];
const MAX_ACTIVE_TOURNAMENTS = 2;

export function registerStudioTournamentRoutes<E extends Env>(app: Hono<E>, timeoutMilliseconds: number = LIMITS.timeoutMilliseconds): void {
  let activeTournaments = 0;

  app.post("/api/v1/studio/tournament", async (context) => {
    const body = await readBody(context);
    if (!body || typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 200) return invalid(context);
    if (activeTournaments >= MAX_ACTIVE_TOURNAMENTS) return failure(context, "BUSY");
    activeTournaments += 1;
    try {
      return await generateTournament(context, body.prompt.trim(), timeoutMilliseconds);
    } finally {
      activeTournaments -= 1;
    }
  });
}

async function generateTournament(context: Context, prompt: string, timeoutMilliseconds: number): Promise<Response> {
  const client = (context as unknown as Context<{ Variables: AppVariables }>).get("aiClient");
  if (!client.compileLesson) return failure(context, "AI_UNAVAILABLE");
  const controller = new AbortController();
  const startedAt = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new RequestTimeout());
      }, timeoutMilliseconds);
    });
    const generation = Promise.all(STRATEGIES.map(async (strategy): Promise<TournamentAlternative> => {
      const strategyStartedAt = Date.now();
      let value = await client.compileLesson!({ prompt, strategy } satisfies CompileLessonInput, controller.signal);
      let validation = validateLessonIr(value);
      let retried = false;
      if (!validation.ok) {
        retried = true;
        value = await client.compileLesson!({ prompt, strategy, validationIssues: validation.issues } satisfies CompileLessonInput, controller.signal);
        validation = validateLessonIr(value);
      }
      return {
        strategy,
        ...(isLessonShape(value) ? { lesson: value } : {}),
        validation,
        checks: checksFor(validation),
        retried,
        elapsedMs: Date.now() - strategyStartedAt,
        source: client.source ?? "mock",
        model: client.modelName ?? (client.source === "gemini" ? "unknown" : "mock"),
      };
    }));
    const alternatives = await Promise.race([generation, timeout]);
    return context.json({
      alternatives,
      source: client.source ?? "mock",
      model: client.modelName ?? (client.source === "gemini" ? "unknown" : "mock"),
      elapsedMs: Date.now() - startedAt,
      learningEffect: { status: "not_measured" as const },
    });
  } catch (error) {
    return failure(context, error instanceof RequestTimeout ? "TIMEOUT" : "AI_UNAVAILABLE");
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function checksFor(validation: LessonIrValidation): Checks {
  const issues = validation.ok ? [] : validation.issues;
  return {
    structure: !issues.some((issue) => /教材の形|schemaVersion|指導のねらい|問題は|問題\d+の形|種類は|演算子は|ヒントは/.test(issue)),
    arithmetic: !issues.some((issue) => /分数は|ひき算の答え|ひき算を計算|計算結果|タイル/.test(issue)),
    answerLeak: !issues.some((issue) => issue.includes("答えが書かれています")),
    hintWording: !issues.some((issue) => /のヒント「/.test(issue)),
  };
}

function isLessonShape(value: unknown): value is StudioLesson {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.objective !== "string"
    || (value.strategy !== "visual" && value.strategy !== "numeric" && value.strategy !== "misconception")
    || !Array.isArray(value.problems)) return false;
  return value.problems.every((problem) => isRecord(problem)
    && (problem.kind === "calculate" || problem.kind === "common" || problem.kind === "compare")
    && isRecord(problem.left) && typeof problem.left.num === "number" && typeof problem.left.den === "number"
    && isRecord(problem.right) && typeof problem.right.num === "number" && typeof problem.right.den === "number"
    && Array.isArray(problem.hints) && problem.hints.every((hint) => typeof hint === "string"));
}

async function readBody(context: Context): Promise<JsonRecord | undefined> {
  try {
    const body: unknown = await context.req.json();
    return isRecord(body) ? body : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class RequestTimeout extends Error {}

function invalid(context: Context): Response {
  return failure(context, "ADULT_INVALID_REQUEST");
}

function failure(context: Context, code: "ADULT_INVALID_REQUEST" | "AI_UNAVAILABLE" | "TIMEOUT" | "BUSY"): Response {
  const result = apiFailure(code);
  return context.json(result.body, result.status as 400 | 503 | 504);
}
