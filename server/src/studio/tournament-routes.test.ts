import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { createApp } from "../app.ts";
import { MockAiClient } from "../ai/mock-client.ts";
import type { AiClient } from "../ai/client.ts";
import { STUDIO_FIXTURES } from "./fixtures.ts";
import { registerStudioTournamentRoutes } from "./tournament-routes.ts";

async function post(app: ReturnType<typeof createApp>, body: unknown): Promise<Response> {
  return app.request("/api/v1/studio/tournament", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function clientWith(compileLesson: NonNullable<AiClient["compileLesson"]>): AiClient {
  return Object.assign(new MockAiClient(), { compileLesson });
}

test("トーナメントは3つの戦略を同時に生成し、自動検査結果を種類ごとに返す", async () => {
  const strategies: string[] = [];
  const client = clientWith(async (input) => {
    strategies.push(input.strategy ?? "");
    return input.strategy === "numeric" ? STUDIO_FIXTURES.invalidMath : { ...STUDIO_FIXTURES.valid, strategy: input.strategy };
  });
  const response = await post(createApp(client), { prompt: "分母をそろえる意味を考える" });
  assert.equal(response.status, 200);
  const body = await response.json() as {
    alternatives: { strategy: string; lesson?: unknown; validation: { ok: boolean }; checks: Record<string, boolean>; elapsedMs: number; source: string }[];
    learningEffect: { status: string };
  };
  // 検査に落ちた案（numeric）は、理由を添えて 1 回だけ作り直す
  assert.deepEqual(strategies.sort(), ["misconception", "numeric", "numeric", "visual"]);
  assert.deepEqual(body.alternatives.map((item) => item.strategy), ["visual", "numeric", "misconception"]);
  assert.equal(body.alternatives[0]?.validation.ok, true);
  assert.ok(body.alternatives[0]?.lesson);
  assert.equal(body.alternatives[1]?.validation.ok, false);
  assert.equal(body.alternatives[1]?.checks.arithmetic, false);
  assert.ok(body.alternatives.every((item) => item.elapsedMs >= 0 && item.source === "mock"));
  assert.deepEqual(body.learningEffect, { status: "not_measured" });
});

test("トーナメントは3つの生成を並列に行い、全体で1回分の時間で打ち切る", async () => {
  const started: string[] = [];
  const client = clientWith((input, signal) => new Promise((_resolve, reject) => {
    started.push(input.strategy ?? "");
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }));
  const app = new Hono<{ Variables: { aiClient: AiClient } }>();
  app.use("*", async (context, next) => { context.set("aiClient", client); await next(); });
  registerStudioTournamentRoutes(app, 10);
  const response = await app.request("/api/v1/studio/tournament", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "分数を考える" }),
  });
  assert.equal(response.status, 504);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "TIMEOUT");
  assert.deepEqual(started.sort(), ["misconception", "numeric", "visual"]);
});

test("トーナメントで検査に落ちた案は、理由を添えて 1 回だけ作り直し、直れば選べる", async () => {
  const calls: { strategy?: string; validationIssues?: string[] }[] = [];
  const client = clientWith(async (input) => {
    calls.push({ strategy: input.strategy, validationIssues: input.validationIssues });
    if (input.strategy === "visual" && !input.validationIssues) return STUDIO_FIXTURES.invalidMath;
    return { ...STUDIO_FIXTURES.valid, strategy: input.strategy };
  });
  const response = await post(createApp(client), { prompt: "分母をそろえる意味を考える" });
  const body = await response.json() as { alternatives: { strategy: string; validation: { ok: boolean }; retried: boolean }[] };
  const visual = body.alternatives.find((item) => item.strategy === "visual");
  assert.equal(visual?.validation.ok, true);
  assert.equal(visual?.retried, true);
  assert.ok(calls.some((call) => call.strategy === "visual" && (call.validationIssues?.length ?? 0) > 0));
  assert.equal(body.alternatives.filter((item) => item.retried).length, 1);
});
