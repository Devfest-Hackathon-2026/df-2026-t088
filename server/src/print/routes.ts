import type { Context, Env, Hono } from "hono";
import type { AiClient, PrintReadInput } from "../ai/client.ts";
import { clientOf } from "../guard.ts";
import type { DailyTotal } from "../workspace/daily-total.ts";
import { LIMITS } from "../limits.ts";
import type { LoopStore } from "../loop/store.ts";
import { PrintDemandStore, type PrintDemandUnitId } from "./demand.ts";
import { registerPrintDemandRoute } from "./demand-routes.ts";
import { createPrintTemplateApprovalStore, type PrintTemplateApprovalStore } from "./approval.ts";
import { registerPrintTemplateRoutes } from "./template-routes.ts";
import { validatePrintOutput, type PrintProblem, type PrintValidation } from "./validate.ts";
import { createPrintHandoutsStore, type PrintHandoutsStore } from "./handouts-store.ts";
import { registerPrintHandoutRoutes } from "./handouts-routes.ts";
import { createHash, timingSafeEqual } from "node:crypto";

type AppVariables = { aiClient: AiClient };
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const MAX_ACTIVE_READS = 2;
const PRINT_RATE_WINDOW_MS = 60_000;
const MAX_TRACKED_RATE_KEYS = 5_000;
// Gemini はふだん 1〜2 秒で返るが、まれに 15〜30 秒かかる回がある（スマホ写真に近い写真で測定）。
// この時間を過ぎても返らないときは、同じ頼みをもう 1 本だけ出し、早く返った方を使う（hedged request）
const MIN_HEDGE_BUDGET_MS = 2_000;
// 学級コードは 6 文字。長すぎる値は引かずに無いものとして扱う
const CLASS_CODE_MAX = 16;
// 子どもの読み取りで返す型。分数は、読み違いをプログラムの検算で止められないので返さない（docs/product/education-api-contract.md）
const CHILD_TEMPLATES: ReadonlySet<string> = new Set(["rika-lever", "rika-moon"]);
const FRACTION_DEMAND_UNIT = "sansu-5-fraction";

function hasApproverKey(context: Context, configured?: string): boolean {
  const expected = configured?.trim();
  if (!expected) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(context.req.header("x-approver-key") ?? ""), digest(expected));
}

export function registerPrintRoutes<E extends Env>(app: Hono<E>, options: { timeoutMilliseconds?: number; hedgeAfterMilliseconds?: number; requestsPerMinute?: number; approvalStore?: PrintTemplateApprovalStore; handoutsStore?: PrintHandoutsStore; demandStore?: PrintDemandStore; auditStore?: Pick<LoopStore, "addAudit">; approverKey?: string; authorize?: (context: Context) => boolean; childCapture?: boolean; workspaceOf?: (context: Context) => string | undefined; countRead?: (workspaceId: string) => boolean; readsTotal?: DailyTotal; classOf?: (code: string) => { id: string; childCapture: boolean } | undefined } = {}): void {
  const approvalStore = options.approvalStore ?? createPrintTemplateApprovalStore();
  const handoutsStore = options.handoutsStore ?? createPrintHandoutsStore();
  const demandStore = options.demandStore ?? new PrintDemandStore();
  registerPrintTemplateRoutes(app, { approvalStore, auditStore: options.auditStore, approverKey: options.approverKey });
  registerPrintHandoutRoutes(app, { store: handoutsStore, approverKey: options.approverKey, authorize: options.authorize, workspaceOf: options.workspaceOf });
  registerPrintDemandRoute(app, demandStore, { approverKey: options.approverKey, authorize: options.authorize });
  const windows = new Map<string, { startedAt: number; count: number }>();
  let active = 0;
  app.post("/api/v1/print/read", async (context) => {
    const viaKey = hasApproverKey(context, options.approverKey);
    const viaTeacher = !viaKey && options.authorize?.(context) === true;
    // 学級コード（x-class-code）の道。承認キーも先生の Cookie も無く、その学級が「子どもの撮影」を入れているときだけ
    const classCode = context.req.header("x-class-code")?.trim() ?? "";
    const childClass = viaKey || viaTeacher || classCode === "" || classCode.length > CLASS_CODE_MAX ? undefined : options.classOf?.(classCode);
    const viaClass = childClass?.childCapture === true ? childClass : undefined;
    if (!options.childCapture && !viaKey && !viaTeacher && !viaClass) return failure(context, 401, "UNAUTHORIZED", "承認キーが必要か、合っていません");
    // 学級の 1 日の読み取りの回数は、先生の Cookie か学級コードのときに数える。承認キーのときは今のまま
    const readWorkspace = viaKey ? undefined : viaClass?.id ?? options.workspaceOf?.(context);
    const key = clientOf(context);
    const now = Date.now();
    for (const [tracked, window] of windows) if (now - window.startedAt >= PRINT_RATE_WINDOW_MS) windows.delete(tracked);
    if (windows.size >= MAX_TRACKED_RATE_KEYS && !windows.has(key)) windows.clear();
    let window = windows.get(key);
    if (!window || now - window.startedAt >= PRINT_RATE_WINDOW_MS) {
      window = { startedAt: now, count: 0 };
      windows.set(key, window);
    }
    window.count += 1;
    if (window.count > (options.requestsPerMinute ?? LIMITS.printRequestsPerMinute)) {
      // 1 日の上限（scope: "day"）と分け、画面が待つ時間を出せるようにする（#532）
      const retryAfterSeconds = Math.max(1, Math.ceil((window.startedAt + PRINT_RATE_WINDOW_MS - now) / 1000));
      return failure(context, 429, "RATE_LIMITED", "少し休んでから、もういちど押してね", now, { scope: "minute", retryAfterSeconds });
    }

    const image = await readImage(context);
    if (!image) return failure(context, 400, "IMAGE_INVALID", "しゃしんを読みこめませんでした。もう一度 とってください");
    const dimensions = jpegDimensions(image.bytes);
    if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || Math.max(dimensions.width, dimensions.height) > MAX_IMAGE_EDGE) {
      return failure(context, 400, "IMAGE_INVALID", "しゃしんを読みこめませんでした。もう一度 とってください");
    }
    if (active >= MAX_ACTIVE_READS) return failure(context, 503, "BUSY", "いま、たくさんの人が使っているよ。少し待ってからもういちど押してね");
    // 画像が読めない・混んでいて断る要求では、回数を使わない
    // 全学級の合計の上限は、学級ごとの回数を使う前に見る（合計で断るときは学級の回数を減らさない）
    // 全体の上限は、承認キー以外のすべて（Cookie なしの子どもの撮影も）に掛ける。学級ごとの回数は学級があるときだけ
    if (!viaKey && options.readsTotal?.available(new Date()) === false) {
      return failure(context, 429, "RATE_LIMITED", "今日は たくさん使われたので、読み取りは おやすみです。あした また使えます", Date.now(), viaClass ? { scope: "day" } : undefined);
    }
    if (readWorkspace !== undefined && options.countRead?.(readWorkspace) === false) {
      return failure(context, 429, "RATE_LIMITED", "今日の読み取りの回数を使い切りました。あしたまた使えます", Date.now(), viaClass ? { scope: "day" } : undefined);
    }
    if (!viaKey) options.readsTotal?.add(new Date());
    active += 1;
    const startedAt = Date.now();
    let code = "INTERNAL";
    let problemCount = 0;
    try {
      const aiClient = getAiClient(context);
      if (!aiClient.readPrint) {
        code = "AI_UNAVAILABLE";
        return failure(context, 503, code, "いまは、うまく作れないみたい。少し待ってからもういちど押してね");
      }
      const timeoutMilliseconds = options.timeoutMilliseconds ?? LIMITS.timeoutMilliseconds;
      const started = Date.now();
      let checked = validatePrintOutput(undefined);
      for (let attempt = 0; attempt <= LIMITS.retries; attempt += 1) {
        const remaining = timeoutMilliseconds - (Date.now() - started);
        if (remaining <= 0) throw new PrintTimeout();
        const input: PrintReadInput = {
          image: { mimeType: "image/jpeg", data: Buffer.from(image.bytes).toString("base64") },
          ...(attempt > 0 ? { validationIssues: checked.issues } : {}),
        };
        let output: unknown;
        try {
          output = await hedged((signal) => aiClient.readPrint!(input, signal), remaining, options.hedgeAfterMilliseconds ?? LIMITS.printHedgeAfterMilliseconds);
        } catch (error) {
          // AI 側の一時的な失敗（混雑など）は、時間が残っていれば 1 回だけ呼び直す。時間切れは呼び直さない
          if (error instanceof PrintTimeout || attempt >= LIMITS.retries) throw error;
          continue;
        }
        const next = validatePrintOutput(output);
        // 作り直しで説明できる問題が減ったら、前の結果を使う
        if (attempt === 0 || next.problems.length >= checked.problems.length) checked = next;
        if (next.issues.length === 0) break;
      }
      if (viaClass) checked = withoutChildUnsupported(checked);
      let demandRecorded = checked.unsupportedUnits.length > 0;
      let demandFailureCount = 0;
      for (const unitId of checked.unsupportedUnits) {
        try { await demandStore.record(unitId); }
        catch { demandFailureCount += 1; }
      }
      if (demandFailureCount > 0) {
        demandRecorded = false;
        console.error(`print firestore failure count=${demandFailureCount}`);
      }
      if (checked.problems.length > 0) {
        problemCount = checked.problems.length;
        code = "OK";
        // 子どもが撮った説明は、その学級に子どもの印つきで残す（間違えたときに学びの輪へ送れるように）。写真は残さない
        const handoutIds = viaClass ? await saveChildHandouts(handoutsStore, checked.problems, viaClass.id) : [];
        return context.json({
          problems: checked.problems.map(({ templateId, questionText, params }, index) => ({ templateId, questionText, params, approved: approvalStore.isApproved(templateId), ...(handoutIds[index] ? { handoutId: handoutIds[index] } : {}) })),
          unsupportedCount: checked.unsupportedCount,
          demandRecorded,
        }, 200, { "server-timing": `print-read;dur=${Date.now() - startedAt}` });
      }
      code = checked.unreadable ? "PRINT_UNREADABLE" : "PRINT_NOT_SUPPORTED";
      const status = code === "PRINT_UNREADABLE" ? 422 : 422;
      const message = code === "PRINT_UNREADABLE" ? "うまく読みこめませんでした。明るい所で とりなおしましょう" : "この問題の せつめいは、まだ ありません";
      return failure(context, status, code, message, startedAt, code === "PRINT_NOT_SUPPORTED" ? { demandRecorded } : undefined);
    } catch (error) {
      code = error instanceof PrintTimeout ? "TIMEOUT" : "AI_UNAVAILABLE";
      console.error(`print-read failure code=${code}`);
      return failure(context, code === "TIMEOUT" ? 504 : 503, code,
        code === "TIMEOUT" ? "思ったより時間がかかっているよ。もういちど押してね" : "いまは、うまく作れないみたい。少し待ってからもういちど押してね", startedAt);
    } finally {
      active -= 1;
      console.info(`print-read code=${code} elapsedMs=${Date.now() - startedAt} problemCount=${problemCount}`);
    }
  });
}

/** 子どもの読み取りでは、てこと月だけを返す。ほかの型（分数）は「対応していません」に数え、単元の需要に残す */
function withoutChildUnsupported(checked: PrintValidation): PrintValidation {
  const kept = checked.problems.filter((problem) => CHILD_TEMPLATES.has(problem.templateId));
  const dropped = checked.problems.length - kept.length;
  if (dropped === 0) return checked;
  const units = Array.from({ length: dropped }, () => FRACTION_DEMAND_UNIT as PrintDemandUnitId);
  return { ...checked, problems: kept, unsupportedCount: checked.unsupportedCount + dropped, unsupportedUnits: [...checked.unsupportedUnits, ...units] };
}

/** 保存した説明の id を、問題の順に返す。保存できないときは id なし（読み取りの結果は返す） */
async function saveChildHandouts(store: PrintHandoutsStore, problems: PrintProblem[], workspaceId: string): Promise<(string | undefined)[]> {
  try {
    const ids: string[] = [];
    for (const problem of problems) ids.push((await store.add(problem, workspaceId, "child")).id);
    return ids;
  } catch {
    console.error("print firestore failure count=1");
    return [];
  }
}

type ReadImage = { bytes: Uint8Array };

async function readImage(context: Context): Promise<ReadImage | undefined> {
  try {
    const form = await context.req.formData();
    const image = form.get("image");
    if ([...form.keys()].some((key) => key !== "image") || form.getAll("image").length !== 1) return undefined;
    if (!(image instanceof File) || image.type !== "image/jpeg" || image.size <= 0 || image.size > MAX_IMAGE_BYTES) return undefined;
    const bytes = new Uint8Array(await image.arrayBuffer());
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
    return { bytes };
  } catch {
    return undefined;
  }
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++]!;
    if (marker === 0xd9 || marker === 0xda) return undefined;
    if (marker >= 0xd0 && marker <= 0xd7 || marker === 0x01) continue;
    const length = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (length < 2 || offset + length > bytes.length) return undefined;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 7) return undefined;
      return { height: (bytes[offset + 3]! << 8) | bytes[offset + 4]!, width: (bytes[offset + 5]! << 8) | bytes[offset + 6]! };
    }
    offset += length;
  }
  return undefined;
}

function getAiClient(context: Context): AiClient {
  return (context as Context<{ Variables: AppVariables }>).get("aiClient");
}

function failure(context: Context, status: number, code: string, message: string, startedAt = Date.now(), extra?: Record<string, unknown>): Response {
  return context.json({ error: { code, message, ...extra } }, status as 400 | 422 | 429 | 503 | 504, {
    "server-timing": `print-read;dur=${Date.now() - startedAt}`,
  });
}

class PrintTimeout extends Error {}


/**
 * 1 本目が hedgeAfter までに返らなければ 2 本目を出し、先に成功した方を返す。出した分がすべて失敗したら、最後の失敗を投げる。
 * 全体の時間切れは PrintTimeout。終わったら残りの呼び出しは中断する
 */
async function hedged<T>(operation: (signal: AbortSignal) => Promise<T>, milliseconds: number, hedgeAfter: number): Promise<T> {
  const controllers: AbortController[] = [];
  const timers: NodeJS.Timeout[] = [];
  try {
    return await new Promise<T>((resolve, reject) => {
      let pending = 0;
      let lastError: unknown;
      let hedgeStarted = false;
      const launch = () => {
        const controller = new AbortController();
        controllers.push(controller);
        pending += 1;
        operation(controller.signal).then(resolve, (error: unknown) => {
          pending -= 1;
          lastError = error;
          // 早い失敗は呼び出し元の作り直し（1 回）に任せる。2 本出ているときは、もう 1 本を待つ
          if (pending === 0) reject(lastError);
        });
      };
      launch();
      if (hedgeAfter < milliseconds - MIN_HEDGE_BUDGET_MS) {
        timers.push(setTimeout(() => { if (!hedgeStarted) { hedgeStarted = true; launch(); } }, hedgeAfter));
      }
      timers.push(setTimeout(() => reject(new PrintTimeout()), milliseconds));
    });
  } finally {
    for (const timer of timers) clearTimeout(timer);
    for (const controller of controllers) controller.abort();
  }
}
