import { createHash, timingSafeEqual } from "node:crypto";
import type { Context, Env, Hono } from "hono";
import { apiFailure } from "../errors.ts";
import type { ApiErrorCode } from "../api-types.ts";
import type { AuditInput, LoopStore } from "../loop/store.ts";
import { readText } from "../loop/validate.ts";
import { STUDIO_FIXTURES } from "./fixtures.ts";
import { readStudioPatch } from "./patch.ts";
import { validateLessonIr } from "./validate-ir.ts";
import { createStudioStore, type StudioGeneration, type StudioStore } from "./store.ts";

export type StudioVersionRouteOptions = {
  store?: StudioStore;
  approverKey?: string;
  auditStore?: Pick<LoopStore, "addAudit">;
};

const LESSON_ID = /^[A-Za-z0-9_-]{1,64}$/;

function createDefaultStore(): StudioStore {
  const store = createStudioStore();
  store.createLesson("studio-mock", STUDIO_FIXTURES.valid, { isFixture: true });
  return store;
}

function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

function fail(context: Context, code: ApiErrorCode, details?: Record<string, unknown>): Response {
  const response = apiFailure(code);
  return context.json({ ...response.body, ...details }, response.status as 400 | 401 | 404 | 409);
}

function readVersionNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

type Change = { path: string; before: unknown; after: unknown };

function diffValues(before: unknown, after: unknown, path = "", changes: Change[] = []): Change[] {
  if (Object.is(before, after)) return changes;
  if (isRecord(before) && isRecord(after)) {
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      diffValues(before[key], after[key], path ? `${path}.${key}` : key, changes);
    }
  } else if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) diffValues(before[index], after[index], `${path}[${index + 1}]`, changes);
  } else {
    changes.push({ path, before, after });
  }
  return changes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readGeneration(value: unknown): StudioGeneration | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value) || Object.keys(value).some((key) => !["source", "model", "elapsedMs"].includes(key))) return null;
  if ((value.source !== "gemini" && value.source !== "mock")
    || typeof value.model !== "string" || value.model.length > 80
    || !Number.isInteger(value.elapsedMs) || (value.elapsedMs as number) < 0) return null;
  return { source: value.source, model: value.model, elapsedMs: value.elapsedMs as number };
}

export function registerStudioVersionRoutes<E extends Env>(app: Hono<E>, options: StudioVersionRouteOptions = {}): void {
  const store = options.store ?? createDefaultStore();
  let nextLessonNumber = 1;
  const configuredKey = options.approverKey ?? process.env.LOOP_APPROVER_KEY;
  const approverKey = configuredKey?.trim() || undefined;
  const hasKey = (context: Context) => !approverKey || sameSecret(context.req.header("x-approver-key") ?? "", approverKey);
  const addAudit = (entry: Omit<AuditInput, "result"> & { result: "allowed" | "denied" }) => {
    if (options.auditStore) options.auditStore.addAudit(entry);
    else store.addAudit({ ...entry, role: "teacher", targetId: entry.targetId ?? "studio", action: entry.action === "revoke" ? "revoke" : "decide", detail: entry.detail ?? "", reason: entry.reason ?? "", result: entry.result });
  };

  // 生成した教材を、承認待ちの版 1 として置く。承認は decision で行う
  app.post("/api/v1/studio/lessons", async (context) => {
    let body: unknown;
    try { body = await context.req.json(); } catch { return fail(context, "ADULT_INVALID_REQUEST"); }
    const generation = readGeneration(isRecord(body) ? body.generation : undefined);
    if (generation === null) return fail(context, "ADULT_INVALID_REQUEST");
    const lesson = isRecord(body) ? body.lesson : undefined;
    const validation = validateLessonIr(lesson);
    if (!validation.ok) return context.json({ error: { code: "ADULT_INVALID_REQUEST", message: "教材を確認してください" }, issues: validation.issues }, 422);
    let lessonId = "";
    do { lessonId = `studio-${nextLessonNumber}`; nextLessonNumber += 1; } while (store.getVersions(lessonId).length > 0);
    const version = store.createLesson(lessonId, lesson as Parameters<StudioStore["createLesson"]>[1], { awaitApproval: true, ...(generation ? { generation } : {}) });
    return version ? context.json(version, 201) : fail(context, "ADULT_INVALID_REQUEST");
  });

  app.get("/api/v1/studio/lessons/:lessonId/versions", (context) => {
    const lessonId = context.req.param("lessonId");
    if (!LESSON_ID.test(lessonId)) return fail(context, "ADULT_INVALID_REQUEST");
    const items = store.getVersions(lessonId);
    return items.length ? context.json({ lessonId, items }) : fail(context, "NOT_FOUND");
  });

  app.get("/api/v1/studio/lessons/:lessonId/versions/:versionNumber", (context) => {
    const lessonId = context.req.param("lessonId");
    const versionNumber = readVersionNumber(context.req.param("versionNumber"));
    if (!LESSON_ID.test(lessonId) || !versionNumber) return fail(context, "ADULT_INVALID_REQUEST");
    const version = store.getVersion(lessonId, versionNumber);
    return version ? context.json(version) : fail(context, "NOT_FOUND");
  });

  app.get("/api/v1/studio/lessons/:lessonId/diff", (context) => {
    const lessonId = context.req.param("lessonId");
    const from = readVersionNumber(context.req.query("from") ?? "");
    const to = readVersionNumber(context.req.query("to") ?? "");
    if (!LESSON_ID.test(lessonId) || !from || !to) return fail(context, "ADULT_INVALID_REQUEST");
    const before = store.getVersion(lessonId, from);
    const after = store.getVersion(lessonId, to);
    if (!before || !after) return fail(context, "NOT_FOUND");
    return context.json({ lessonId, from, to, changes: diffValues(before.lesson, after.lesson) });
  });

  app.post("/api/v1/studio/lessons/:lessonId/patch", async (context) => {
    const lessonId = context.req.param("lessonId");
    let body: unknown;
    try { body = await context.req.json(); } catch { return fail(context, "ADULT_INVALID_REQUEST"); }
    const generation = readGeneration(isRecord(body) ? body.generation : undefined);
    const patch = readStudioPatch(isRecord(body) && "patch" in body ? body.patch : body);
    if (!LESSON_ID.test(lessonId) || !patch || generation === null) return fail(context, "ADULT_INVALID_REQUEST");
    const result = store.applyPatch(lessonId, patch, generation ? { generation } : undefined);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") return fail(context, "NOT_FOUND");
      if (result.code === "STALE_BASE_VERSION") return fail(context, "ALREADY_DECIDED", { currentVersion: result.currentVersion });
      if (result.code === "INVALID_PATCH") return context.json({ error: { code: "ADULT_INVALID_REQUEST", message: "パッチを確認してください" }, issues: result.issues }, 422);
      return fail(context, "ALREADY_DECIDED");
    }
    return context.json(result.value, 201);
  });

  app.post("/api/v1/studio/lessons/:lessonId/versions/:versionNumber/decision", async (context) => {
    if (!hasKey(context)) return fail(context, "UNAUTHORIZED");
    const lessonId = context.req.param("lessonId");
    const versionNumber = readVersionNumber(context.req.param("versionNumber"));
    let body: unknown;
    try { body = await context.req.json(); } catch { return fail(context, "ADULT_INVALID_REQUEST"); }
    const reason = readText(isRecord(body) ? body.reason : undefined);
    const decision = isRecord(body) ? body.decision : undefined;
    if (!LESSON_ID.test(lessonId) || !versionNumber || !reason || (decision !== "approved" && decision !== "rejected")) return fail(context, "ADULT_INVALID_REQUEST");
    const action: AuditInput["action"] = "decide";
    const detail = decision;
    const targetId = `${lessonId}@v${versionNumber}`;
    const result = store.decide(lessonId, versionNumber, decision);
    if (!result.ok) {
      addAudit({ role: "teacher", action, targetId, detail, reason, result: "denied" });
      return fail(context, result.code === "NOT_FOUND" ? "NOT_FOUND" : "ALREADY_DECIDED");
    }
    addAudit({ role: "teacher", action, targetId, detail, reason, result: "allowed" });
    return context.json(result.value);
  });

  app.post("/api/v1/studio/lessons/:lessonId/versions/:versionNumber/revoke", async (context) => {
    if (!hasKey(context)) return fail(context, "UNAUTHORIZED");
    const lessonId = context.req.param("lessonId");
    const versionNumber = readVersionNumber(context.req.param("versionNumber"));
    let body: unknown;
    try { body = await context.req.json(); } catch { return fail(context, "ADULT_INVALID_REQUEST"); }
    const reason = readText(isRecord(body) ? body.reason : undefined);
    if (!LESSON_ID.test(lessonId) || !versionNumber || !reason) return fail(context, "ADULT_INVALID_REQUEST");
    const targetId = `${lessonId}@v${versionNumber}`;
    const result = store.revoke(lessonId, versionNumber);
    if (!result.ok) {
      addAudit({ role: "teacher", action: "revoke", targetId, detail: "revoked", reason, result: "denied" });
      return fail(context, result.code === "NOT_FOUND" ? "NOT_FOUND" : "ALREADY_DECIDED");
    }
    addAudit({ role: "teacher", action: "revoke", targetId, detail: "revoked", reason, result: "allowed" });
    return context.json({ status: "revoked", currentVersion: result.value.restored, revokedVersion: result.value.revoked });
  });
}
