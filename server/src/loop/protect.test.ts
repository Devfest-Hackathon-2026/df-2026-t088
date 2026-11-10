import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.ts";
import { MockAiClient } from "../ai/mock-client.ts";
import { createLoopStore } from "./store.ts";

// 公開する前の最小の守り。docs/product/education-api-contract.md「守りの設定（仮）」と同じ形を守る
type Body = Record<string, unknown>;
type Options = { env?: NodeJS.ProcessEnv; limits?: Record<string, number>; now?: () => number };

function makeApp(options: Options = {}) {
  const store = createLoopStore({ now: () => new Date("2026-11-08T01:00:00Z") });
  return createApp(new MockAiClient(), options.env ?? {}, options.limits, store, { now: options.now });
}
type App = ReturnType<typeof makeApp>;

type Init = { body?: unknown; raw?: string; headers?: Record<string, string>; contentType?: string | null };

async function call(app: App, method: string, path: string, init: Init = {}): Promise<{ status: number; json: Body }> {
  const headers: Record<string, string> = { ...init.headers };
  if (init.contentType !== null) headers["content-type"] = init.contentType ?? "application/json";
  const body = init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body));
  const response = await app.request(path, { method, headers, body });
  return { status: response.status, json: (await response.json()) as Body };
}

const errorCode = (json: Body) => (json.error as { code: string }).code;
const stumble = (extra: Body = {}): Body => ({
  chapterId: "fraction", lessonKey: "main-6", problem: "1/3+1/4", hintsShown: 0, pattern: "sum-both", source: "demo", occurredAt: "2026-11-08T10:00:00+09:00", ...extra,
});

async function seedAndSuggest(app: App, headers: Record<string, string> = { "x-approver-key": "secret-key" }): Promise<string> {
  for (let index = 0; index < 5; index += 1) await call(app, "POST", "/api/v1/stumbles", { body: stumble() });
  const made = await call(app, "POST", "/api/v1/suggestions", {
    body: { role: "teacher", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", purpose: "直す" }, headers,
  });
  return made.json.id as string;
}

const decision = { role: "teacher", decision: "approved", reason: "よい" };

test("with an approver key set, approving and reading the audit log need the key, and failures are not audited", async () => {
  const app = makeApp({ env: { LOOP_APPROVER_KEY: "secret-key" } });
  const id = await seedAndSuggest(app);
  const path = `/api/v1/suggestions/${id}/decision`;

  const none = await call(app, "POST", path, { body: decision });
  assert.equal(none.status, 401);
  assert.equal(errorCode(none.json), "UNAUTHORIZED");
  const wrong = await call(app, "POST", path, { body: decision, headers: { "x-approver-key": "nope" } });
  assert.equal(wrong.status, 401);
  const right = await call(app, "POST", path, { body: decision, headers: { "x-approver-key": "secret-key" } });
  assert.equal(right.status, 200);

  const auditNone = await call(app, "GET", "/api/v1/audit-log?role=teacher");
  assert.equal(auditNone.status, 401);
  const auditRight = await call(app, "GET", "/api/v1/audit-log?role=teacher", { headers: { "x-approver-key": "secret-key" } });
  assert.equal(auditRight.status, 200);
  const decides = (auditRight.json.items as { action: string }[]).filter((item) => item.action === "decide");
  assert.equal(decides.length, 1, "unauthorized attempts must not be written to the audit log");
});

test("承認キーの前後に空白があっても、整えた値で照合する", async () => {
  const app = makeApp({ env: { LOOP_APPROVER_KEY: "  secret-key\n" } });
  const id = await seedAndSuggest(app);
  const headers = { "x-approver-key": "secret-key" };
  assert.equal((await call(app, "POST", `/api/v1/suggestions/${id}/decision`, { body: decision, headers })).status, 200);
  assert.equal((await call(app, "GET", "/api/v1/audit-log?role=teacher", { headers })).status, 200);
});

test("revoking an approved suggestion needs the approver key and does not audit unauthorized attempts", async () => {
  const app = makeApp({ env: { LOOP_APPROVER_KEY: "secret-key" } });
  const id = await seedAndSuggest(app);
  await call(app, "POST", `/api/v1/suggestions/${id}/decision`, { body: decision, headers: { "x-approver-key": "secret-key" } });
  const path = `/api/v1/suggestions/${id}/revoke`;
  const body = { role: "teacher", reason: "見直します" };
  assert.equal((await call(app, "POST", path, { body })).status, 401);
  assert.equal((await call(app, "POST", path, { body, headers: { "x-approver-key": "nope" } })).status, 401);
  const done = await call(app, "POST", path, { body, headers: { "x-approver-key": "secret-key" } });
  assert.equal(done.status, 200);
  assert.deepEqual(done.json, { id, status: "revoked" });
  const log = await call(app, "GET", "/api/v1/audit-log?role=teacher", { headers: { "x-approver-key": "secret-key" } });
  const entries = (log.json.items as { action: string; result: string }[]).filter((entry) => entry.action === "revoke");
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.result, "allowed");
});

test("an unset or empty approver key leaves approving and the audit log open", async () => {
  for (const env of [{}, { LOOP_APPROVER_KEY: "" }]) {
    const app = makeApp({ env });
    const id = await seedAndSuggest(app);
    const done = await call(app, "POST", `/api/v1/suggestions/${id}/decision`, { body: decision });
    assert.equal(done.status, 200, JSON.stringify(env));
    const log = await call(app, "GET", "/api/v1/audit-log?role=teacher");
    assert.equal(log.status, 200);
  }
});

test("the key guards only approving and the audit log; recording, reading counts, suggesting, and approved hints need none", async () => {
  const app = makeApp({ env: { LOOP_APPROVER_KEY: "secret-key" } });
  await seedAndSuggest(app);
  const query = await call(app, "POST", "/api/v1/stumbles/query", { body: { role: "researcher", scope: "summary", purpose: "調べる" } });
  assert.equal(query.status, 200);
  const hints = await call(app, "GET", "/api/v1/approved-hints?lessonKey=main-6&problem=1/3%2B1/4");
  assert.equal(hints.status, 200);
  const health = await call(app, "GET", "/api/health");
  assert.equal(health.status, 200);
});

test("a body over the limit is refused with 413", async () => {
  const app = makeApp();
  const big = JSON.stringify({ ...stumble(), padding: "x".repeat(9000) });
  const refused = await call(app, "POST", "/api/v1/stumbles", { raw: big });
  assert.equal(refused.status, 413);
  assert.equal(errorCode(refused.json), "PAYLOAD_TOO_LARGE");
  const normal = await call(app, "POST", "/api/v1/stumbles", { body: stumble() });
  assert.equal(normal.status, 201);
});

test("POST bodies that are not JSON are refused with 415, and GET is not affected", async () => {
  const app = makeApp();
  const text = await call(app, "POST", "/api/v1/stumbles", { raw: JSON.stringify(stumble()), contentType: "text/plain" });
  assert.equal(text.status, 415);
  assert.equal(errorCode(text.json), "UNSUPPORTED_MEDIA_TYPE");
  const missing = await call(app, "POST", "/api/v1/stumbles", { raw: JSON.stringify(stumble()), contentType: null });
  assert.equal(missing.status, 415);
  const form = await call(app, "POST", "/api/v1/stumbles", { raw: "a=b", contentType: "application/x-www-form-urlencoded" });
  assert.equal(form.status, 415);
  const get = await call(app, "GET", "/api/v1/approved-hints?lessonKey=main-6&problem=1/3%2B1/4", { contentType: null });
  assert.equal(get.status, 200);
  const withCharset = await call(app, "POST", "/api/v1/stumbles", { body: stumble(), contentType: "application/json; charset=utf-8" });
  assert.equal(withCharset.status, 201);
});

test("requests per client per minute are limited, and the window resets", async () => {
  let clock = 1_000_000;
  const app = makeApp({ limits: { requestsPerMinute: 3 }, now: () => clock });
  const path = "/api/v1/audit-log?role=teacher";
  const statuses: number[] = [];
  for (let index = 0; index < 4; index += 1) statuses.push((await call(app, "GET", path)).status);
  assert.deepEqual(statuses, [200, 200, 200, 429]);
  const limited = await call(app, "GET", path);
  assert.equal(errorCode(limited.json), "RATE_LIMITED");
  clock += 61_000;
  assert.equal((await call(app, "GET", path)).status, 200);
});

test("the client is the last x-forwarded-for entry, so forging the first entry does not get a fresh allowance", async () => {
  const app = makeApp({ limits: { requestsPerMinute: 2 }, now: () => 5_000_000 });
  const path = "/api/v1/audit-log?role=teacher";
  const as = (forwarded: string) => call(app, "GET", path, { headers: { "x-forwarded-for": forwarded } });
  assert.equal((await as("1.1.1.1, 9.9.9.9")).status, 200);
  assert.equal((await as("2.2.2.2, 9.9.9.9")).status, 200);
  assert.equal((await as("3.3.3.3, 9.9.9.9")).status, 429);
  assert.equal((await as("3.3.3.3, 8.8.8.8")).status, 200);
});

test("with TRUSTED_PROXY_HOPS=2 the client is the second entry from the end", async () => {
  const app = makeApp({ limits: { requestsPerMinute: 2 }, now: () => 5_500_000, env: { TRUSTED_PROXY_HOPS: "2" } });
  const path = "/api/v1/audit-log?role=teacher";
  const as = (forwarded: string) => call(app, "GET", path, { headers: { "x-forwarded-for": forwarded } });
  assert.equal((await as("1.1.1.1, 7.7.7.7, 9.9.9.9")).status, 200);
  assert.equal((await as("2.2.2.2, 7.7.7.7, 9.9.9.9")).status, 200);
  assert.equal((await as("3.3.3.3, 7.7.7.7, 9.9.9.9")).status, 429);
  assert.equal((await as("3.3.3.3, 6.6.6.6, 9.9.9.9")).status, 200);
  // 値が足りない要求は、いちばん最後を使う（いまと同じ）
  assert.equal((await as("5.5.5.5")).status, 200);
  assert.equal((await as("5.5.5.5")).status, 200);
  assert.equal((await as("5.5.5.5")).status, 429);
});

test("a bad TRUSTED_PROXY_HOPS falls back to 1, the same as the default", async () => {
  for (const value of ["abc", "0", "-1", "1.5", "99", ""]) {
    const app = makeApp({ limits: { requestsPerMinute: 1 }, now: () => 5_600_000, env: { TRUSTED_PROXY_HOPS: value } });
    const path = "/api/v1/audit-log?role=teacher";
    const as = (forwarded: string) => call(app, "GET", path, { headers: { "x-forwarded-for": forwarded } });
    assert.equal((await as("1.1.1.1, 9.9.9.9")).status, 200, value);
    assert.equal((await as("2.2.2.2, 9.9.9.9")).status, 429, value);
  }
});

test("health returns only the number of x-forwarded-for entries, never the addresses", async () => {
  const app = makeApp();
  const sent = await app.request("/api/health", { headers: { "x-forwarded-for": "1.1.1.1, 9.9.9.9" } });
  const text = await sent.text();
  assert.deepEqual(JSON.parse(text), { status: "ok", forwardedCount: 2 });
  assert.equal(text.includes("9.9.9.9"), false);
  assert.deepEqual(await (await app.request("/api/health")).json(), { status: "ok", forwardedCount: 0 });
});

test("the endpoints that call AI have their own, smaller allowance", async () => {
  const app = makeApp({ limits: { aiRequestsPerMinute: 1, requestsPerMinute: 100 }, now: () => 7_000_000 });
  const parts = () => call(app, "POST", "/api/v1/parts", { body: { expression: "1/2 + 1/3" } });
  assert.equal((await parts()).status, 200);
  const second = await parts();
  assert.equal(second.status, 429);
  assert.equal(errorCode(second.json), "RATE_LIMITED");
  assert.equal((await call(app, "GET", "/api/v1/audit-log?role=teacher")).status, 200);
});

test("a bad suggestion id is never copied into the audit log", async () => {
  const app = makeApp();
  const longId = "x".repeat(400);
  const denied = await call(app, "POST", `/api/v1/suggestions/${longId}/decision`, { body: { role: "researcher", decision: "approved", reason: "よい" } });
  assert.equal(denied.status, 403);
  const missing = await call(app, "POST", `/api/v1/suggestions/${longId}/decision`, { body: decision });
  assert.equal(missing.status, 404);
  const log = await call(app, "GET", "/api/v1/audit-log?role=teacher");
  const targets = (log.json.items as { targetId: string | null }[]).map((item) => item.targetId ?? "");
  assert.ok(targets.every((target) => !target.includes("xxxx") && target.length <= 20), JSON.stringify(targets));
});

test("occurredOn is the Japan date, and impossible or far dates are refused", async () => {
  const app = makeApp();
  for (let index = 0; index < 5; index += 1) {
    const ok = await call(app, "POST", "/api/v1/stumbles", { body: stumble({ occurredAt: "2026-11-08T16:00:00Z" }) });
    assert.equal(ok.status, 201);
  }
  const records = await call(app, "POST", "/api/v1/stumbles/query", { body: { role: "teacher", scope: "records", purpose: "調べる" } });
  const dates = (records.json.items as { occurredOn: string }[]).map((item) => item.occurredOn);
  assert.deepEqual([...new Set(dates)], ["2026-11-09"]);
  for (const occurredAt of ["2026-02-31T00:00:00Z", "0000-01-01T00:00:00Z", "2999-01-01T00:00:00Z", "2026-13-01T00:00:00Z"]) {
    const bad = await call(app, "POST", "/api/v1/stumbles", { body: stumble({ occurredAt }) });
    assert.equal(bad.status, 400, occurredAt);
    assert.equal(errorCode(bad.json), "ADULT_INVALID_REQUEST");
  }
});
