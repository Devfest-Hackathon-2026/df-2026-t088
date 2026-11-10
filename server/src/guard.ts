// 公開する前の最小の守り。回数の制限、JSON だけを受ける、本文の大きさの制限。
// 決まりの正本は docs/product/education-api-contract.md「守りの設定（仮）」。認証ではない。
import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ApiErrorCode } from "./api-types.ts";
import { apiFailure } from "./errors.ts";
import { isSubmissionRequest } from "./home/routes.ts";

export type GuardLimits = { bodyBytes: number; printBodyBytes?: number; requestsPerMinute: number; aiRequestsPerMinute: number; submissionRequestsPerMinute: number };

const WINDOW_MS = 60_000;
const MAX_TRACKED = 5000; // 数えている接続元の上限。超えたら、古いものから捨てて、メモリを増やさない
const AI_PATHS = new Set(["/api/v1/parts", "/api/v1/similar-problem", "/api/v1/reflection", "/api/v1/suggestions"]);

function refuse(context: Context, code: ApiErrorCode): Response {
  const failure = apiFailure(code);
  return context.json(failure.body, failure.status as 400);
}

const MAX_TRUSTED_HOPS = 10;

/** TRUSTED_PROXY_HOPS を読む。数でない・1 未満・大きすぎる値は 1（いまの動き）として扱う */
export function readTrustedProxyHops(environment: NodeJS.ProcessEnv): number {
  const text = environment.TRUSTED_PROXY_HOPS?.trim() ?? "";
  if (!/^\d+$/.test(text)) return 1;
  const hops = Number(text);
  return hops >= 1 && hops <= MAX_TRUSTED_HOPS ? hops : 1;
}

function forwardedEntries(context: Context): string[] {
  return (context.req.header("x-forwarded-for") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

/** x-forwarded-for の値の個数。住所は返さない（health で、前段が何個足すかを確かめる用） */
export function forwardedCount(context: Context): number {
  return forwardedEntries(context).length;
}

/**
 * 接続元。前段（Cloud Run など）が足した値を、後ろから数える。既定は 1 番目（いちばん最後）。最初の値は、送り手が偽れる。
 * 前段が複数あるときは、TRUSTED_PROXY_HOPS で後ろから何番目かを変える。値の個数が足りないときは、いちばん最後を使う
 */
export function clientOf(context: Context): string {
  const entries = forwardedEntries(context);
  const hops = (context.get("trustedProxyHops") as number | undefined) ?? 1;
  return entries.at(-hops) ?? entries.at(-1) ?? "unknown";
}

export function registerGuards<Env extends object>(app: Hono<Env>, limits: GuardLimits, now: () => number = Date.now): void {
  const windows = new Map<string, { startedAt: number; count: number }>();

  const prune = (at: number) => {
    for (const [key, window] of windows) if (at - window.startedAt >= WINDOW_MS) windows.delete(key);
    if (windows.size >= MAX_TRACKED) windows.clear();
  };

  const allow = (key: string, max: number): boolean => {
    const at = now();
    const current = windows.get(key);
    if (!current || at - current.startedAt >= WINDOW_MS) {
      if (windows.size >= MAX_TRACKED) prune(at);
      windows.set(key, { startedAt: at, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= max;
  };

  app.use("/api/v1/*", async (context, next) => {
    // AI を呼ぶ API（課金に関わる）は、別に、少なく数える
    // 提出物を出す・取り消すは、学級が同じ接続元から一度に押すので、別に多く数える（#187）
    const kind = AI_PATHS.has(context.req.path) ? "ai" : isSubmissionRequest(context.req.method, context.req.path) ? "submit" : "all";
    const max = kind === "ai" ? limits.aiRequestsPerMinute : kind === "submit" ? limits.submissionRequestsPerMinute : limits.requestsPerMinute;
    if (!allow(`${kind}|${clientOf(context)}`, max)) return refuse(context, "RATE_LIMITED");
    // 別のサイトから、フォームの送信などの単純な要求で書き込まれるのを防ぐ
    const contentType = (context.req.header("content-type") ?? "").toLowerCase();
    // 先生の管理（#196）の PUT は本文を持つので、JSON だけを受ける
    const bodied = context.req.method === "POST" || (context.req.method === "PUT" && context.req.path.startsWith("/api/v1/teacher/")) || (context.req.method === "PATCH" && context.req.path === "/api/v1/workspace");
    const printRead = context.req.method === "POST" && context.req.path === "/api/v1/print/read";
    const startedAt = printRead ? Date.now() : 0;
    if (printRead ? !contentType.startsWith("multipart/form-data") : bodied && !contentType.startsWith("application/json")) {
      const response = refuse(context, "UNSUPPORTED_MEDIA_TYPE");
      if (printRead) response.headers.set("server-timing", `print-read;dur=${Date.now() - startedAt}`);
      return response;
    }
    await next();
  });

  app.use("/api/v1/*", async (context, next) => {
    const printRead = context.req.method === "POST" && context.req.path === "/api/v1/print/read";
    const startedAt = printRead ? Date.now() : 0;
    const maxSize = printRead ? limits.printBodyBytes ?? 2_621_440 : limits.bodyBytes;
    return bodyLimit({ maxSize, onError: (limitedContext) => {
      const response = refuse(limitedContext, "PAYLOAD_TOO_LARGE");
      if (printRead) response.headers.set("server-timing", `print-read;dur=${Date.now() - startedAt}`);
      return response;
    } })(context, next);
  });
}
