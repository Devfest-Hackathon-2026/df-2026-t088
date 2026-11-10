import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.ts";
import { readStumble } from "./validate.ts";
import { buildStumbleRow, insertStumble, readRegionSummary } from "./bigquery.ts";

const stumbleBody = {
  chapterId: "fraction", lessonKey: "main-6", problem: "1/3+1/4", hintsShown: 0,
  pattern: "sum-both", source: "demo", occurredAt: "2026-11-08T10:00:00+09:00",
  childNumber: "secret", answer: "secret", note: "secret",
};
const stumble = readStumble(stumbleBody)!;

test("BigQuery に送る行は許可した項目だけで、学校 ID はサーバーでハッシュする", () => {
  const row = buildStumbleRow(stumble, "demo-school-1");
  assert.deepEqual(Object.keys(row).sort(), ["hintsShown", "lessonKey", "occurredAt", "pattern", "problem", "schoolHash", "source"]);
  assert.equal(row.schoolHash, "162e2ced476731f4683c3b8ece18b4a1dbdf9145bd4d6e9c883aad1c3f59ab80");
  assert.deepEqual(row, {
    lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", hintsShown: 0,
    occurredAt: "2026-11-08", schoolHash: row.schoolHash, source: "demo",
  });
});

test("BigQuery insertAll は ADC のメタデータトークンで送信する", async () => {
  const requests: { url: string; headers: Headers; body?: string }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), headers: new Headers(init?.headers), body: typeof init?.body === "string" ? init.body : undefined });
    return requests.length === 1
      ? new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 })
      : new Response(JSON.stringify({}), { status: 200 });
  };
  await insertStumble({ dataset: "learning", project: "demo-project", schoolId: "demo-school-1", fetcher }, stumble);
  assert.match(requests[0]!.url, /metadata\.google\.internal\/computeMetadata\/v1\/instance\/service-accounts\/default\/token/);
  assert.equal(requests[0]!.headers.get("Metadata-Flavor"), "Google");
  assert.match(requests[1]!.url, /projects\/demo-project\/datasets\/learning\/tables\/stumbles\/insertAll$/);
  assert.equal(requests[1]!.headers.get("authorization"), "Bearer test-token");
  assert.deepEqual(JSON.parse(requests[1]!.body!).rows[0].json, buildStumbleRow(stumble, "demo-school-1"));
});

test("BigQuery 未設定なら fetch を呼ばない", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("fetch は呼ばない"); };
  try {
    const app = createApp(undefined, {});
    const response = await app.request("/api/v1/stumbles", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(stumbleBody),
    });
    assert.equal(response.status, 201);
  } finally {
    globalThis.fetch = previous;
  }
});

test("BigQuery の送信に失敗しても記録を保持して 202 を返す", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response("失敗", { status: 503 });
  try {
    const app = createApp(undefined, { LOOP_BIGQUERY_DATASET: "learning", GOOGLE_CLOUD_PROJECT: "demo-project" });
    const response = await app.request("/api/v1/stumbles", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(stumbleBody),
    });
    assert.equal(response.status, 202);
    for (let index = 0; index < 4; index += 1) {
      await app.request("/api/v1/stumbles", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(stumbleBody),
      });
    }
    const summary = await app.request("/api/v1/stumbles/query", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "researcher", scope: "summary", purpose: "調べる" }),
    });
    assert.equal(summary.status, 200);
    assert.equal((await summary.json()).items.length, 1);
  } finally {
    globalThis.fetch = previous;
  }
});

test("地域の集計は承認キーが必要で、データセット未設定なら経路を公開しない", async () => {
  const without = createApp(undefined, {});
  assert.equal((await without.request("/api/v1/loop/region")).status, 404);

  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response("失敗", { status: 503 });
  try {
    const app = createApp(undefined, { LOOP_BIGQUERY_DATASET: "learning", GOOGLE_CLOUD_PROJECT: "demo-project", LOOP_APPROVER_KEY: "secret" });
    assert.equal((await app.request("/api/v1/loop/region")).status, 401);
    const denied = await app.request("/api/v1/loop/region", { headers: { "x-approver-key": "wrong" } });
    assert.equal(denied.status, 401);
    const allowed = await app.request("/api/v1/loop/region", { headers: { "x-approver-key": "secret" } });
    assert.equal(allowed.status, 500, "認証後は BigQuery の接続失敗として扱う");
  } finally {
    globalThis.fetch = previous;
  }
});

test("region summary はビューの集計値だけを返す", async () => {
  const fetcher: typeof fetch = async (input) => String(input).includes("metadata.google.internal")
    ? new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 })
    : new Response(JSON.stringify({
      jobComplete: true,
      schema: { fields: [{ name: "lessonKey" }, { name: "problem" }, { name: "pattern" }, { name: "count" }] },
      rows: [{ f: [{ v: "main-6" }, { v: "1/3+1/4" }, { v: "sum-both" }, { v: "12" }] }],
    }), { status: 200 });
  const result = await readRegionSummary({ dataset: "learning", project: "demo-project", fetcher });
  assert.deepEqual(result, [{ lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", count: 12 }]);
});
