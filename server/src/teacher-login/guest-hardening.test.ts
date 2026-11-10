// お試しの学級まわりの守りの試験（審査の指摘）：guest はメモリだけ、学級を作る全体の上限、読み取りと教材スタジオの全体の上限
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../app.ts";
import { MockAiClient } from "../ai/mock-client.ts";
import type { AiClient } from "../ai/client.ts";
import { STUDIO_FIXTURES } from "../studio/fixtures.ts";

const ORIGIN = "https://example.test";
const GUEST_ENV = { TEACHER_LOGIN: "guest", PUBLIC_BASE_URL: ORIGIN };
const JSON_HEADERS = { "content-type": "application/json" };
const NO_LIMIT = { requestsPerMinute: 100_000, submissionRequestsPerMinute: 100_000, printRequestsPerMinute: 100_000 };

const makeGuest = (app: ReturnType<typeof createApp>, client: string) =>
  app.request("/api/v1/teacher/guest", { method: "POST", headers: { ...JSON_HEADERS, origin: ORIGIN, "x-forwarded-for": client }, body: "{}" });

test("guest は PRINT_FIRESTORE_DATABASE があっても Firestore を使わず、fetch を 1 回も呼ばずに学級が作れる", async () => {
  let calls = 0;
  const fetcher = (async () => { calls += 1; throw new Error("fetch must not be called"); }) as unknown as typeof fetch;
  const env = { ...GUEST_ENV, PRINT_FIRESTORE_DATABASE: "db", GOOGLE_CLOUD_PROJECT: "project-1" } as NodeJS.ProcessEnv;
  const app = createApp(new MockAiClient(), env, NO_LIMIT, undefined, { firestoreFetcher: fetcher });
  const response = await makeGuest(app, "198.51.100.1");
  assert.equal(response.status, 200);
  assert.ok(((await response.json()) as { workspace: { joinCode: string } }).workspace.joinCode);
  assert.equal(calls, 0);
});

test("お試しの学級は、接続元を毎回変えても全体で 1 時間 200 個まで。201 個目は 429。時間が変わると戻り、押し直しは数えない", async () => {
  let at = new Date("2026-11-10T03:10:00Z");
  const app = createApp(new MockAiClient(), GUEST_ENV as NodeJS.ProcessEnv, NO_LIMIT, undefined, { teacherLoginDeps: { now: () => at } });
  let firstSession = "";
  for (let index = 0; index < 200; index += 1) {
    const response = await makeGuest(app, `10.0.${Math.floor(index / 250)}.${index % 250}`);
    assert.equal(response.status, 200, `${index + 1} 個目`);
    if (index === 0) firstSession = response.headers.getSetCookie()[0]?.split(";")[0] ?? "";
  }
  const over = await makeGuest(app, "10.9.9.9");
  assert.equal(over.status, 429);
  assert.deepEqual(((await over.json()) as { error: unknown }).error, { code: "RATE_LIMITED", message: "いま、お試しの学級が たくさん作られています。少し待ってから もういちど押してください" });
  // 押し直し（既にある学級を返す）は、全体が尽きていても通る
  const again = await app.request("/api/v1/teacher/guest", { method: "POST", headers: { ...JSON_HEADERS, origin: ORIGIN, cookie: firstSession }, body: "{}" });
  assert.equal(again.status, 200);
  at = new Date("2026-11-10T04:00:01Z");
  assert.equal((await makeGuest(app, "10.9.9.9")).status, 200);
});

test("GUEST_WORKSPACES_PER_HOUR で全体の上限を変えられる", async () => {
  const app = createApp(new MockAiClient(), { ...GUEST_ENV, GUEST_WORKSPACES_PER_HOUR: "2" } as NodeJS.ProcessEnv, NO_LIMIT);
  assert.equal((await makeGuest(app, "10.0.0.1")).status, 200);
  assert.equal((await makeGuest(app, "10.0.0.2")).status, 200);
  assert.equal((await makeGuest(app, "10.0.0.3")).status, 429);
});

function jpegForm(): FormData {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0, 100, 0, 100, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9]);
  const form = new FormData();
  form.append("image", new Blob([Uint8Array.from(bytes).buffer], { type: "image/jpeg" }), "worksheet.jpg");
  return form;
}

test("PRINT_CHILD_CAPTURE が on で Cookie なしの読み取りも、全体の上限で 429。承認キーは数えない", async () => {
  const env = { PRINT_CHILD_CAPTURE: "on", PRINT_READS_PER_DAY_TOTAL: "2", LOOP_APPROVER_KEY: "test-key" } as NodeJS.ProcessEnv;
  const app = createApp(new MockAiClient(), env, NO_LIMIT);
  const read = (headers: Record<string, string> = {}) => app.request("/api/v1/print/read", { method: "POST", body: jpegForm(), headers });
  assert.equal((await read()).status, 200);
  assert.equal((await read()).status, 200);
  const stopped = await read();
  assert.equal(stopped.status, 429);
  assert.equal(((await stopped.json()) as { error: { code: string } }).error.code, "RATE_LIMITED");
  for (let index = 0; index < 3; index += 1) assert.equal((await read({ "x-approver-key": "test-key" })).status, 200);
});

test("教材スタジオの Gemini を呼ぶ POST は全体の 1 日の上限で止まり、止めた分は Gemini を呼ばない。認証は要らないまま", async () => {
  let calls = 0;
  const client: AiClient = Object.assign(new MockAiClient(), {
    compileLesson: async () => { calls += 1; return STUDIO_FIXTURES.valid; },
  });
  const app = createApp(client, { STUDIO_AI_PER_DAY_TOTAL: "2" } as NodeJS.ProcessEnv, NO_LIMIT);
  const post = (path: string) => app.request(path, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ prompt: "分母をそろえる意味を考える" }) });
  assert.equal((await post("/api/v1/studio/compile")).status, 200);
  assert.notEqual((await post("/api/v1/studio/tournament")).status, 429);
  const before = calls;
  for (const path of ["/api/v1/studio/compile", "/api/v1/studio/patch-draft", "/api/v1/studio/tournament"]) {
    const stopped = await post(path);
    assert.equal(stopped.status, 429, path);
    assert.equal(((await stopped.json()) as { error: { code: string } }).error.code, "RATE_LIMITED");
  }
  assert.equal(calls, before, "止めた要求は Gemini を呼ばない");
});
