import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { createApp } from "../app.ts";
import { MockAiClient } from "../ai/mock-client.ts";
import type { AiClient } from "../ai/client.ts";
import { STUDIO_FIXTURES } from "./fixtures.ts";
import type { StudioLesson } from "./lesson-ir.ts";
import { registerStudioCompileRoutes } from "./compile-routes.ts";

const PROMPT = "分母をそろえる意味をタイルで考える教材を作って";

function studioClient(compileLesson: NonNullable<AiClient["compileLesson"]>): AiClient {
  return Object.assign(new MockAiClient(), { compileLesson });
}

async function post(app: ReturnType<typeof createApp>, path: string, body: unknown): Promise<Response> {
  return app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

test("教材生成は検査済み IR と生成情報を返す", async () => {
  const response = await post(createApp(new MockAiClient()), "/api/v1/studio/compile", { prompt: PROMPT });
  assert.equal(response.status, 200);
  const body = await response.json() as { lesson: StudioLesson; source: string; model: string; elapsedMs: number; validation: { ok: boolean } };
  assert.deepEqual(body.lesson, STUDIO_FIXTURES.valid);
  assert.equal(body.source, "mock");
  assert.equal(body.model, "mock");
  assert.ok(body.elapsedMs >= 0);
  assert.deepEqual(body.validation, { ok: true });
});

test("教材生成は最初の検査失敗に理由を添えて1回だけ作り直す", async () => {
  let calls = 0;
  const client = studioClient(async (input, _signal) => {
    calls += 1;
    if (calls === 2) assert.ok(input.validationIssues && input.validationIssues.length > 0);
    return calls === 1 ? STUDIO_FIXTURES.invalidShape : STUDIO_FIXTURES.valid;
  });
  const response = await post(createApp(client), "/api/v1/studio/compile", { prompt: PROMPT, strategy: "visual" });
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test("教材生成は2回とも検査に落ちたら両方の結果を返して失敗する", async () => {
  let calls = 0;
  const client = studioClient(async () => { calls += 1; return STUDIO_FIXTURES.invalidShape; });
  const response = await post(createApp(client), "/api/v1/studio/compile", { prompt: PROMPT });
  assert.equal(response.status, 422);
  const body = await response.json() as { error: { code: string }; validation: { ok: boolean; issues: string[] }; attempts: { ok: boolean }[] };
  assert.equal(body.error.code, "LESSON_NOT_READY");
  assert.equal(body.validation.ok, false);
  assert.ok(body.validation.issues.length > 0);
  assert.equal(body.attempts.length, 2);
  assert.equal(calls, 2);
});

test("教材生成の時間切れを既存の TIMEOUT として返す", async () => {
  const client = studioClient((_input, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }));
  const app = new Hono<{ Variables: { aiClient: AiClient } }>();
  app.use("*", async (context, next) => { context.set("aiClient", client); await next(); });
  registerStudioCompileRoutes(app, 5);
  const response = await post(app as unknown as ReturnType<typeof createApp>, "/api/v1/studio/compile", { prompt: PROMPT });
  assert.equal(response.status, 504);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "TIMEOUT");
});

test("教材生成の再試行は全体で共有する時間内に終える", async () => {
  let calls = 0;
  const client = studioClient(async (_input, signal) => {
    calls += 1;
    if (calls === 1) {
      await new Promise((resolve) => setTimeout(resolve, 75));
      return STUDIO_FIXTURES.invalidShape;
    }
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  });
  const app = new Hono<{ Variables: { aiClient: AiClient } }>();
  app.use("*", async (context, next) => { context.set("aiClient", client); await next(); });
  registerStudioCompileRoutes(app, 100);
  const startedAt = Date.now();
  const response = await post(app as unknown as ReturnType<typeof createApp>, "/api/v1/studio/compile", { prompt: PROMPT });
  const elapsed = Date.now() - startedAt;
  assert.equal(response.status, 504);
  assert.equal(calls, 2);
  assert.ok(elapsed < 150, `再試行全体に ${elapsed}ms かかった`);
});

test("教材生成は入力の長さと戦略を確かめる", async () => {
  let calls = 0;
  const client = studioClient(async () => { calls += 1; return STUDIO_FIXTURES.valid; });
  for (const body of [{ prompt: "x".repeat(201) }, { prompt: PROMPT, strategy: "unknown" }, { prompt: " " }]) {
    const response = await post(createApp(client), "/api/v1/studio/compile", body);
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);
});

test("同じ入力の教材生成は同時実行も短時間の再実行もまとめる", async () => {
  let calls = 0;
  const client = studioClient(async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return STUDIO_FIXTURES.valid;
  });
  const app = createApp(client);
  const [first, second] = await Promise.all([
    post(app, "/api/v1/studio/compile", { prompt: PROMPT }),
    post(app, "/api/v1/studio/compile", { prompt: PROMPT }),
  ]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  await post(app, "/api/v1/studio/compile", { prompt: PROMPT });
  assert.equal(calls, 1);
});

test("同時に動く教材生成は2つまで", async () => {
  const releases: (() => void)[] = [];
  let calls = 0;
  const client = studioClient(async (_input, _signal) => {
    calls += 1;
    await new Promise<void>((resolve) => { releases.push(resolve); });
    return STUDIO_FIXTURES.valid;
  });
  const app = createApp(client);
  const pending = ["a", "b"].map((prompt) => post(app, "/api/v1/studio/compile", { prompt }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const busy = await post(app, "/api/v1/studio/compile", { prompt: "c" });
  assert.equal(busy.status, 503);
  assert.equal((await busy.json() as { error: { code: string } }).error.code, "BUSY");
  releases.forEach((release) => release());
  await Promise.all(pending);
  assert.equal(calls, 2);
});

test("Teaching Patch の下書きを作るが適用しない", async () => {
  let received: unknown;
  const client = Object.assign(new MockAiClient(), {
    draftLessonPatch: async (input: unknown) => { received = input; return { baseVersion: 1, operations: [{ type: "setStrategy", strategy: "numeric" }] }; },
  });
  const response = await post(createApp(client), "/api/v1/studio/patch-draft", {
    lesson: STUDIO_FIXTURES.valid, prompt: "計算方法に注目するように直して", baseVersion: 1,
  });
  assert.equal(response.status, 200);
  const body = await response.json() as { patch: unknown; source: string; model: string; elapsedMs: number; validation: unknown };
  assert.deepEqual(body.patch, { baseVersion: 1, operations: [{ type: "setStrategy", strategy: "numeric" }] });
  assert.equal(body.source, "mock");
  assert.equal(body.model, "mock");
  assert.ok(body.elapsedMs >= 0);
  assert.deepEqual(body.validation, { ok: true });
  assert.ok(received);
});

test("教材スタジオの生成 API は接続元ごとの AI 回数制限を共有する", async () => {
  const app = createApp(new MockAiClient());
  for (let count = 0; count < 10; count += 1) {
    const response = await post(app, "/api/v1/studio/compile", { prompt: `${PROMPT}${count}` });
    assert.equal(response.status, 200);
  }
  const limited = await post(app, "/api/v1/studio/patch-draft", {
    lesson: STUDIO_FIXTURES.valid, prompt: "ヒントを変える", baseVersion: 1,
  });
  assert.equal(limited.status, 429);
  assert.equal((await limited.json() as { error: { code: string } }).error.code, "RATE_LIMITED");
});

test("版の一覧と差分は通常の API 制限内で30回ずつ取得できる", async () => {
  const app = createApp(new MockAiClient());
  for (let count = 0; count < 30; count += 1) {
    const versions = await app.request("/api/v1/studio/lessons/studio-mock/versions");
    assert.equal(versions.status, 200);
    const diff = await app.request("/api/v1/studio/lessons/studio-mock/diff?from=1&to=1");
    assert.equal(diff.status, 200);
  }
});

test("compile・patch-draft・tournament はそれぞれ10回を超えると制限する", async () => {
  const app = createApp(new MockAiClient());
  for (let count = 0; count < 10; count += 1) {
    assert.equal((await post(app, "/api/v1/studio/compile", { prompt: `${PROMPT}${count}` })).status, 200);
  }
  const compileLimited = await post(app, "/api/v1/studio/compile", { prompt: `${PROMPT}11` });
  assert.equal(compileLimited.status, 429);

  const patchApp = createApp(new MockAiClient());
  for (let count = 0; count < 10; count += 1) {
    assert.equal((await post(patchApp, "/api/v1/studio/patch-draft", {
      lesson: STUDIO_FIXTURES.valid, prompt: `ヒントを変える${count}`, baseVersion: 1,
    })).status, 200);
  }
  const patchLimited = await post(patchApp, "/api/v1/studio/patch-draft", {
    lesson: STUDIO_FIXTURES.valid, prompt: "ヒントを変える11", baseVersion: 1,
  });
  assert.equal(patchLimited.status, 429);

  const tournamentApp = createApp(new MockAiClient());
  for (let count = 0; count < 10; count += 1) {
    assert.equal((await post(tournamentApp, "/api/v1/studio/tournament", { prompt: `${PROMPT}${count}` })).status, 200);
  }
  const tournamentLimited = await post(tournamentApp, "/api/v1/studio/tournament", { prompt: `${PROMPT}11` });
  assert.equal(tournamentLimited.status, 429);
});

test("Teaching Patch の下書きは、版の API と同じ 1 から数える形だけを返す", async () => {
  const draftOf = (operations: unknown[]) => Object.assign(new MockAiClient(), {
    draftLessonPatch: async () => ({ baseVersion: 1, operations }),
  });
  const body = { lesson: STUDIO_FIXTURES.valid, prompt: "ヒントをやさしく", baseVersion: 1 };
  const good = await post(createApp(draftOf([{ type: "replaceHint", problemNumber: 1, hintNumber: 1, text: "タイルの大きさを見比べましょう" }])), "/api/v1/studio/patch-draft", body);
  assert.equal(good.status, 200);
  const zeroBased = await post(createApp(draftOf([{ type: "replaceHint", problemIndex: 0, hintIndex: 0, text: "タイルの大きさを見比べましょう" }])), "/api/v1/studio/patch-draft", body);
  assert.notEqual(zeroBased.status, 200);
});
