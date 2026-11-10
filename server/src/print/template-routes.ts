import { createHash, timingSafeEqual } from "node:crypto";
import type { Context, Env, Hono } from "hono";
import { apiFailure } from "../errors.ts";
import type { ApiErrorCode } from "../api-types.ts";
import type { AuditInput, LoopStore } from "../loop/store.ts";
import { readText } from "../loop/validate.ts";
import { createPrintTemplateApprovalStore, type PrintTemplateApprovalStore } from "./approval.ts";
import { PRINT_TEMPLATES } from "./templates.ts";

export type PrintTemplateRouteOptions = {
  approvalStore?: PrintTemplateApprovalStore;
  approverKey?: string;
  auditStore?: Pick<LoopStore, "addAudit">;
};

function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

function fail(context: Context, code: ApiErrorCode): Response {
  const response = apiFailure(code);
  return context.json(response.body, response.status as 400 | 401 | 404);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function registerPrintTemplateRoutes<E extends Env>(app: Hono<E>, options: PrintTemplateRouteOptions = {}): void {
  const store = options.approvalStore ?? createPrintTemplateApprovalStore();
  const configuredKey = options.approverKey?.trim() || undefined;
  const hasKey = (context: Context) => !configuredKey || sameSecret(context.req.header("x-approver-key") ?? "", configuredKey);
  const addAudit = (entry: Omit<AuditInput, "result"> & { result: "allowed" | "denied" }) => {
    options.auditStore?.addAudit({
      ...entry,
      role: "teacher",
      action: entry.action === "revoke" ? "revoke" : "decide",
      targetId: entry.targetId ?? "print-template",
      detail: entry.detail ?? "",
      reason: entry.reason ?? "",
    });
  };

  app.get("/api/v1/print/templates", (context) => context.json({
    items: PRINT_TEMPLATES.map(({ id, unit }) => ({ id, unit, approved: store.isApproved(id) })),
  }));

  app.post("/api/v1/print/templates/:id/decision", async (context) => {
    if (!hasKey(context)) return fail(context, "UNAUTHORIZED");
    const templateId = context.req.param("id");
    let body: unknown;
    try { body = await context.req.json(); } catch { return fail(context, "ADULT_INVALID_REQUEST"); }
    const decision = isRecord(body) ? body.decision : undefined;
    const reason = readText(isRecord(body) ? body.reason : undefined);
    if (!reason || (decision !== "approved" && decision !== "revoked")) return fail(context, "ADULT_INVALID_REQUEST");
    if (!PRINT_TEMPLATES.some((template) => template.id === templateId)) {
      addAudit({ role: "teacher", action: decision === "revoked" ? "revoke" : "decide", targetId: null, detail: decision, reason, result: "denied" });
      return fail(context, "NOT_FOUND");
    }
    store.setDecision(templateId, decision);
    addAudit({ role: "teacher", action: decision === "revoked" ? "revoke" : "decide", targetId: templateId, detail: decision, reason, result: "allowed" });
    return context.json({ id: templateId, approved: decision === "approved" });
  });
}
