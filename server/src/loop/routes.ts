import { createHash, timingSafeEqual } from "node:crypto";
import type { Context, Hono } from "hono";
import type { ApiErrorCode } from "../api-types.ts";
import { apiFailure } from "../errors.ts";
import { createLoopStore, LOOP_LIMITS, type AuditInput, type LoopStore, type Role, type SuggestionCandidate } from "./store.ts";
import { HINT_BY_PATTERN, patternDraftsWithAi } from "./hint-table.ts";
import { parseExpression } from "../check/expression.ts";
import { checkLoopHint } from "./check-hint.ts";
import type { AiClient } from "../ai/client.ts";
import { isRole, readAfterHint, readLessonKey, readNamedPattern, readProblem, readStumble, readText } from "./validate.ts";
import { registerLoopAssistantRoutes } from "./assistant-routes.ts";
import { insertStumble, readRegionSummary, type BigQueryConfig } from "./bigquery.ts";
import { createAiQuota, DEFAULT_AI_PER_DAY } from "./ai-quota.ts";
import type { DailyTotal } from "../workspace/daily-total.ts";
import { DEMO_WORKSPACE_ID } from "../workspace/store.ts";

type JsonRecord = Record<string, unknown>;

function fail(context: Context, code: ApiErrorCode): Response {
  const response = apiFailure(code);
  return context.json(response.body, response.status as 400);
}

const SUGGESTION_ID = /^suggestion-\d{1,6}$/;
const INVALID_ID_LABEL = "（不正な番号）"; // 形の違う番号は、証跡に入れず、この固定の文字列にする

// 長さの違いも漏らさないよう、ハッシュにして比べる
function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

async function readBody(context: Context): Promise<JsonRecord | undefined> {
  try {
    const value: unknown = await context.req.json();
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonRecord) : undefined;
  } catch {
    return undefined;
  }
}

// app の Variables の型に依存しないよう、環境の型を受け取る
// 学びの輪は学級ごとに分ける。「だれの学級か」は scopeOf の 1 か所で決める
//   先生のログインが on のとき：先生の Cookie が有効ならその先生の学級（workspaceOf）。Cookie が無く承認キーが合えば demo（keyWithLogin のときだけ）。どちらも無ければ権限なし
//   ログインが off のとき：承認キーの決まりどおり（キーを決めていなければ通る）で、学級は demo
// workspaceOf は、先生のログインが on のときだけ入る。authorize は workspaceOf の無い古い呼び方（有効な Cookie なら demo として通す）
// keyWithLogin：ログインが on でも、承認キーを審査・デモの入口として残す（だれでも入れる TEACHER_SIGNUP=open か TEACHER_LOGIN=guest のとき）
// canViewRegion：地域のまとめ（BigQuery）は、これまでどおり名簿の先生（と承認キー）だけが読める
// lookupWorkspace：子どもが送る handoutId から学級の id を引く（見つからなければ undefined）
type LoopOptions = {
  approverKey?: string;
  workspaceOf?: (context: Context) => string | undefined;
  authorize?: (context: Context) => boolean;
  keyWithLogin?: boolean;
  canViewRegion?: (context: Context) => boolean;
  lookupWorkspace?: (handoutId: string) => Promise<string | undefined>;
  aiPerDay?: number;
  /** 全学級の合計の、Gemini を呼ぶ回数の 1 日の上限 */
  aiTotal?: DailyTotal;
  now?: () => Date;
  bigQuery?: BigQueryConfig;
};

// 配られた説明の id の形（uuid など）。形の違うものは学級を引かずに見つからない扱いにする
const HANDOUT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const readHandoutId = (value: unknown): string | undefined => (typeof value === "string" && HANDOUT_ID.test(value) ? value : undefined);

export function registerLoopRoutes<Env extends object>(app: Hono<Env>, rootStore: LoopStore = createLoopStore(), options: LoopOptions = {}): void {
  // 承認キーを決めたときだけ、承認と操作の記録の読み出しに要る。決めなければ通る（本人確認ではなく、共有の 1 つの鍵）
  const approverKey = options.approverKey?.trim() || undefined;
  const loginOn = options.workspaceOf !== undefined || options.authorize !== undefined;
  const keyMatches = (context: Context): boolean => approverKey !== undefined && sameSecret(context.req.header("x-approver-key") ?? "", approverKey);
  const ownWorkspace = (context: Context): string | undefined => {
    if (options.workspaceOf) return options.workspaceOf(context);
    return options.authorize?.(context) ? DEMO_WORKSPACE_ID : undefined;
  };
  const scopeOf = (context: Context): string | undefined => {
    if (!loginOn) return !approverKey || keyMatches(context) ? DEMO_WORKSPACE_ID : undefined;
    return ownWorkspace(context) ?? (options.keyWithLogin === true && keyMatches(context) ? DEMO_WORKSPACE_ID : undefined);
  };
  // 権限が要らない読み書き（子どもの送信・まとめの読み出しなど）は、入っていれば自分の学級、いなければ demo
  const scopeOrDemo = (context: Context): string => scopeOf(context) ?? DEMO_WORKSPACE_ID;
  const canViewRegion = (context: Context): boolean => Boolean((options.canViewRegion ?? options.authorize)?.(context)) || keyMatches(context);
  const aiQuota = createAiQuota(options.aiPerDay ?? DEFAULT_AI_PER_DAY, options.now, options.aiTotal);
  // 子どもの送信は学級の id を受け取らない。handoutId から引き、無い・見つからないときは demo
  const workspaceOfHandout = async (handoutId: unknown): Promise<string | undefined> => {
    const id = readHandoutId(handoutId);
    return id && options.lookupWorkspace ? options.lookupWorkspace(id) : undefined;
  };

  // 断った事実も証跡に残す。形が読めない要求は、文が読めず記録にならないので残さない。
  const deny = (store: LoopStore, context: Context, entry: Omit<AuditInput, "result">, code: ApiErrorCode) => {
    store.addAudit({ ...entry, result: "denied" });
    return fail(context, code);
  };

  app.post("/api/v1/stumbles", async (context) => {
    const body = await readBody(context);
    const stumble = body && readStumble(body);
    if (!stumble) return fail(context, "ADULT_INVALID_REQUEST");
    let workspaceId: string | undefined;
    try {
      workspaceId = await workspaceOfHandout(body?.handoutId);
    } catch {
      // 学級を引けないまま demo に入れると、よその学級の記録が混ざる。入れずに断る
      return fail(context, "INTERNAL");
    }
    if (!rootStore.scope(workspaceId ?? DEMO_WORKSPACE_ID).addStumble(stumble)) return fail(context, "STORE_FULL");
    if (options.bigQuery?.dataset) {
      try {
        await insertStumble(options.bigQuery, stumble);
      } catch {
        console.warn("BigQuery へ送れなかった記録: 1件");
        return context.json({ received: true, bigQuery: "pending" }, 202);
      }
    }
    return context.json({ received: true }, 201);
  });

  app.get("/api/v1/loop/region", async (context) => {
    if (!options.bigQuery?.dataset) return fail(context, "NOT_FOUND");
    if (!canViewRegion(context)) return fail(context, "UNAUTHORIZED");
    try {
      return context.json({ items: await readRegionSummary(options.bigQuery) });
    } catch {
      return fail(context, "INTERNAL");
    }
  });

  // ヒントを見たあとの最初の答え。1 問につき 1 回。名前・番号・時刻は受けない
  app.post("/api/v1/after-hints", async (context) => {
    const body = await readBody(context);
    const record = body && readAfterHint(body);
    if (!record) return fail(context, "ADULT_INVALID_REQUEST");
    let workspaceId: string | undefined;
    try {
      workspaceId = await workspaceOfHandout(body?.handoutId);
    } catch {
      return fail(context, "INTERNAL");
    }
    // 説明の id が無いときは、入っている人の学級（研究の画面から入れる分）、いなければ demo
    if (!rootStore.scope(workspaceId ?? scopeOrDemo(context)).addAfterHint(record)) return fail(context, "STORE_FULL");
    return context.json({ received: true }, 201);
  });

  // 進み具合と、前後の比べ。個々の記録は返さず、5 件未満の区画は出さない。読んだ事実は証跡に残す
  app.get("/api/v1/themes/hint-effect", (context) => {
    const role = context.req.query("role");
    if (!isRole(role)) return fail(context, "ADULT_INVALID_REQUEST");
    const store = rootStore.scope(scopeOrDemo(context));
    store.addAudit({ role, action: "query", targetId: "theme-hint-effect", detail: null, reason: null, result: "allowed" });
    return context.json(store.hintEffect());
  });

  app.post("/api/v1/stumbles/query", async (context) => {
    const body = await readBody(context);
    const purpose = readText(body?.purpose);
    const scope = body?.scope;
    if (!body || !isRole(body.role) || (scope !== "summary" && scope !== "records") || !purpose) return fail(context, "ADULT_INVALID_REQUEST");
    // period は summary だけで使う。today か 7days 以外、records に付いたものは断る（契約「summary だけで使う」）
    const period = body.period;
    if (period !== undefined && (scope !== "summary" || (period !== "today" && period !== "7days"))) return fail(context, "ADULT_INVALID_REQUEST");
    const entry = { role: body.role, action: "query" as const, targetId: scope, detail: null, reason: purpose };
    const workspaceId = scopeOf(context);
    const store = rootStore.scope(workspaceId ?? DEMO_WORKSPACE_ID);
    if (scope === "records" && body.role !== "teacher") return deny(store, context, entry, "SCOPE_NOT_ALLOWED");
    // 1 件ずつの記録は、承認キーか先生のログインが要る（#279）。まとめ（5 件未満は出さない）は先生の画面がキーなしで読むので今まで通り
    if (scope === "records" && workspaceId === undefined) return fail(context, "UNAUTHORIZED");
    if (body.role === "teacher" && loginOn && workspaceId === undefined) return fail(context, "UNAUTHORIZED");
    store.addAudit({ ...entry, result: "allowed" });
    return context.json(scope === "summary" ? { scope, items: store.summary(period) } : { scope, items: store.records() });
  });

  app.post("/api/v1/suggestions", async (context) => {
    const body = await readBody(context);
    const lessonKey = readLessonKey(body?.lessonKey);
    const problem = readProblem(body?.problem);
    const purpose = readText(body?.purpose);
    const pattern = readNamedPattern(body?.pattern);
    if (!body || !isRole(body.role) || !lessonKey || !problem || !purpose || !pattern) return fail(context, "ADULT_INVALID_REQUEST");
    // 提案の作成は、先生の画面がキーなしで呼ぶ。作った提案は承認（キーが要る）を通るまで子どもに出ないので、ここではログインだけを見る（#279 で判断）
    const workspaceId = scopeOf(context);
    if (body.role === "teacher" && loginOn && workspaceId === undefined) return fail(context, "UNAUTHORIZED");
    const workspace = workspaceId ?? DEMO_WORKSPACE_ID;
    const store = rootStore.scope(workspace);
    const entry = { role: body.role, action: "suggest" as const, targetId: null, detail: null, reason: purpose };
    const count = store.patternCount(lessonKey, problem, pattern);
    const existing = store.findPending(lessonKey, problem, pattern);
    if (existing) {
      store.addAudit({ ...entry, targetId: existing.id, detail: existing.generatedBy, result: "allowed" });
      return context.json(existing, 200);
    }
    if (!store.patternVisible(lessonKey, problem, pattern)) return deny(store, context, entry, "NOT_ENOUGH_RECORDS");
    const parsedProblem = parseExpression(problem);
    const operator = parsedProblem.ok ? parsedProblem.expression.operator : "+";
    const hint = operator === "+" ? HINT_BY_PATTERN[pattern] : HINT_BY_PATTERN[pattern]
      .replace(/たそう|足そう/g, "ひこう").replace(/たそ|足そ/g, "ひこ")
      .replace(/たす|足す|たし|足し/g, "ひく").replace(/加算/g, "ひき算");
    const candidates: SuggestionCandidate[] = [];
    let generatedBy: "table" | "gemini" = "table";
    let aiFallback: "check_failed" | "timeout" | "error" | undefined;
    const aiClient = (context as unknown as Context<{ Variables: { aiClient: AiClient } }>).get("aiClient");
    // 学級ごとの 1 日の上限を超えたら、Gemini を呼ばずに表の案だけにする
    // ログインが on のとき、Cookie も承認キーも無い人（role を先生以外にして送る道）には Gemini を呼ばない。上限を数えない demo に流れて、費用の歯止めを避けられるため
    if (aiClient?.loopHintDraftEnabled && patternDraftsWithAi(pattern) && (!loginOn || workspaceId !== undefined) && aiQuota.take(workspace)) {
      if (parsedProblem.ok) {
        try {
          const results = await withHintTimeout(
            (signal) => Promise.allSettled(Array.from({ length: 3 }, () =>
              aiClient.draftLoopHint?.({ pattern, operator }, signal)
              ?? Promise.reject(new Error("AI の下書き機能がありません。")))),
            8_000,
          );
          for (const result of results) {
            if (result.status === "rejected") {
              candidates.push({ number: candidates.length + 1, source: "gemini", hint: "", passed: false, reason: "error" });
              continue;
            }
            const checked = checkLoopHint(result.value, operator, problem);
            candidates.push({ number: candidates.length + 1, source: "gemini", hint: result.value.trim(), passed: checked.ok, ...(checked.ok ? {} : { reason: checked.reason }) });
          }
          const firstPassingAi = candidates.find((candidate) => candidate.source === "gemini" && candidate.passed);
          if (firstPassingAi) generatedBy = "gemini";
          else aiFallback = candidates.some((candidate) => candidate.reason === "error") ? "error" : "check_failed";
        } catch (error) {
          aiFallback = error instanceof HintTimeout ? "timeout" : "error";
          candidates.push(...Array.from({ length: 3 }, (_, index) => ({ number: index + 1, source: "gemini" as const, hint: "", passed: false, reason: aiFallback! })));
        }
      } else {
        aiFallback = "check_failed";
        candidates.push(...Array.from({ length: 3 }, (_, index) => ({ number: index + 1, source: "gemini" as const, hint: "", passed: false, reason: "check_failed" as const })));
      }
    }
    const tableCheck = checkLoopHint(hint, operator, problem);
    candidates.push({ number: candidates.length + 1, source: "table", hint, passed: tableCheck.ok, ...(tableCheck.ok ? {} : { reason: tableCheck.reason }) });
    const selectedDefault = candidates.find((candidate) => candidate.source === "gemini" && candidate.passed);
    // AI の待ち時間中に同じ提案ができていれば、それを返す
    const pending = store.findPending(lessonKey, problem, pattern);
    if (pending) {
      store.addAudit({ ...entry, targetId: pending.id, detail: pending.generatedBy, result: "allowed" });
      return context.json(pending, 200);
    }
    const created = store.createSuggestion({ lessonKey, problem, pattern, hint: selectedDefault?.hint ?? hint, count, generatedBy, candidates, aiFallback });
    store.addAudit({ ...entry, targetId: created.id, detail: generatedBy, result: "allowed" });
    return context.json(created, 201);
  });

  app.post("/api/v1/suggestions/:id/decision", async (context) => {
    const workspaceId = scopeOf(context);
    if (workspaceId === undefined) return fail(context, "UNAUTHORIZED");
    const store = rootStore.scope(workspaceId);
    const body = await readBody(context);
    const reason = readText(body?.reason);
    const decision = body?.decision;
    if (!body || !isRole(body.role) || (decision !== "approved" && decision !== "rejected") || !reason) return fail(context, "ADULT_INVALID_REQUEST");
    const candidateNumber = body.candidateNumber;
    if (candidateNumber !== undefined && (typeof candidateNumber !== "number" || !Number.isInteger(candidateNumber) || candidateNumber < 1)) return fail(context, "ADULT_INVALID_REQUEST");
    const id = context.req.param("id");
    const entry = { role: body.role as Role, action: "decide" as const, targetId: SUGGESTION_ID.test(id) ? id : INVALID_ID_LABEL, detail: decision, reason };
    if (body.role !== "teacher") return deny(store, context, entry, "SCOPE_NOT_ALLOWED");
    const target = store.findSuggestion(id);
    if (!target) return deny(store, context, entry, "NOT_FOUND");
    if (target.status !== "pending") return deny(store, context, entry, "ALREADY_DECIDED");
    const selected = decision === "approved"
      ? target.candidates.find((candidate) => candidate.number === candidateNumber && candidate.passed)
        ?? (candidateNumber === undefined ? target.candidates.find((candidate) => candidate.passed) : undefined)
      : undefined;
    if (decision === "approved" && !selected) return fail(context, "ADULT_INVALID_REQUEST");
    const replaced = store.decide(id, decision, selected?.number);
    const detail = selected ? `approved;candidate:${selected.number};source:${selected.source}` : decision;
    const auditEntry = { ...entry, detail };
    store.addAudit({ ...auditEntry, result: "allowed" });
    for (const replacedId of replaced) {
      store.addAudit({ role: body.role, action: "revoke", targetId: replacedId, detail: `replaced-by:${id}`, reason: "新しい承認で置き換え", result: "allowed" });
    }
    return context.json({ id, status: decision, replaced });
  });

  app.post("/api/v1/suggestions/:id/revoke", async (context) => {
    const workspaceId = scopeOf(context);
    if (workspaceId === undefined) return fail(context, "UNAUTHORIZED");
    const store = rootStore.scope(workspaceId);
    const body = await readBody(context);
    const reason = readText(body?.reason);
    if (!body || !isRole(body.role) || !reason) return fail(context, "ADULT_INVALID_REQUEST");
    const id = context.req.param("id");
    const entry = { role: body.role as Role, action: "revoke" as const, targetId: SUGGESTION_ID.test(id) ? id : INVALID_ID_LABEL, detail: "revoked", reason };
    if (body.role !== "teacher") return deny(store, context, entry, "SCOPE_NOT_ALLOWED");
    const target = store.findSuggestion(id);
    if (!target) return deny(store, context, entry, "NOT_FOUND");
    if (target.status !== "approved") return deny(store, context, entry, "ALREADY_DECIDED");
    store.revoke(id);
    store.addAudit({ ...entry, result: "allowed" });
    return context.json({ id, status: "revoked" });
  });

  // 子どもの記録は含まない。承認された直し方だけを返す。証跡は残さない。
  // 学級は handoutId（配られた説明）から引く。無い・見つからないときは demo の分
  app.get("/api/v1/approved-hints", async (context) => {
    const lessonKey = readLessonKey(context.req.query("lessonKey"));
    const problem = readProblem(context.req.query("problem"));
    const patternQuery = context.req.query("pattern");
    const pattern = patternQuery === undefined ? undefined : readNamedPattern(patternQuery);
    if (!lessonKey || !problem || (patternQuery !== undefined && !pattern)) return fail(context, "ADULT_INVALID_REQUEST");
    let workspaceId: string | undefined;
    try {
      workspaceId = await workspaceOfHandout(context.req.query("handoutId"));
    } catch {
      return fail(context, "INTERNAL");
    }
    return context.json({ items: rootStore.scope(workspaceId ?? DEMO_WORKSPACE_ID).approvedHints(lessonKey, problem, pattern) });
  });

  app.get("/api/v1/audit-log", (context) => {
    const workspaceId = scopeOf(context);
    if (workspaceId === undefined) return fail(context, "UNAUTHORIZED");
    const store = rootStore.scope(workspaceId);
    const role = context.req.query("role");
    if (!isRole(role)) return fail(context, "ADULT_INVALID_REQUEST");
    const items = store.auditLog();
    store.addAudit({ role, action: "audit-read", targetId: "audit-log", detail: null, reason: null, result: "allowed" });
    return context.json({ items });
  });

  registerLoopAssistantRoutes(app, rootStore, scopeOf, (workspaceId) => aiQuota.take(workspaceId));
}

class HintTimeout extends Error {}

async function withHintTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMilliseconds: number): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new HintTimeout());
        }, timeoutMilliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
