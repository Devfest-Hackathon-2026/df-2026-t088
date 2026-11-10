import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.ts";
import { MockAiClient } from "../ai/mock-client.ts";
import { createLoopStore } from "./store.ts";

type Body = Record<string, unknown>;

function makeApp() {
  const store = createLoopStore({ now: () => new Date("2026-11-08T01:00:00Z") });
  return createApp(new MockAiClient(), {}, { requestsPerMinute: 100000 }, store);
}
type App = ReturnType<typeof makeApp>;

async function send(app: App, method: string, path: string, body?: unknown): Promise<{ status: number; json: Body }> {
  const response = await app.request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as Body };
}

const after = (extra: Body = {}): Body => ({
  lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", hintVersion: "base", next: "correct",
  source: "dummy", occurredAt: "2026-11-08T10:00:00+09:00", ...extra,
});
const stumble = (): Body => ({
  chapterId: "fraction", lessonKey: "main-6", problem: "1/3+1/4", hintsShown: 0, pattern: "sum-both", source: "dummy", occurredAt: "2026-11-08T10:00:00+09:00",
});

async function addAfter(app: App, count: number, extra: Body = {}) {
  for (let i = 0; i < count; i += 1) assert.equal((await send(app, "POST", "/api/v1/after-hints", after(extra))).status, 201);
}
const theme = (app: App, role = "researcher") => send(app, "GET", `/api/v1/themes/hint-effect?role=${role}`);
const code = (json: Body) => (json.error as { code: string }).code;

test("after-hints accepts a valid record and returns no id", async () => {
  const app = makeApp();
  const result = await send(app, "POST", "/api/v1/after-hints", after());
  assert.equal(result.status, 201);
  assert.deepEqual(result.json, { received: true });
});

test("after-hints rejects bad values", async () => {
  const app = makeApp();
  const bad: Body[] = [
    after({ pattern: "unclassified" }), after({ pattern: "x" }), after({ hintVersion: "other" }), after({ next: "maybe" }),
    after({ source: "real" }), after({ lessonKey: "Bad Key" }), after({ problem: "hello" }),
    after({ occurredAt: "2026-02-31T10:00:00+09:00" }), after({ name: "taro", next: undefined }),
  ];
  for (const body of bad) assert.equal((await send(app, "POST", "/api/v1/after-hints", body)).status, 400);
});

test("theme shows stage collecting and hides cells under 5", async () => {
  const app = makeApp();
  await addAfter(app, 4);
  const result = await theme(app);
  assert.equal(result.status, 200);
  assert.equal(result.json.stage, "collecting");
  assert.deepEqual(result.json.cells, []);
});

test("theme shows a cell at 5 records with counts", async () => {
  const app = makeApp();
  await addAfter(app, 3, { next: "correct" });
  await addAfter(app, 2, { next: "same" });
  const result = await theme(app);
  assert.deepEqual(result.json.cells, [
    { lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", hintVersion: "base", count: 5, correct: 3, same: 2, other: 0 },
  ]);
  assert.equal(result.json.comparable, false);
});

test("theme becomes comparable only when base and approved both reach 5", async () => {
  const app = makeApp();
  await addAfter(app, 5, { hintVersion: "base", next: "same" });
  await addAfter(app, 4, { hintVersion: "approved", next: "correct" });
  assert.equal((await theme(app)).json.comparable, false);
  await addAfter(app, 1, { hintVersion: "approved", next: "correct" });
  const result = await theme(app);
  assert.equal(result.json.comparable, true);
  assert.deepEqual((result.json.cells as { hintVersion: string }[]).map((c) => c.hintVersion), ["base", "approved"]);
});

test("stage moves to proposal, approved, comparing", async () => {
  const app = makeApp();
  await addAfter(app, 5, { hintVersion: "base" });
  for (let i = 0; i < 5; i += 1) await send(app, "POST", "/api/v1/stumbles", stumble());
  assert.equal((await theme(app)).json.stage, "proposal");
  const suggestion = await send(app, "POST", "/api/v1/suggestions", {
    role: "teacher", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", purpose: "直す",
  });
  const id = suggestion.json.id as string;
  await send(app, "POST", `/api/v1/suggestions/${id}/decision`, { role: "teacher", decision: "approved", reason: "よい" });
  assert.equal((await theme(app)).json.stage, "approved");
  await addAfter(app, 1, { hintVersion: "approved" });
  assert.equal((await theme(app)).json.stage, "comparing");
});

test("theme read needs a valid role and is written to the audit log", async () => {
  const app = makeApp();
  assert.equal((await send(app, "GET", "/api/v1/themes/hint-effect?role=x")).status, 400);
  assert.equal(code((await send(app, "GET", "/api/v1/themes/hint-effect")).json), "ADULT_INVALID_REQUEST");
  await theme(app, "teacher");
  const log = (await send(app, "GET", "/api/v1/audit-log?role=teacher")).json.items as { action: string; targetId: string }[];
  assert.ok(log.some((entry) => entry.action === "query" && entry.targetId === "theme-hint-effect"));
});

test("theme never returns individual records or dates", async () => {
  const app = makeApp();
  await addAfter(app, 5);
  const text = JSON.stringify((await theme(app)).json);
  assert.ok(!text.includes("2026-11-08"));
  assert.ok(!text.includes("occurredOn"));
});
