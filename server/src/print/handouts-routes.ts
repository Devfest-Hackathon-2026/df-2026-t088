import { createHash, timingSafeEqual } from "node:crypto";
import type { Context, Env, Hono } from "hono";
import { apiFailure } from "../errors.ts";
import type { ApiErrorCode } from "../api-types.ts";
import { publicHandout, type PrintHandoutsStore } from "./handouts-store.ts";
import { validatePrintOutput } from "./validate.ts";
import { DEMO_WORKSPACE_ID } from "../workspace/store.ts";

// workspaceOf は、先生の Cookie が有効なときのその先生の学級の id。Cookie が無い・無効なら undefined
export type PrintHandoutRouteOptions = { store: PrintHandoutsStore; approverKey?: string; authorize?: (context: Context) => boolean; workspaceOf?: (context: Context) => string | undefined };

function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

function fail(context: Context, code: ApiErrorCode): Response {
  const response = apiFailure(code);
  return context.json(response.body, response.status as 400 | 401 | 404 | 429 | 503);
}

function storeUnavailable(context: Context): Response {
  console.error("print firestore failure count=1");
  return fail(context, "BUSY");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function registerPrintHandoutRoutes<E extends Env>(app: Hono<E>, options: PrintHandoutRouteOptions): void {
  const key = options.approverKey?.trim() || undefined;
  // 書く先の学級。先生の Cookie が先、承認キーは demo。Cookie は有効でも学級を用意できないとき（数の上限）は "full"
  const writeTarget = (context: Context): string | "full" | undefined => {
    const own = options.workspaceOf?.(context);
    if (own !== undefined) return own;
    if (options.authorize?.(context) === true) return options.workspaceOf ? "full" : DEMO_WORKSPACE_ID;
    if (key !== undefined && sameSecret(context.req.header("x-approver-key") ?? "", key)) return DEMO_WORKSPACE_ID;
    return undefined;
  };

  app.get("/api/v1/print/handouts", async (context) => {
    // 先生の Cookie があるときだけ、子どもが撮った説明も origin 付きで出す。ほかは先生が配ったものだけ（origin も出さない）
    const own = options.workspaceOf?.(context);
    try {
      if (own !== undefined) return context.json({ items: await options.store.list(own, { includeChild: true }) });
      return context.json({ items: (await options.store.list(DEMO_WORKSPACE_ID)).map(publicHandout) });
    }
    catch { return storeUnavailable(context); }
  });
  // リンクを持つ子どもが 1 件を読む。id は推測できない
  app.get("/api/v1/print/handouts/:id", async (context) => {
    try {
      const found = await options.store.get(context.req.param("id"));
      return found ? context.json(publicHandout(found)) : fail(context, "NOT_FOUND");
    } catch { return storeUnavailable(context); }
  });
  app.post("/api/v1/print/handouts", async (context) => {
    const target = writeTarget(context);
    if (target === undefined) return fail(context, "UNAUTHORIZED");
    if (target === "full") return fail(context, "STORE_FULL");
    let body: unknown;
    try { body = await context.req.json(); } catch { return fail(context, "ADULT_INVALID_REQUEST"); }
    if (!isRecord(body) || Object.keys(body).sort().join(",") !== "params,questionText,templateId") return fail(context, "ADULT_INVALID_REQUEST");
    const checked = validatePrintOutput({ problems: [{ templateId: body.templateId, questionText: body.questionText, params: body.params }], unsupportedCount: 0 });
    if (checked.problems.length !== 1 || checked.unsupportedCount !== 0 || checked.issues.length !== 0) return fail(context, "ADULT_INVALID_REQUEST");
    try { return context.json(publicHandout(await options.store.add(checked.problems[0]!, target)), 201); }
    catch { return storeUnavailable(context); }
  });
  app.delete("/api/v1/print/handouts/:id", async (context) => {
    const target = writeTarget(context);
    if (target === undefined) return fail(context, "UNAUTHORIZED");
    if (target === "full") return fail(context, "STORE_FULL");
    try {
      if (!await options.store.remove(context.req.param("id"), target)) return fail(context, "NOT_FOUND");
    } catch { return storeUnavailable(context); }
    return new Response(null, { status: 204 });
  });
}
