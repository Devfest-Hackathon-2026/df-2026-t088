import { Hono, type Context, type MiddlewareHandler } from "hono";
import { checkParts } from "./check/parts-check.ts";
import { parseExpression, type ParsedExpression } from "./check/expression.ts";
import { isSameFractionPair, readRequestedExpression } from "./request-check.ts";
import type { PartsData } from "./check/parts-check.ts";
import type { AiClient } from "./ai/client.ts";
import { GeminiAiClient } from "./ai/gemini-client.ts";
import { MockAiClient } from "./ai/mock-client.ts";
import { readAiSettings } from "./ai/settings.ts";
import type { ReflectionInput } from "./api-types.ts";
import { reduceFraction } from "./check/fraction.ts";
import { apiFailure } from "./errors.ts";
import { LIMITS } from "./limits.ts";
import { forwardedCount, readTrustedProxyHops, registerGuards } from "./guard.ts";
import { registerLoopRoutes } from "./loop/routes.ts";
import { createLoopStore, type LoopStore } from "./loop/store.ts";
import { readAiPerDay } from "./loop/ai-quota.ts";
import { readTeacherLogin } from "./teacher-login/config.ts";
import { registerGuestRoute } from "./teacher-login/guest.ts";
import { registerTeacherLoginRoutes, teacherMemberOf, teacherOwnerOf, teacherSessionValid, teacherWorkspaceOf, type TeacherLoginDeps } from "./teacher-login/routes.ts";
import { registerOriginGuard, registerPrivateCacheHeaders } from "./teacher-login/cookie-guards.ts";
import { registerWorkspaceRoutes } from "./workspace/routes.ts";
import { isPersistent } from "./workspace/firestore-store.ts";
import { createMemoryWorkspaceStore, readReadsPerDay } from "./workspace/store.ts";
import { createDailyTotal, DEFAULT_LOOP_AI_TOTAL_PER_DAY, DEFAULT_PRINT_READS_TOTAL_PER_DAY, DEFAULT_STUDIO_AI_TOTAL_PER_DAY, readTotalPerDay } from "./workspace/daily-total.ts";
import { registerTeacherMemberRoutes } from "./teacher-members/routes.ts";
import { registerStudioRoutes } from "./studio/routes.ts";
import { registerHomeRoutes } from "./home/routes.ts";
import { createHomeStore, type HomeStore } from "./home/store.ts";
import { registerPrintRoutes } from "./print/routes.ts";
import type { PrintHandoutsStore } from "./print/handouts-store.ts";
import { createFirestorePrintHandoutsStore, createPrintHandoutsStore } from "./print/handouts-store.ts";
import { PrintDemandStore } from "./print/demand.ts";

type AppVariables = { aiClient: AiClient; childAiClient: AiClient; trustedProxyHops: number };
type JsonRecord = Record<string, unknown>;
type AppContext = Context<{ Variables: AppVariables }>;
type AppLimits = { [Key in keyof typeof LIMITS]: number };

export function createApp(
  aiClient?: AiClient,
  environment: NodeJS.ProcessEnv = process.env,
  limitOverrides: Partial<AppLimits> = {},
  loopStore?: LoopStore,
  runtime: { now?: () => number; homeStore?: HomeStore; handoutsStore?: PrintHandoutsStore; teacherSignedIn?: (context: Context) => boolean; firestoreFetcher?: typeof fetch; teacherLoginDeps?: TeacherLoginDeps } = {},
) {
  const limits: AppLimits = { ...LIMITS, ...limitOverrides };
  const app = new Hono<{ Variables: AppVariables }>();
  const selectedClient = aiClient ?? selectAiClient(environment);
  const childClient = aiClient ?? selectChildAiClient(environment);
  app.use("*", async (context, next) => {
    const startedAt = Date.now();
    await next();
    const code = await readResponseCode(context);
    console.info(`${code} ${Date.now() - startedAt}ms`);
  });
  const trustedProxyHops = readTrustedProxyHops(environment);
  app.use("*", async (context, next) => {
    context.set("trustedProxyHops", trustedProxyHops);
    context.set("aiClient", selectedClient);
    context.set("childAiClient", childClient);
    await next();
  });

  app.get("/api/health", (context) => context.json({ status: "ok", forwardedCount: forwardedCount(context) }));
  // 回数の制限、JSON だけ、本文の大きさ。これより下の /api/v1 の経路すべてに掛かる
  registerGuards(app, limits, runtime.now);
  // 先生の Cookie（__session）の付いた書き込みの Origin 検査と、Cookie で変わる応答の Cache-Control。TEACHER_LOGIN=on のときだけ掛かる
  const teacherLogin = readTeacherLogin(environment, runtime.firestoreFetcher);
  registerOriginGuard(app, teacherLogin);
  registerPrivateCacheHeaders(app, teacherLogin);
  registerPartsRoutes(app, limits);
  // 学びの輪・教材スタジオ・プリントの型の承認で、監査の記録を共有する
  // 審査・デモの公開版だけ、デモの記録を少ない件数から学びの輪に出す（release で LOOP_DEMO_SEND が on のとき 1）
  const demoMinimum = Number.parseInt(environment.LOOP_DEMO_MIN_GROUP ?? "", 10);
  const sharedLoopStore = loopStore ?? createLoopStore(Number.isFinite(demoMinimum) ? { demoMinimum } : {});
  const firestoreDatabase = environment.PRINT_FIRESTORE_DATABASE?.trim() || undefined;
  const handoutsStore = runtime.handoutsStore ?? (firestoreDatabase
    ? createFirestorePrintHandoutsStore({ project: environment.GOOGLE_CLOUD_PROJECT, database: firestoreDatabase, fetcher: runtime.firestoreFetcher })
    : createPrintHandoutsStore());
  const workspaces = teacherLogin.enabled ? teacherLogin.workspaces : createMemoryWorkspaceStore({ readsPerDay: readReadsPerDay(environment) });
  // 学級を使うのは先生のログインが on のときだけ（Firestore 版もそのときだけ）。Firestore の学級は、起動時の読み込みが終わるまで使えない。待ち、失敗したら 503（空の学級を作り直さない）
  if (isPersistent(workspaces)) {
    const ready = () => workspaces.ready();
    ready().catch(() => console.error("workspace store: initial load failed"));
    const waitForWorkspaces: MiddlewareHandler = async (context, next) => {
      try {
        await ready();
      } catch {
        console.error("workspace store: not ready");
        const response = apiFailure("BUSY");
        return context.json(response.body, response.status as 503);
      }
      await next();
    };
    for (const path of ["/api/v1/teacher/*", "/api/v1/workspace", "/api/v1/join/*", "/api/v1/print/*"]) app.use(path, waitForWorkspaces);
  }
  const demandStore = new PrintDemandStore(firestoreDatabase
    ? { project: environment.GOOGLE_CLOUD_PROJECT, database: firestoreDatabase, fetcher: runtime.firestoreFetcher }
    : undefined);
  registerPrintRoutes(app, {
    timeoutMilliseconds: limits.timeoutMilliseconds,
    hedgeAfterMilliseconds: limits.printHedgeAfterMilliseconds,
    requestsPerMinute: limits.printRequestsPerMinute,
    auditStore: sharedLoopStore,
    approverKey: environment.LOOP_APPROVER_KEY,
    authorize: teacherLogin.enabled ? (context) => teacherSessionValid(teacherLogin, context) : undefined,
    childCapture: environment.PRINT_CHILD_CAPTURE === "on",
    handoutsStore,
    demandStore,
    workspaceOf: teacherLogin.enabled ? (context) => teacherWorkspaceOf(teacherLogin, context)?.id : undefined,
    countRead: (workspaceId) => workspaces.countRead(workspaceId, new Date()),
    // 学級コードで入った子どもの読み取り（その学級が childCapture を入れているときだけ通る）
    classOf: (code) => { const found = workspaces.byJoinCode(code); return found ? { id: found.id, childCapture: found.childCapture } : undefined; },
    // 学級ごとの回数に加えて、全学級の合計でも止める（だれでも学級を作れるときの費用の歯止め）
    readsTotal: createDailyTotal(readTotalPerDay(environment, "PRINT_READS_PER_DAY_TOTAL", DEFAULT_PRINT_READS_TOTAL_PER_DAY)),
  });
  // 学級。ログインが off のときは学級を作る入口が無いので、join は常に 404、PATCH は常に 401
  registerWorkspaceRoutes(app, {
    workspaces,
    handouts: handoutsStore,
    ownerOf: (context) => (teacherLogin.enabled ? teacherOwnerOf(teacherLogin, context) : undefined),
  });
  registerReflectionRoute(app, limits);
  // 先生のログイン。TEACHER_LOGIN=on か guest のときだけ、先生の経路がログインを要求する（既定は今のまま）
  registerTeacherLoginRoutes(app, teacherLogin, runtime.teacherLoginDeps);
  // お試しの学級（TEACHER_LOGIN=guest のときだけある）
  registerGuestRoute(app, teacherLogin, runtime.teacherLoginDeps?.now, environment);
  // 先生の役割の管理（#351）。管理者のログインだけで通す（承認キーでも、ログイン off でも通さない）
  registerTeacherMemberRoutes(app, teacherLogin);
  registerLoopRoutes(app, sharedLoopStore, {
    approverKey: environment.LOOP_APPROVER_KEY,
    // 学びの輪は学級ごとに分ける。先生は自分の学級の分だけ見る（open で入っただけの人も）。承認キーは審査・デモの入口として demo を見る
    workspaceOf: teacherLogin.enabled ? (context) => teacherWorkspaceOf(teacherLogin, context)?.id : undefined,
    keyWithLogin: teacherLogin.enabled && (teacherLogin.signup === "open" || teacherLogin.signup === "guest"),
    // 地域のまとめ（BigQuery）は、これまでどおり名簿の先生と承認キーだけ
    canViewRegion: teacherLogin.enabled ? (context) => teacherSessionValid(teacherLogin, context) && teacherMemberOf(teacherLogin, context) !== undefined : undefined,
    lookupWorkspace: (handoutId) => handoutsStore.workspaceIdOf(handoutId),
    aiPerDay: readAiPerDay(environment),
    aiTotal: createDailyTotal(readTotalPerDay(environment, "LOOP_AI_PER_DAY_TOTAL", DEFAULT_LOOP_AI_TOTAL_PER_DAY)),
    now: runtime.now ? () => new Date(runtime.now!()) : undefined,
    bigQuery: { dataset: environment.LOOP_BIGQUERY_DATASET, project: environment.GOOGLE_CLOUD_PROJECT, schoolId: environment.LOOP_BIGQUERY_SCHOOL_ID },
  });
  // 教材スタジオの Gemini を呼ぶ POST は、ログインの設定に関係なく、全体の 1 日の上限を掛ける
  registerStudioRoutes(app, { loopStore: sharedLoopStore, approverKey: environment.LOOP_APPROVER_KEY, aiTotal: createDailyTotal(readTotalPerDay(environment, "STUDIO_AI_PER_DAY_TOTAL", DEFAULT_STUDIO_AI_TOTAL_PER_DAY)) });
  // ファーストディスプレイ（#187）。提出物・時間割・提出。先生の提出の状況は承認キーか先生のログインで守る
  // 先生の管理（#196）の書く経路は、先生のログインだけで通す（承認キーでは通さない）。off のときは書けない
  registerHomeRoutes(app, runtime.homeStore ?? createHomeStore(), {
    approverKey: environment.LOOP_APPROVER_KEY,
    authorize: teacherLogin.enabled ? (context) => teacherSessionValid(teacherLogin, context) : undefined,
    // 課題と時間割は、見本の学級をみんなで共有している。TEACHER_SIGNUP=open で入っただけの人には書かせず、名簿にいる先生だけが書ける
    teacherSignedIn: runtime.teacherSignedIn ?? (teacherLogin.enabled ? (context) => teacherSessionValid(teacherLogin, context) && teacherMemberOf(teacherLogin, context) !== undefined : undefined),
  });

  app.onError((error, context) => {
    logFailure("internal", error);
    const response = apiFailure("INTERNAL");
    return context.json(response.body, response.status as 500);
  });
  return app;
}

async function readResponseCode(context: AppContext): Promise<string> {
  const contentType = context.res.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("json")) return "HTTP_" + context.res.status;
  try {
    const body: unknown = await context.res.clone().json();
    return isRecord(body) && isRecord(body.error) && typeof body.error.code === "string" ? body.error.code : "OK";
  } catch {
    // ログの読み取り失敗で、すでに作った応答を500に変えない。
    return "HTTP_" + context.res.status;
  }
}

function registerPartsRoutes(app: Hono<{ Variables: AppVariables }>, limits: AppLimits): void {
  app.post("/api/v1/parts", async (context) => {
    const body = await readJsonRecord(context);
    if (!body || typeof body.expression !== "string" || !body.expression.trim()) return fail(context, "INVALID_REQUEST");
    if (body.expression.length > limits.expressionLength) return fail(context, "TOO_LONG");
    const requested = readRequestedExpression(body.expression, limits.maxFractionTerm);
    if (!requested) return fail(context, "INVALID_REQUEST");
    return generateCheckedParts(
      context,
      limits,
      (client, signal) => client.createParts(body.expression as string, signal),
      (data) => matchesExpression(data, requested),
      body.expression,
    );
  });

  app.post("/api/v1/similar-problem", async (context) => {
    const body = await readJsonRecord(context);
    if (!body || typeof body.problem !== "string" || !body.problem.trim()) return fail(context, "INVALID_REQUEST");
    if (body.problem.length > limits.expressionLength) return fail(context, "TOO_LONG");
    const requested = readRequestedExpression(body.problem, limits.maxFractionTerm);
    if (!requested) return fail(context, "INVALID_REQUEST");
    return generateCheckedParts(
      context,
      limits,
      (client, signal) => client.createSimilarProblem(body.problem as string, signal),
      (data) => isDifferentSimilarExpression(data, requested),
    );
  });
}

function registerReflectionRoute(app: Hono<{ Variables: AppVariables }>, limits: AppLimits): void {
  app.post("/api/v1/reflection", async (context) => {
    const body = await readJsonRecord(context);
    if (!body) return fail(context, "INVALID_REQUEST");
    if (body.status !== "solved") return fail(context, "NOT_SOLVED");
    const input = validateReflection(body, limits);
    if (input === "too_long") return fail(context, "TOO_LONG");
    if (!input) return fail(context, "INVALID_REQUEST");
    let stage: FailureStage = "ai";
    try {
      const question = await withTimeout((signal) => context.get("childAiClient").createReflection(input, signal), limits.timeoutMilliseconds);
      stage = "check";
      if (!question.trim() || question.length > limits.questionLength) return fail(context, "AI_UNAVAILABLE");
      return context.json({ question });
    } catch (error) {
      logFailure(stage, error);
      return fail(context, error instanceof RequestTimeout ? "TIMEOUT" : "AI_UNAVAILABLE");
    }
  });
}

function selectAiClient(environment: NodeJS.ProcessEnv): AiClient {
  const settings = readAiSettings(environment);
  if (settings.mode === "mock") return new MockAiClient();
  return new GeminiAiClient(settings);
}

export function selectChildAiClient(_environment: NodeJS.ProcessEnv): AiClient {
  return new MockAiClient();
}

async function readJsonRecord(context: { req: { json: () => Promise<unknown> } }): Promise<JsonRecord | undefined> {
  try {
    const value: unknown = await context.req.json();
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateReflection(body: JsonRecord, limits: AppLimits): ReflectionInput | "too_long" | undefined {
  if (typeof body.problem !== "string" || !body.problem.trim()) return undefined;
  if (typeof body.message !== "string" || !body.message.trim()) return undefined;
  if (body.problem.length > limits.expressionLength || body.message.length > limits.explanationLength) return "too_long";
  if (!readRequestedExpression(body.problem, limits.maxFractionTerm)) return undefined;
  if (!Array.isArray(body.history)) return undefined;
  const recentHistory: unknown[] = body.history.slice(-limits.historyPairs * 2);
  if (!recentHistory.every(isHistoryItem)) return undefined;
  const history = recentHistory as ReflectionInput["history"];
  // 会話の文が長すぎるのは形の誤りではないので、説明と同じく TOO_LONG で返す（docs/product/education-api-contract.md）
  if (history.some((item) => item.text.length > limits.explanationLength)) return "too_long";
  return { problem: body.problem, status: "solved", message: body.message, history };
}

function isHistoryItem(value: unknown): value is ReflectionInput["history"][number] {
  return isRecord(value) && (value.role === "ai" || value.role === "child") && typeof value.text === "string";
}

async function generateCheckedParts(
  context: AppContext,
  limits: AppLimits,
  generate: (client: AiClient, signal: AbortSignal) => Promise<unknown>,
  matchesRequest: (data: unknown) => boolean,
  returnedProblem?: string,
): Promise<Response> {
  let stage: FailureStage = "ai";
  try {
    // 再試行の間で残り時間を共有する（1 回ごとに timeoutMilliseconds をまるごと使わない）
    const startedAt = Date.now();
    for (let attempt = 0; attempt <= limits.retries; attempt += 1) {
      stage = "ai";
      const remaining = limits.timeoutMilliseconds - (Date.now() - startedAt);
      if (remaining <= 0) throw new RequestTimeout();
      const data = await withTimeout((signal) => generate(context.get("childAiClient"), signal), remaining);
      stage = "check";
      if (checkParts(data).ok && matchesRequest(data)) return context.json(publicPartsData(data as PartsData, returnedProblem));
    }
    return fail(context, "PARTS_NOT_READY");
  } catch (error) {
    logFailure(stage, error);
    return fail(context, error instanceof RequestTimeout ? "TIMEOUT" : "AI_UNAVAILABLE");
  }
}

function publicPartsData(data: PartsData, returnedProblem?: string): PartsData {
  const answer = reduceFraction(data.answer);
  return {
    problem: returnedProblem ?? data.problem,
    tool: data.tool,
    pieces: data.pieces.map(({ num, den, count }) => ({ num, den, count })),
    answer: { num: answer.num, den: answer.den },
    hints: [...data.hints],
  };
}

function matchesExpression(data: unknown, expected: ParsedExpression): boolean {
  if (!isRecord(data) || typeof data.problem !== "string") return false;
  const actual = parseExpression(data.problem);
  return actual.ok && sameParsedExpression(actual.expression, expected);
}

function isDifferentSimilarExpression(data: unknown, original: ParsedExpression): boolean {
  if (!isRecord(data) || typeof data.problem !== "string") return false;
  const candidate = parseExpression(data.problem);
  return candidate.ok && candidate.expression.operator === original.operator
    && !isSameFractionPair(candidate.expression, original);
}

function sameParsedExpression(left: ParsedExpression, right: ParsedExpression): boolean {
  return left.operator === right.operator
    && sameFraction(left.left, right.left)
    && sameFraction(left.right, right.right);
}

function sameFraction(left: { num: number; den: number }, right: { num: number; den: number }): boolean {
  return left.num === right.num && left.den === right.den;
}

class RequestTimeout extends Error {
  override name = "RequestTimeout";
}

// 検算側の不具合（check）と AI 側の失敗（ai）を見分けるため、段階と例外の種類だけを残す。
// 例外の message は入力の本文を含みうるので出さない。子ども向けの code とは別に記録する。
type FailureStage = "ai" | "check" | "internal";

function logFailure(stage: FailureStage, error: unknown): void {
  const name = error instanceof Error ? error.name : "NonError";
  console.error(`failure stage=${stage} name=${name}`);
}

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

function fail(context: AppContext, code: Parameters<typeof apiFailure>[0]): Response {
  const response = apiFailure(code);
  return context.json(response.body, response.status as 400 | 409 | 422 | 429 | 500 | 503 | 504);
}
