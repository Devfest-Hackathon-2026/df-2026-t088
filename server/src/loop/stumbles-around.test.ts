import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.ts";
import { MockAiClient } from "../ai/mock-client.ts";
import { buildAssistantItems } from "./assistant.ts";
import { createLoopStore, LOOP_LIMITS, type LoopStore, type Suggestion } from "./store.ts";

// 承認の前後のつまずきの件数（#519）。境は承認した日。前日までが前、翌日からが後、承認日当日は数えない
const N = LOOP_LIMITS.minGroupSize;
const PATTERN = "sum-both";
const DAY = "2026-11-08"; // 承認日（日本時間）。時計はこの日の 10:00（日本時間）
const BEFORE = "2026-11-07";
const AFTER = "2026-11-09";

function setup() {
  const store = createLoopStore({ now: () => new Date("2026-11-08T01:00:00Z") });
  return store;
}

function stumble(store: LoopStore, count: number, on: string, pattern: "sum-both" | "sum-num-only" = PATTERN, problem = "1/3+1/4") {
  for (let index = 0; index < count; index += 1) {
    store.addStumble({ chapterId: "fraction", lessonKey: "main-6", problem, hintsShown: 0, pattern, source: "dummy", occurredOn: on });
  }
}

function suggest(store: LoopStore): Suggestion {
  return store.createSuggestion({ lessonKey: "main-6", problem: "1/3+1/4", pattern: PATTERN, hint: "h", count: N, generatedBy: "table", candidates: [{ number: 1, source: "table", hint: "h", passed: true }] });
}

function effect(store: LoopStore, suggestion: Suggestion) {
  return buildAssistantItems(store, new Map([[`main-6|1/3+1/4|${PATTERN}`, suggestion]])).find((entry) => entry.pattern === PATTERN)?.effect;
}

test("stumbles: 承認の前日までを前、翌日からを後に数え、承認日当日は数えない", () => {
  const store = setup();
  stumble(store, N + 1, BEFORE);
  stumble(store, 3, DAY);
  const suggestion = suggest(store);
  assert.equal(effect(store, suggestion)?.stumbles, undefined, "決定前は付けない");
  store.decide(suggestion.id, "approved");
  assert.equal(suggestion.decidedOn, DAY);
  stumble(store, N, AFTER);
  assert.deepEqual(effect(store, suggestion)?.stumbles, { before: { count: N + 1 }, after: { count: N } });
});

test("stumbles: 5 件未満の側は count を null にし、実際の件数を返さない", () => {
  const store = setup();
  stumble(store, N, BEFORE);
  const suggestion = suggest(store);
  store.decide(suggestion.id, "approved");
  stumble(store, N - 1, AFTER);
  const stumbles = effect(store, suggestion)?.stumbles;
  assert.deepEqual(stumbles, { before: { count: N }, after: { count: null } });
  assert.equal(JSON.stringify(stumbles).includes(String(N - 1)), false);
});

test("stumbles: 承認前だけ・後だけの記録でも、少ない側は伏せる", () => {
  const store = setup();
  stumble(store, 2, BEFORE);
  stumble(store, N, AFTER);
  const suggestion = suggest(store);
  store.decide(suggestion.id, "approved");
  assert.deepEqual(effect(store, suggestion)?.stumbles, { before: { count: null }, after: { count: N } });
});

test("stumbles: 取り消した・却下した案には付けない", () => {
  const store = setup();
  stumble(store, N, BEFORE);
  const revoked = suggest(store);
  store.decide(revoked.id, "approved");
  store.revoke(revoked.id);
  assert.equal(effect(store, revoked)?.stumbles, undefined);
  const rejected = suggest(store);
  store.decide(rejected.id, "rejected");
  assert.equal(effect(store, rejected)?.stumbles, undefined);
});

test("stumbles: 別の型・別の問題・別の学級は混ざらない", () => {
  const store = setup();
  stumble(store, N, BEFORE);
  stumble(store, N, BEFORE, "sum-num-only");
  stumble(store, N, BEFORE, PATTERN, "1/2+1/5");
  stumble(store.scope("class-b"), N, BEFORE);
  const suggestion = suggest(store);
  store.decide(suggestion.id, "approved");
  stumble(store, N - 1, AFTER, "sum-num-only");
  stumble(store, N - 1, AFTER, PATTERN, "1/2+1/5");
  stumble(store.scope("class-b"), N, AFTER);
  assert.deepEqual(store.stumblesAround("main-6", "1/3+1/4", PATTERN), { before: N, after: 0 });
  assert.equal(store.scope("class-b").stumblesAround("main-6", "1/3+1/4", PATTERN), undefined);
});

test("stumbles: API の応答の effect に足され、既存の項目は変わらない", async () => {
  const store = setup();
  const app = createApp(new MockAiClient(), { LOOP_APPROVER_KEY: "demo-key" }, {}, store);
  stumble(store, N, BEFORE);
  const headers = { "content-type": "application/json", "x-approver-key": "demo-key" };
  const first = await (await app.request("/api/v1/loop/assistant", { headers })).json() as { items: { suggestion: { id: string }; effect: Record<string, unknown> }[] };
  assert.deepEqual(Object.keys(first.items[0]!.effect).sort(), ["after", "alternatives", "before", "status", "tryAlternatives"]);
  await app.request(`/api/v1/suggestions/${first.items[0]!.suggestion.id}/decision`, { method: "POST", headers, body: JSON.stringify({ role: "teacher", decision: "approved", reason: "確認" }) });
  stumble(store, N, AFTER);
  const result = await (await app.request("/api/v1/loop/assistant", { headers })).json() as { items: { effect: Record<string, unknown> }[] };
  const effectJson = result.items[0]!.effect;
  assert.deepEqual(effectJson.stumbles, { before: { count: N }, after: { count: N } });
  assert.deepEqual(Object.keys(effectJson).sort(), ["after", "alternatives", "before", "status", "stumbles", "tryAlternatives"]);
});
