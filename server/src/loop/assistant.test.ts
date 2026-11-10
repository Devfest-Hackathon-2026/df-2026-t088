import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.ts";
import { MockAiClient } from "../ai/mock-client.ts";
import { createLoopStore, LOOP_LIMITS } from "./store.ts";
import { NAMED_PATTERNS } from "./hint-table.ts";

type Json = Record<string, unknown>;

function setup() {
  const store = createLoopStore({ now: () => new Date("2026-11-08T01:00:00Z") });
  const app = createApp(new MockAiClient(), { LOOP_APPROVER_KEY: "demo-key" }, {}, store);
  return { app, store };
}

async function request(app: ReturnType<typeof createApp>, path = "/api/v1/loop/assistant", headers: Record<string, string> = {}) {
  const response = await app.request(path, { headers });
  return { status: response.status, json: await response.json() as Json };
}

async function addStumbles(app: ReturnType<typeof createApp>, pattern: string, count: number, problem = "1/3+1/4", chapterId = "fraction") {
  for (let index = 0; index < count; index += 1) {
    const response = await app.request("/api/v1/stumbles", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chapterId, lessonKey: "main-6", problem, hintsShown: 0, pattern, source: "dummy", occurredAt: "2026-11-08T10:00:00+09:00" }),
    });
    assert.equal(response.status, 201);
  }
}

test("assistant needs the approver key and sorts patterns by count", async () => {
  const { app } = setup();
  await addStumbles(app, NAMED_PATTERNS[0], LOOP_LIMITS.minGroupSize + 2);
  await addStumbles(app, NAMED_PATTERNS[1], LOOP_LIMITS.minGroupSize);
  await addStumbles(app, NAMED_PATTERNS[2]!, LOOP_LIMITS.minGroupSize - 1);
  const unauthorized = await request(app);
  assert.equal(unauthorized.status, 401);
  const result = await request(app, undefined, { "x-approver-key": "demo-key" });
  assert.equal(result.status, 200);
  const items = result.json.items as { pattern: string; count: number; source: string; suggestion: { candidates: { passed: boolean; source: string }[] } }[];
  assert.deepEqual(items.map((item) => item.count), [7, 5]);
  assert.deepEqual(items.map((item) => item.pattern), [NAMED_PATTERNS[0], NAMED_PATTERNS[1]]);
  assert.equal(items.some((item) => item.pattern === NAMED_PATTERNS[2]), false);
  assert.equal(items[0]?.source, "dummy");
  assert.ok(items.every((item) => item.suggestion.candidates.some((candidate) => candidate.passed)));
  assert.ok(items.every((item) => item.suggestion.candidates.some((candidate) => candidate.source === "table")));
  assert.ok(items.every((item) => item.suggestion.candidates.every((candidate) => candidate.passed)));
});

test("assistant lists only the patterns of the problem's subject (#375)", async () => {
  const { app } = setup();
  const n = LOOP_LIMITS.minGroupSize;
  for (const pattern of NAMED_PATTERNS) {
    await addStumbles(app, pattern, n);
    await addStumbles(app, pattern, n, "左2-30g-右1", "rika");
  }
  const result = await request(app, undefined, { "x-approver-key": "demo-key" });
  const items = result.json.items as { chapterId: string; pattern: string }[];
  const of = (chapter: string) => items.filter((item) => item.chapterId === chapter).map((item) => item.pattern).sort();
  assert.deepEqual(of("fraction"), ["same-den-sum", "sum-both", "sum-num-only"]);
  assert.deepEqual(of("rika"), ["lever-inverse", "lever-same-weight"]);
});

test("sample bulk endpoint requires the key and adds dummy records within its batch limit", async () => {
  const { app, store } = setup();
  const body = { stage: "base" };
  const unauthorized = await app.request("/api/v1/loop/assistant/samples", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(unauthorized.status, 401);
  const response = await app.request("/api/v1/loop/assistant/samples", { method: "POST", headers: { "content-type": "application/json", "x-approver-key": "demo-key" }, body: JSON.stringify(body) });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { received: true, stumbles: NAMED_PATTERNS.length * 6, afterHints: NAMED_PATTERNS.length * 5 });
  assert.equal(store.summary().reduce((sum, item) => sum + item.count, 0), NAMED_PATTERNS.length * 6);
  assert.equal(store.records().every((record) => record.source === "dummy"), true);
});

test("samples の base を入れた後の一覧に、分数の問題のてこの型は出ない (#375)", async () => {
  const { app } = setup();
  const added = await app.request("/api/v1/loop/assistant/samples", { method: "POST", headers: { "content-type": "application/json", "x-approver-key": "demo-key" }, body: JSON.stringify({ stage: "base" }) });
  assert.equal(added.status, 201);
  const result = await request(app, undefined, { "x-approver-key": "demo-key" });
  const items = result.json.items as { problem: string; pattern: string }[];
  assert.deepEqual(items.map((item) => item.pattern).sort(), ["same-den-sum", "sum-both", "sum-num-only"]);
  assert.ok(items.every((item) => item.problem === "1/3+1/4"));
});

test("assistant keeps generated candidates on repeated reads and leaves approved alternatives visible", async () => {
  const { app, store } = setup();
  await addStumbles(app, NAMED_PATTERNS[0], LOOP_LIMITS.minGroupSize);
  const headers = { "x-approver-key": "demo-key" };
  const first = await request(app, undefined, headers);
  const item = (first.json.items as { suggestion: { id: string; candidates: unknown[] } }[])[0];
  assert.ok(item);
  const second = await request(app, undefined, headers);
  const repeated = (second.json.items as { suggestion: { id: string; candidates: unknown[] } }[])[0];
  assert.equal(repeated?.suggestion.id, item.suggestion.id);
  assert.deepEqual(repeated?.suggestion.candidates, item.suggestion.candidates);

  const suggestion = store.findSuggestion(item.suggestion.id)!;
  assert.ok(suggestion.candidates.some((candidate) => candidate.passed));
});

test("同じ型を同時に開いても、案を作る処理は一度にまとめる", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  class SlowDraftClient extends MockAiClient {
    override readonly loopHintDraftEnabled = true;
    calls = 0;
    override async draftLoopHint(): Promise<string> {
      this.calls += 1;
      await gate;
      return "同じ大きさにそろえて考えよう";
    }
  }
  const ai = new SlowDraftClient();
  const store = createLoopStore();
  const app = createApp(ai, {}, {}, store);
  await addStumbles(app, NAMED_PATTERNS[0], LOOP_LIMITS.minGroupSize);
  const options = { headers: { "x-approver-key": "" } };
  const first = app.request("/api/v1/loop/assistant", options);
  await new Promise((resolve) => setImmediate(resolve));
  const second = app.request("/api/v1/loop/assistant", options);
  await new Promise((resolve) => setImmediate(resolve));
  release();
  const [one, two] = await Promise.all([first, second]);
  assert.equal(one.status, 200);
  assert.equal(two.status, 200);
  assert.equal(ai.calls, 3);
  const ids = await Promise.all([one.json(), two.json()]) as { items: { suggestion: { id: string } }[] }[];
  assert.equal(ids[0]?.items[0]?.suggestion.id, ids[1]?.items[0]?.suggestion.id);
});

test("assistant shows effect only when both sides have enough after-hint records", async () => {
  const { app } = setup();
  const pattern = NAMED_PATTERNS[0]!;
  await addStumbles(app, pattern, LOOP_LIMITS.minGroupSize);
  const headers = { "content-type": "application/json", "x-approver-key": "demo-key" };
  for (let index = 0; index < LOOP_LIMITS.minGroupSize - 1; index += 1) {
    await app.request("/api/v1/after-hints", { method: "POST", headers, body: JSON.stringify({ lessonKey: "main-6", problem: "1/3+1/4", pattern, hintVersion: "base", next: "correct", source: "dummy", occurredAt: "2026-11-08T10:00:00+09:00" }) });
  }
  const result = await request(app, undefined, { "x-approver-key": "demo-key" });
  const effect = (result.json.items as { effect: { status: string; before: { count: number; correct: number | null } } }[])[0]?.effect;
  assert.equal(effect?.status, "undetermined");
  assert.equal(effect?.before.count, 0);
  assert.equal(effect?.before.correct, null);
});

test("assistant exposes the unused checked candidates when an approved hint has a lower rate", async () => {
  class DraftAiClient extends MockAiClient {
    override readonly loopHintDraftEnabled = true;
    private call = 0;
    override async draftLoopHint(): Promise<string> {
      return ["答えは7/12です", "同じ大きさのタイルにしてみよう", "まず分母をそろえよう"][this.call++ % 3]!;
    }
  }
  const store = createLoopStore({ now: () => new Date("2026-11-08T01:00:00Z") });
  const app = createApp(new DraftAiClient(), { LOOP_APPROVER_KEY: "demo-key" }, {}, store);
  const pattern = NAMED_PATTERNS[0]!;
  await addStumbles(app, pattern, LOOP_LIMITS.minGroupSize);
  const headers = { "content-type": "application/json", "x-approver-key": "demo-key" };
  for (let index = 0; index < LOOP_LIMITS.minGroupSize; index += 1) {
    for (const [hintVersion, next] of [["base", index < 4 ? "correct" : "same"], ["approved", index === 0 ? "correct" : "same"]] as const) {
      await app.request("/api/v1/after-hints", { method: "POST", headers, body: JSON.stringify({ lessonKey: "main-6", problem: "1/3+1/4", pattern, hintVersion, next, source: "dummy", occurredAt: "2026-11-08T10:00:00+09:00" }) });
    }
  }
  const first = await app.request("/api/v1/loop/assistant", { headers: { "x-approver-key": "demo-key" } });
  const item = ((await first.json() as { items: { suggestion: { id: string; candidates: { number: number; passed: boolean }[] } }[] }).items)[0]!;
  const selected = item.suggestion.candidates.find((candidate) => candidate.passed)!;
  await app.request(`/api/v1/suggestions/${item.suggestion.id}/decision`, { method: "POST", headers, body: JSON.stringify({ role: "teacher", decision: "approved", candidateNumber: selected.number, reason: "確認" }) });
  const after = await app.request("/api/v1/loop/assistant", { headers: { "x-approver-key": "demo-key" } });
  const effect = ((await after.json() as { items: { effect: { tryAlternatives: boolean; alternatives: { number: number }[] } }[] }).items)[0]?.effect;
  assert.equal(effect?.tryAlternatives, true);
  assert.ok(effect!.alternatives.length > 0);
  const retry = await app.request(`/api/v1/loop/assistant/${item.suggestion.id}/alternatives`, { method: "POST", headers: { "content-type": "application/json", "x-approver-key": "demo-key" } });
  assert.equal(retry.status, 201);
  const alternative = await retry.json() as { id: string; candidates: { number: number; hint: string }[] };
  const chosen = alternative.candidates[0]!;
  await app.request(`/api/v1/suggestions/${alternative.id}/decision`, { method: "POST", headers, body: JSON.stringify({ role: "teacher", decision: "approved", candidateNumber: chosen.number, reason: "別の案を試す" }) });
  const hints = await app.request("/api/v1/approved-hints?lessonKey=main-6&problem=1/3%2B1/4&pattern=sum-both");
  assert.equal(((await hints.json() as { items: { hint: string }[] }).items)[0]?.hint, chosen.hint);
});
