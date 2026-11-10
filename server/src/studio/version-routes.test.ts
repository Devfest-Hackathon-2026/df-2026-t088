import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { createLoopStore } from "../loop/store.ts";
import { STUDIO_FIXTURES } from "./fixtures.ts";
import { createStudioStore } from "./store.ts";
import { registerStudioVersionRoutes } from "./version-routes.ts";

function createTestApi() {
  const app = new Hono();
  const store = createStudioStore();
  const auditStore = createLoopStore();
  store.createLesson("lesson-1", STUDIO_FIXTURES.valid);
  registerStudioVersionRoutes(app, { store, approverKey: "test-approver-key", auditStore });
  return { app, store, auditStore };
}

test("patch API は版を作り、版の差分を返す", async () => {
  const { app } = createTestApi();
  const response = await app.request("/api/v1/studio/lessons/lesson-1/patch", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ baseVersion: 1, operations: [{ type: "setStrategy", strategy: "numeric" }] }),
  });
  assert.equal(response.status, 201);
  const diff = await app.request("/api/v1/studio/lessons/lesson-1/diff?from=1&to=2");
  const result = await diff.json() as { changes: { path: string }[] };
  assert.equal(diff.status, 200);
  assert.ok(result.changes.some((change) => change.path === "strategy"));
});

test("生成情報を保存して版一覧に返し、不正な生成情報を拒否する", async () => {
  const { app } = createTestApi();
  const headers = { "content-type": "application/json" };
  const generation = { source: "gemini", model: "gemini-test", elapsedMs: 125 };
  const created = await app.request("/api/v1/studio/lessons", {
    method: "POST", headers, body: JSON.stringify({ lesson: STUDIO_FIXTURES.valid, generation }),
  });
  assert.equal(created.status, 201);
  const version = await created.json() as { lessonId: string; generation: typeof generation };
  assert.deepEqual(version.generation, generation);

  for (const invalidGeneration of [
    { source: "other", model: "x", elapsedMs: 1 },
    { source: "mock", model: "x".repeat(81), elapsedMs: 1 },
    { source: "mock", model: "mock", elapsedMs: -1 },
    { source: "mock", model: "mock", elapsedMs: 1.5 },
    { source: "mock", model: 1, elapsedMs: 1 },
    null,
  ]) {
    const response = await app.request("/api/v1/studio/lessons", {
      method: "POST", headers, body: JSON.stringify({ lesson: STUDIO_FIXTURES.valid, generation: invalidGeneration }),
    });
    assert.equal(response.status, 400);
  }

  await app.request("/api/v1/studio/lessons/" + version.lessonId + "/versions/1/decision", {
    method: "POST", headers: { ...headers, "x-approver-key": "test-approver-key" },
    body: JSON.stringify({ decision: "approved", reason: "版を確認しました" }),
  });

  const invalidPatchGeneration = await app.request("/api/v1/studio/lessons/" + version.lessonId + "/patch", {
    method: "POST", headers,
    body: JSON.stringify({ patch: { baseVersion: 1, operations: [{ type: "setStrategy", strategy: "numeric" }] }, generation: { source: "mock", model: "mock", elapsedMs: -1 } }),
  });
  assert.equal(invalidPatchGeneration.status, 400);

  const patch = await app.request("/api/v1/studio/lessons/" + version.lessonId + "/patch", {
    method: "POST", headers,
    body: JSON.stringify({ patch: { baseVersion: 1, operations: [{ type: "setStrategy", strategy: "numeric" }] }, generation: { source: "mock", model: "mock", elapsedMs: 0 } }),
  });
  assert.equal(patch.status, 201);
  const listed = await app.request("/api/v1/studio/lessons/" + version.lessonId + "/versions");
  const result = await listed.json() as { items: { number: number; generation?: unknown }[] };
  assert.deepEqual(result.items.map((item) => item.generation), [
    { source: "mock", model: "mock", elapsedMs: 0 }, generation,
  ]);
});

test("承認キーなし・誤りを拒否し、正しいキーで承認後に監査する", async () => {
  const { app, auditStore } = createTestApi();
  await app.request("/api/v1/studio/lessons/lesson-1/patch", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ baseVersion: 1, operations: [{ type: "setStrategy", strategy: "numeric" }] }),
  });
  const url = "/api/v1/studio/lessons/lesson-1/versions/2/decision";
  const body = JSON.stringify({ decision: "approved", reason: "内容を確認しました" });
  for (const key of [undefined, "wrong-key"]) {
    const headers = new Headers({ "content-type": "application/json" });
    if (key) headers.set("x-approver-key", key);
    assert.equal((await app.request(url, { method: "POST", headers, body })).status, 401);
  }
  const response = await app.request(url, {
    method: "POST", headers: { "content-type": "application/json", "x-approver-key": "test-approver-key" }, body,
  });
  assert.equal(response.status, 200);
  assert.equal(auditStore.auditLog()[0]?.reason, "内容を確認しました");
  assert.equal(auditStore.auditLog()[0]?.result, "allowed");
  const revoked = await app.request("/api/v1/studio/lessons/lesson-1/versions/2/revoke", {
    method: "POST", headers: { "content-type": "application/json", "x-approver-key": "test-approver-key" },
    body: JSON.stringify({ reason: "内容を見直します" }),
  });
  const rollback = await revoked.json() as { currentVersion: { number: number }; revokedVersion: { status: string } };
  assert.equal(revoked.status, 200);
  assert.equal(rollback.currentVersion.number, 1);
  assert.equal(rollback.revokedVersion.status, "revoked");
  assert.equal(auditStore.auditLog()[0]?.action, "revoke");
  assert.equal(auditStore.auditLog()[0]?.reason, "内容を見直します");
});

test("古い baseVersion を拒否する", async () => {
  const { app } = createTestApi();
  const headers = { "content-type": "application/json" };
  await app.request("/api/v1/studio/lessons/lesson-1/patch", {
    method: "POST", headers,
    body: JSON.stringify({ baseVersion: 1, operations: [{ type: "setStrategy", strategy: "numeric" }] }),
  });
  const response = await app.request("/api/v1/studio/lessons/lesson-1/patch", {
    method: "POST", headers,
    body: JSON.stringify({ baseVersion: 1, operations: [{ type: "setStrategy", strategy: "visual" }] }),
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json().then((body: unknown) => (body as { currentVersion: number }).currentVersion), 2);
});

test("a generated lesson waits for approval as version 1, and the decision lands in the shared audit log", async () => {
  const { createApp } = await import("../app.ts");
  const { createLoopStore } = await import("../loop/store.ts");
  const { STUDIO_FIXTURES } = await import("./fixtures.ts");
  const loopStore = createLoopStore();
  const app = createApp(undefined, { LOOP_APPROVER_KEY: "k" }, {}, loopStore);
  const json = { "content-type": "application/json" };
  const created = await app.request("/api/v1/studio/lessons", { method: "POST", headers: json, body: JSON.stringify({ lesson: STUDIO_FIXTURES.valid }) });
  assert.equal(created.status, 201);
  const version = await created.json() as { lessonId: string; number: number; status: string };
  assert.equal(version.status, "review_required");
  const bad = await app.request("/api/v1/studio/lessons", { method: "POST", headers: json, body: JSON.stringify({ lesson: STUDIO_FIXTURES.invalidMath }) });
  assert.equal(bad.status, 422);
  const decided = await app.request(`/api/v1/studio/lessons/${version.lessonId}/versions/1/decision`, {
    method: "POST", headers: { ...json, "x-approver-key": "k" }, body: JSON.stringify({ decision: "approved", reason: "ねらいに合う" }),
  });
  assert.equal(decided.status, 200);
  assert.ok(loopStore.auditLog().some((entry) => entry.targetId === `${version.lessonId}@v1` && entry.result === "allowed"));
});

test("版の承認キーは前後の空白を除いて照合する", async () => {
  const app = new Hono();
  const store = createStudioStore();
  store.createLesson("lesson-1", STUDIO_FIXTURES.valid, { awaitApproval: true });
  registerStudioVersionRoutes(app, { store, approverKey: "  test-approver-key\n" });
  const response = await app.request("/api/v1/studio/lessons/lesson-1/versions/1/decision", {
    method: "POST", headers: { "content-type": "application/json", "x-approver-key": "test-approver-key" },
    body: JSON.stringify({ decision: "approved", reason: "確認しました" }),
  });
  assert.equal(response.status, 200);
});
