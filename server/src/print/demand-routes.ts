import { createHash, timingSafeEqual } from "node:crypto";
import type { Context, Env, Hono } from "hono";
import { apiFailure } from "../errors.ts";
import { PrintDemandStore } from "./demand.ts";

function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

export function registerPrintDemandRoute<E extends Env>(
  app: Hono<E>,
  store: PrintDemandStore,
  options: { approverKey?: string; authorize?: (context: Context) => boolean },
): void {
  const configuredKey = options.approverKey?.trim() ? options.approverKey : undefined;
  app.get("/api/v1/print/demand", async (context) => {
    const key = context.req.header("x-approver-key") ?? "";
    const keyAllowed = configuredKey !== undefined && sameSecret(key, configuredKey);
    if (!keyAllowed && !options.authorize?.(context)) {
      const failure = apiFailure("UNAUTHORIZED");
      return context.json(failure.body, failure.status as 401);
    }
    try { return context.json({ items: await store.list() }); }
    catch {
      console.error("print firestore failure count=1");
      const failure = apiFailure("BUSY");
      return context.json(failure.body, failure.status as 503);
    }
  });
}
