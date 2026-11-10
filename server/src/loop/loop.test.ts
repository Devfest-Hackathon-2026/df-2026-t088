import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.ts";
import { MockAiClient } from "../ai/mock-client.ts";
import { createLoopStore, LOOP_LIMITS } from "./store.ts";
import { HINT_BY_PATTERN } from "./hint-table.ts";

type Body = Record<string, unknown>;

function makeApp(options: { capacity?: number; env?: NodeJS.ProcessEnv } = {}) {
  const store = createLoopStore({ now: () => new Date("2026-11-08T01:00:00Z"), ...options });
  return createApp(undefined, options.env ?? {}, {}, store);
}
type App = ReturnType<typeof makeApp>;

async function send(app: App, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; json: Body }> {
  const response = await app.request(path, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as Body };
}

const stumble = (extra: Body = {}): Body => ({
  chapterId: "fraction", lessonKey: "main-6", problem: "1/3+1/4", hintsShown: 1, source: "dummy", occurredAt: "2026-11-08T10:00:00+09:00", ...extra,
});

async function addStumbles(app: App, count: number, extra: Body = {}): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const result = await send(app, "POST", "/api/v1/stumbles", stumble(extra));
    assert.equal(result.status, 201);
  }
}

const query = (app: App, body: Body) => send(app, "POST", "/api/v1/stumbles/query", body);
const errorCode = (json: Body) => (json.error as { code: string }).code;

test("stumbles accepts only dummy or demo records and returns no id", async () => {
  const app = makeApp();
  const ok = await send(app, "POST", "/api/v1/stumbles", stumble());
  assert.equal(ok.status, 201);
  assert.deepEqual(ok.json, { received: true });
  const bad: Body[] = [
    stumble({ source: "real" }), stumble({ source: undefined }), stumble({ lessonKey: "Main 6" }), stumble({ lessonKey: "a".repeat(33) }),
    stumble({ chapterId: undefined }), stumble({ chapterId: "Fraction" }), stumble({ chapterId: "" }), stumble({ chapterId: 1 }), stumble({ chapterId: "a".repeat(33) }),
    stumble({ problem: "たなかさん" }), stumble({ problem: "1/3+1/4 たなか" }), stumble({ hintsShown: 4 }), stumble({ hintsShown: 1.5 }),
    stumble({ occurredAt: "きのう" }),
  ];
  for (const body of bad) {
    const result = await send(app, "POST", "/api/v1/stumbles", body);
    assert.equal(result.status, 400, JSON.stringify(body));
    assert.equal(errorCode(result.json), "ADULT_INVALID_REQUEST");
  }
});

test("summary hides problems with fewer than the minimum count", async () => {
  const app = makeApp();
  await addStumbles(app, LOOP_LIMITS.minGroupSize - 1);
  const few = await query(app, { role: "researcher", scope: "summary", purpose: "調べる" });
  assert.equal(few.status, 200);
  assert.deepEqual(few.json, { scope: "summary", items: [] });
  await addStumbles(app, 1);
  const enough = await query(app, { role: "researcher", scope: "summary", purpose: "調べる" });
  assert.deepEqual(enough.json, { scope: "summary", items: [{ chapterId: "fraction", lessonKey: "main-6", problem: "1/3+1/4", count: LOOP_LIMITS.minGroupSize, patterns: [{ pattern: "unclassified", count: LOOP_LIMITS.minGroupSize }] }] });
});

test("summary separates chapters with the same lesson and problem, each under the minimum rule", async () => {
  const app = makeApp();
  await addStumbles(app, LOOP_LIMITS.minGroupSize, { chapterId: "decimal" });
  await addStumbles(app, LOOP_LIMITS.minGroupSize + 1);
  await addStumbles(app, LOOP_LIMITS.minGroupSize - 1, { chapterId: "ratio" });
  const result = await query(app, { role: "researcher", scope: "summary", purpose: "調べる" });
  const items = (result.json.items as { chapterId: string; count: number }[]).map(({ chapterId, count }) => ({ chapterId, count }));
  assert.deepEqual(items, [{ chapterId: "decimal", count: LOOP_LIMITS.minGroupSize }, { chapterId: "fraction", count: LOOP_LIMITS.minGroupSize + 1 }]);
});

test("records do not carry chapterId", async () => {
  const app = makeApp();
  await addStumbles(app, LOOP_LIMITS.minGroupSize);
  const result = await send(app, "POST", "/api/v1/stumbles/query", { role: "teacher", scope: "records", purpose: "調べる" });
  assert.equal(result.status, 200);
  for (const item of result.json.items as Body[]) assert.equal("chapterId" in item, false);
});

test("1 件ずつの記録の読み出しには承認キーが要り、まとめと提案の作成はキーなしで通る（先生の画面が使う）", async () => {
  const app = makeApp({ env: { LOOP_APPROVER_KEY: "secret-key" } });
  await addStumbles(app, LOOP_LIMITS.minGroupSize, { pattern: "sum-both" });
  const records = await send(app, "POST", "/api/v1/stumbles/query", { role: "teacher", scope: "records", purpose: "調べる" });
  assert.equal(records.status, 401);
  assert.equal(errorCode(records.json), "UNAUTHORIZED");
  assert.equal((await send(app, "POST", "/api/v1/stumbles/query", { role: "teacher", scope: "summary", purpose: "調べる" })).status, 200);
  assert.equal((await send(app, "POST", "/api/v1/suggestions", { role: "teacher", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", purpose: "直す" })).status, 201);

  const headers = { "x-approver-key": "secret-key" };
  assert.equal((await send(app, "POST", "/api/v1/stumbles/query", { role: "teacher", scope: "records", purpose: "調べる" }, headers)).status, 200);
});

test("Gemini 待ちの同じ提案要求は pending を一つだけ作る", async () => {
  let release!: () => void;
  const waitForDraft = new Promise<void>((resolve) => { release = resolve; });
  class SlowDraftClient extends (await import("../ai/mock-client.ts")).MockAiClient {
    override readonly loopHintDraftEnabled = true;
    override async draftLoopHint(): Promise<string> {
      await waitForDraft;
      return "分母がちがうときは、同じ大きさのタイルにそろえて考えましょう";
    }
  }
  const store = createLoopStore();
  const app = createApp(new SlowDraftClient(), { LOOP_APPROVER_KEY: "secret-key" }, {}, store);
  await addStumbles(app, LOOP_LIMITS.minGroupSize, { pattern: "sum-both" });
  const headers = { "content-type": "application/json", "x-approver-key": "secret-key" };
  const body = JSON.stringify({ role: "teacher", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", purpose: "直す" });
  const first = app.request("/api/v1/suggestions", { method: "POST", headers, body });
  await new Promise((resolve) => setImmediate(resolve));
  const second = app.request("/api/v1/suggestions", { method: "POST", headers, body });
  await new Promise((resolve) => setImmediate(resolve));
  release();
  const responses = await Promise.all([first, second]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
  assert.equal(store.findPending("main-6", "1/3+1/4", "sum-both")?.id, "suggestion-1");
});

test("records are teacher-only, carry no id, no time of day, and hide small groups", async () => {
  const app = makeApp();
  await addStumbles(app, LOOP_LIMITS.minGroupSize);
  await addStumbles(app, 1, { problem: "1/2+1/5" });
  const researcher = await query(app, { role: "researcher", scope: "records", purpose: "調べる" });
  assert.equal(researcher.status, 403);
  assert.equal(errorCode(researcher.json), "SCOPE_NOT_ALLOWED");
  const teacher = await query(app, { role: "teacher", scope: "records", purpose: "調べる" });
  assert.equal(teacher.status, 200);
  const items = teacher.json.items as Body[];
  assert.equal(items.length, LOOP_LIMITS.minGroupSize);
  for (const item of items) {
    assert.deepEqual(Object.keys(item).sort(), ["hintsShown", "lessonKey", "occurredOn", "problem", "source"]);
    assert.equal(item.occurredOn, "2026-11-08");
    assert.equal(item.problem, "1/3+1/4");
  }
});

test("query rejects bad role, scope, and empty or long purpose without writing an audit entry", async () => {
  const app = makeApp();
  const bad: Body[] = [
    { role: "child", scope: "summary", purpose: "x" }, { role: "teacher", scope: "all", purpose: "x" },
    { role: "teacher", scope: "summary", purpose: "" }, { role: "teacher", scope: "summary", purpose: "あ".repeat(101) },
  ];
  for (const body of bad) {
    const result = await query(app, body);
    assert.equal(result.status, 400);
    assert.equal(errorCode(result.json), "ADULT_INVALID_REQUEST");
  }
  const log = await send(app, "GET", "/api/v1/audit-log?role=teacher");
  assert.deepEqual((log.json.items as Body[]).map((item) => item.action), []);
});

test("suggestion needs enough records, reuses a pending one, and is table-labelled when AI is not configured", async () => {
  const app = makeApp();
  const request = { role: "researcher", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", purpose: "直す" };
  await addStumbles(app, LOOP_LIMITS.minGroupSize - 1, { pattern: "sum-both" });
  const short = await send(app, "POST", "/api/v1/suggestions", request);
  assert.equal(short.status, 422);
  assert.equal(errorCode(short.json), "NOT_ENOUGH_RECORDS");
  await addStumbles(app, 1, { pattern: "sum-both" });
  const created = await send(app, "POST", "/api/v1/suggestions", request);
  assert.equal(created.status, 201);
  assert.equal(created.json.status, "pending");
  assert.equal(created.json.generatedBy, "table");
  assert.equal("aiFallback" in created.json, false);
  assert.deepEqual(created.json.basis, { count: LOOP_LIMITS.minGroupSize });
  assert.equal(created.json.replacesHintIndex, 0);
  const again = await send(app, "POST", "/api/v1/suggestions", request);
  assert.equal(again.status, 200);
  assert.equal(again.json.id, created.json.id);
});

test("table candidate keeps the no-AI subtraction path selectable", async () => {
  const app = makeApp();
  await addStumbles(app, LOOP_LIMITS.minGroupSize, { problem: "1/3-1/4", pattern: "same-den-sum" });
  const result = await send(app, "POST", "/api/v1/suggestions", { role: "teacher", lessonKey: "main-6", problem: "1/3-1/4", pattern: "same-den-sum", purpose: "直す" });
  assert.deepEqual(result.json.candidates, [{ number: 1, source: "table", hint: "分母をそろえたら、分母はそのままで、分子だけをひこう", passed: true }]);
});

test("suggestion uses a checked AI draft and sends only the pattern and operator", async () => {
  let received: unknown;
  class DraftClient extends MockAiClient {
    override readonly loopHintDraftEnabled = true;
    override async draftLoopHint(input: { pattern: "sum-both"; operator: "+" | "-" }, _signal: AbortSignal) {
      received = input;
      return "分母がちがうときは、同じ大きさのタイルにそろえて考えましょう";
    }
  }
  const store = createLoopStore();
  const app = createApp(new DraftClient(), {}, {}, store);
  await addStumbles(app, LOOP_LIMITS.minGroupSize, { pattern: "sum-both" });
  const result = await send(app, "POST", "/api/v1/suggestions", { role: "teacher", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", purpose: "直す" });
  assert.equal(result.json.generatedBy, "gemini");
  assert.equal(result.json.hint, "分母がちがうときは、同じ大きさのタイルにそろえて考えましょう");
  assert.deepEqual(received, { pattern: "sum-both", operator: "+" });
  assert.equal(JSON.stringify(received).includes("1/3"), false);
  const log = await send(app, "GET", "/api/v1/audit-log?role=teacher");
  assert.equal((log.json.items as Body[]).find((item) => item.action === "suggest")?.detail, "gemini");
});

test("Gemini suggestion keeps three checked candidates and approves only the selected passing candidate", async () => {
  class ThreeDraftClient extends MockAiClient {
    override readonly loopHintDraftEnabled = true;
    private call = 0;
    override async draftLoopHint(_input: { pattern: "sum-both"; operator: "+" | "-" }, _signal: AbortSignal) {
      const drafts = [
        "分母がちがうときは、同じ大きさのタイルにそろえよう",
        "答えは7/12です",
        "分母がちがうときは、共通の大きさを見つけよう",
      ];
      return drafts[this.call++]!;
    }
  }
  const app = createApp(new ThreeDraftClient());
  await addStumbles(app, LOOP_LIMITS.minGroupSize, { pattern: "sum-both" });
  const created = await send(app, "POST", "/api/v1/suggestions", { role: "teacher", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", purpose: "直す" });
  const candidates = created.json.candidates as Body[];
  assert.equal(candidates.length, 4);
  assert.deepEqual(candidates.map((candidate) => candidate.source), ["gemini", "gemini", "gemini", "table"]);
  assert.deepEqual(candidates.map((candidate) => candidate.passed), [true, false, true, true]);
  assert.equal(candidates[1]?.reason, "leak");
  const id = created.json.id as string;
  const denied = await send(app, "POST", `/api/v1/suggestions/${id}/decision`, { role: "teacher", decision: "approved", candidateNumber: 2, reason: "確認" });
  assert.equal(denied.status, 400);
  const approved = await send(app, "POST", `/api/v1/suggestions/${id}/decision`, { role: "teacher", decision: "approved", candidateNumber: 3, reason: "確認" });
  assert.equal(approved.status, 200);
  const hints = await send(app, "GET", "/api/v1/approved-hints?lessonKey=main-6&problem=1/3%2B1/4");
  assert.equal((hints.json.items as Body[])[0]?.hint, "分母がちがうときは、共通の大きさを見つけよう");
  const log = await send(app, "GET", "/api/v1/audit-log?role=teacher");
  assert.match(String((log.json.items as Body[])[0]?.detail), /candidate:3.*gemini/);
});

test("invalid AI draft, timeout, and error use the table with a reason", async () => {
  const cases: { name: string; run: (signal: AbortSignal) => Promise<string>; reason: string; timeout?: number }[] = [
    { name: "check failure", run: async () => "答えは7/12です", reason: "check_failed" },
    { name: "timeout", run: (_signal) => new Promise<string>(() => {}), reason: "timeout", timeout: 5 },
    { name: "error", run: async () => { throw new Error("draft failed"); }, reason: "error" },
  ];
  for (const item of cases) {
    class DraftClient extends MockAiClient {
      override readonly loopHintDraftEnabled = true;
      override draftLoopHint(_input: { pattern: "sum-both"; operator: "+" | "-" }, signal: AbortSignal) { return item.run(signal); }
    }
    const store = createLoopStore();
    const app = createApp(new DraftClient(), {}, {}, store);
    await addStumbles(app, LOOP_LIMITS.minGroupSize, { pattern: "sum-both" });
    const result = await send(app, "POST", "/api/v1/suggestions", { role: "teacher", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", purpose: "直す" });
    assert.equal(result.json.generatedBy, "table", item.name);
    assert.equal(result.json.aiFallback, item.reason, item.name);
    assert.equal(result.json.hint, HINT_BY_PATTERN["sum-both"], item.name);
  }
});

async function createSuggestion(app: App): Promise<string> {
  await addStumbles(app, LOOP_LIMITS.minGroupSize, { pattern: "sum-both" });
  const created = await send(app, "POST", "/api/v1/suggestions", { role: "teacher", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", purpose: "直す" });
  return created.json.id as string;
}

test("only a teacher can decide, once, with a reason; approved hints reach the next child", async () => {
  const app = makeApp();
  const id = await createSuggestion(app);
  const path = `/api/v1/suggestions/${id}/decision`;
  const forbidden = await send(app, "POST", path, { role: "researcher", decision: "approved", reason: "よい" });
  assert.equal(forbidden.status, 403);
  const noReason = await send(app, "POST", path, { role: "teacher", decision: "approved", reason: "" });
  assert.equal(noReason.status, 400);
  const missing = await send(app, "POST", "/api/v1/suggestions/none/decision", { role: "teacher", decision: "approved", reason: "よい" });
  assert.equal(missing.status, 404);
  assert.equal(errorCode(missing.json), "NOT_FOUND");
  const hintsBefore = await send(app, "GET", "/api/v1/approved-hints?lessonKey=main-6&problem=1/3%2B1/4");
  assert.deepEqual(hintsBefore.json, { items: [] });
  const approved = await send(app, "POST", path, { role: "teacher", decision: "approved", candidateNumber: 1, reason: "単位を先に示す" });
  assert.equal(approved.status, 200);
  assert.deepEqual(approved.json, { id, status: "approved", replaced: [] });
  const twice = await send(app, "POST", path, { role: "teacher", decision: "rejected", reason: "やはり違う" });
  assert.equal(twice.status, 409);
  assert.equal(errorCode(twice.json), "ALREADY_DECIDED");
  const hints = await send(app, "GET", "/api/v1/approved-hints?lessonKey=main-6&problem=1/3%2B1/4");
  assert.equal((hints.json.items as Body[]).length, 1);
  assert.deepEqual(Object.keys((hints.json.items as Body[])[0] ?? {}).sort(), ["hint", "pattern", "replacesHintIndex"]);
});

test("approving a suggestion replaces other approved suggestions for the same problem and pattern", async () => {
  const app = makeApp();
  const firstId = await createSuggestion(app);
  await send(app, "POST", `/api/v1/suggestions/${firstId}/decision`, { role: "teacher", decision: "approved", candidateNumber: 1, reason: "最初の承認" });

  const created = await send(app, "POST", "/api/v1/suggestions", { role: "teacher", lessonKey: "main-6", problem: "1 / 3 + 1 / 4", pattern: "sum-both", purpose: "直す" });
  const secondId = String(created.json.id);
  const approved = await send(app, "POST", `/api/v1/suggestions/${secondId}/decision`, { role: "teacher", decision: "approved", candidateNumber: 1, reason: "新しい承認" });
  assert.deepEqual(approved.json, { id: secondId, status: "approved", replaced: [firstId] });

  const hints = await send(app, "GET", "/api/v1/approved-hints?lessonKey=main-6&problem=1/3%2B1/4&pattern=sum-both");
  assert.equal((hints.json.items as Body[]).length, 1);
  const log = await send(app, "GET", "/api/v1/audit-log?role=teacher");
  const replacement = (log.json.items as Body[]).find((entry) => entry.action === "revoke" && entry.targetId === firstId);
  assert.deepEqual(replacement && { detail: replacement.detail, reason: replacement.reason, result: replacement.result, role: replacement.role }, {
    detail: `replaced-by:${secondId}`, reason: "新しい承認で置き換え", result: "allowed", role: "teacher",
  });
});

test("rejecting a suggestion does not replace an approved suggestion", async () => {
  const app = makeApp();
  const firstId = await createSuggestion(app);
  await send(app, "POST", `/api/v1/suggestions/${firstId}/decision`, { role: "teacher", decision: "approved", candidateNumber: 1, reason: "最初の承認" });
  const created = await send(app, "POST", "/api/v1/suggestions", { role: "teacher", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", purpose: "直す" });
  const secondId = String(created.json.id);
  const rejected = await send(app, "POST", `/api/v1/suggestions/${secondId}/decision`, { role: "teacher", decision: "rejected", reason: "合わない" });
  assert.deepEqual(rejected.json, { id: secondId, status: "rejected", replaced: [] });
  const hints = await send(app, "GET", "/api/v1/approved-hints?lessonKey=main-6&problem=1/3%2B1/4&pattern=sum-both");
  assert.equal((hints.json.items as Body[]).length, 1);
});

test("rejected suggestions never become approved hints, and bad hint queries fail", async () => {
  const app = makeApp();
  const id = await createSuggestion(app);
  await send(app, "POST", `/api/v1/suggestions/${id}/decision`, { role: "teacher", decision: "rejected", reason: "合わない" });
  const hints = await send(app, "GET", "/api/v1/approved-hints?lessonKey=main-6&problem=1/3%2B1/4");
  assert.deepEqual(hints.json, { items: [] });
  const bad = await send(app, "GET", "/api/v1/approved-hints?lessonKey=Main&problem=たなか");
  assert.equal(bad.status, 400);
  assert.equal(errorCode(bad.json), "ADULT_INVALID_REQUEST");
});

test("only teachers can revoke an approved suggestion, and revocation removes its hint and is audited", async () => {
  const app = makeApp();
  await addStumbles(app, 5, { pattern: "sum-both" });
  const created = await send(app, "POST", "/api/v1/suggestions", { role: "teacher", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", purpose: "直す" });
  const id = String(created.json.id);
  await send(app, "POST", `/api/v1/suggestions/${id}/decision`, { role: "teacher", decision: "approved", candidateNumber: 1, reason: "よい" });
  const path = `/api/v1/suggestions/${id}/revoke`;
  const denied = await send(app, "POST", path, { role: "researcher", reason: "確認" });
  assert.equal(denied.status, 403);
  const revoked = await send(app, "POST", path, { role: "teacher", reason: "内容を見直す" });
  assert.equal(revoked.status, 200);
  assert.deepEqual(revoked.json, { id, status: "revoked" });
  const again = await send(app, "POST", path, { role: "teacher", reason: "再確認" });
  assert.equal(errorCode(again.json), "ALREADY_DECIDED");
  const hints = await send(app, "GET", "/api/v1/approved-hints?lessonKey=main-6&problem=1/3%2B1/4");
  assert.deepEqual(hints.json.items, []);
  const log = await send(app, "GET", "/api/v1/audit-log?role=teacher");
  const revokeEntries = (log.json.items as Body[]).filter((entry) => entry.action === "revoke");
  assert.equal(revokeEntries.length, 3);
  assert.equal(revokeEntries[0]?.reason, "再確認");
  assert.equal(revokeEntries[0]?.result, "denied");
  assert.equal(revokeEntries[1]?.reason, "内容を見直す");
  assert.equal(revokeEntries[1]?.result, "allowed");
  assert.equal(revokeEntries[2]?.reason, "確認");
  assert.equal(revokeEntries[2]?.result, "denied");
});

test("a pending suggestion cannot be revoked", async () => {
  const app = makeApp();
  await addStumbles(app, 5, { pattern: "sum-both" });
  const created = await send(app, "POST", "/api/v1/suggestions", { role: "teacher", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", purpose: "直す" });
  const result = await send(app, "POST", `/api/v1/suggestions/${String(created.json.id)}/revoke`, { role: "teacher", reason: "取り消す" });
  assert.equal(errorCode(result.json), "ALREADY_DECIDED");
  const missing = await send(app, "POST", "/api/v1/suggestions/suggestion-999/revoke", { role: "teacher", reason: "確認" });
  assert.equal(errorCode(missing.json), "NOT_FOUND");
});

test("audit log records allowed and denied actions newest first and its own reading", async () => {
  const app = makeApp();
  const id = await createSuggestion(app);
  await query(app, { role: "researcher", scope: "records", purpose: "のぞく" });
  await send(app, "POST", `/api/v1/suggestions/${id}/decision`, { role: "teacher", decision: "approved", candidateNumber: 1, reason: "よい" });
  const first = await send(app, "GET", "/api/v1/audit-log?role=researcher");
  assert.equal(first.status, 200);
  const items = first.json.items as { id: number; at: string; role: string; action: string; targetId: string | null; detail: string | null; reason: string | null; result: string }[];
  assert.deepEqual(items.map((item) => [item.action, item.result]), [["decide", "allowed"], ["query", "denied"], ["suggest", "allowed"]]);
  const [decided, denied, suggested] = items;
  assert.ok(decided && denied && suggested);
  assert.ok(decided.id > denied.id && denied.id > suggested.id);
  assert.equal(decided.at, "2026-11-08T01:00:00.000Z");
  assert.match(String(decided.detail), /approved;candidate:1;source:table/);
  assert.equal(decided.targetId, id);
  assert.equal(denied.reason, "のぞく");
  const second = await send(app, "GET", "/api/v1/audit-log?role=teacher");
  assert.equal((second.json.items as Body[])[0]?.action, "audit-read");
  const badRole = await send(app, "GET", "/api/v1/audit-log?role=child");
  assert.equal(badRole.status, 400);
});

test("満杯の store は古い記録を入れ替えて新しい記録を受ける", async () => {
  const app = makeApp({ capacity: 2 });
  await addStumbles(app, 2);
  const latest = await send(app, "POST", "/api/v1/stumbles", stumble());
  assert.equal(latest.status, 201);
});

test("child-facing routes keep working and keep their own messages", async () => {
  const app = makeApp();
  const health = await send(app, "GET", "/api/health");
  assert.deepEqual(health.json, { status: "ok", forwardedCount: 0 });
  const invalid = await send(app, "POST", "/api/v1/parts", { expression: "" });
  assert.equal((invalid.json.error as { message: string }).message, "もういちど、式を入れてみてね");
});

test("pattern is optional and defaults to unclassified, but unknown values are refused", async () => {
  const app = makeApp();
  const known = await send(app, "POST", "/api/v1/stumbles", stumble({ pattern: "sum-both" }));
  assert.equal(known.status, 201);
  const none = await send(app, "POST", "/api/v1/stumbles", stumble());
  assert.equal(none.status, 201);
  for (const pattern of ["cause-of-error", "", 1, null]) {
    const bad = await send(app, "POST", "/api/v1/stumbles", stumble({ pattern }));
    assert.equal(bad.status, 400, JSON.stringify(pattern));
    assert.equal(errorCode(bad.json), "ADULT_INVALID_REQUEST");
  }
});

test("summary lists a pattern only when its own count reaches the minimum", async () => {
  const app = makeApp();
  await addStumbles(app, LOOP_LIMITS.minGroupSize, { pattern: "sum-both" });
  await addStumbles(app, LOOP_LIMITS.minGroupSize - 1, { pattern: "sum-num-only" });
  await addStumbles(app, 1);
  const result = await query(app, { role: "researcher", scope: "summary", purpose: "調べる" });
  const items = result.json.items as { count: number; patterns: { pattern: string; count: number }[] }[];
  assert.equal(items.length, 1);
  assert.equal(items[0]?.count, LOOP_LIMITS.minGroupSize * 2);
  assert.deepEqual(items[0]?.patterns, [{ pattern: "sum-both", count: LOOP_LIMITS.minGroupSize }]);
});

test("records never carry the pattern", async () => {
  const app = makeApp();
  await addStumbles(app, LOOP_LIMITS.minGroupSize, { pattern: "sum-both" });
  const result = await query(app, { role: "teacher", scope: "records", purpose: "調べる" });
  for (const item of result.json.items as Body[]) assert.equal("pattern" in item, false);
});

test("a suggestion needs a named pattern whose own count is enough, and uses the written table", async () => {
  const app = makeApp();
  await addStumbles(app, LOOP_LIMITS.minGroupSize, { pattern: "unclassified" });
  await addStumbles(app, LOOP_LIMITS.minGroupSize - 1, { pattern: "sum-both" });
  const base = { role: "teacher", lessonKey: "main-6", problem: "1/3+1/4", purpose: "直す" };
  for (const pattern of [undefined, "unclassified", "nope"]) {
    const bad = await send(app, "POST", "/api/v1/suggestions", { ...base, pattern });
    assert.equal(bad.status, 400, String(pattern));
    assert.equal(errorCode(bad.json), "ADULT_INVALID_REQUEST");
  }
  const short = await send(app, "POST", "/api/v1/suggestions", { ...base, pattern: "sum-both" });
  assert.equal(short.status, 422);
  assert.equal(errorCode(short.json), "NOT_ENOUGH_RECORDS");
  await addStumbles(app, 1, { pattern: "sum-both" });
  const made = await send(app, "POST", "/api/v1/suggestions", { ...base, pattern: "sum-both" });
  assert.equal(made.status, 201);
  assert.equal(made.json.pattern, "sum-both");
  assert.deepEqual(made.json.basis, { count: LOOP_LIMITS.minGroupSize });
  assert.match(String(made.json.hint), /分母/);
  assert.doesNotMatch(String(made.json.hint), /\d/, "a hint must carry no number, so it cannot leak the answer");
});

test("suggestions and approved hints are separate per pattern", async () => {
  const app = makeApp();
  await addStumbles(app, LOOP_LIMITS.minGroupSize, { pattern: "sum-both" });
  await addStumbles(app, LOOP_LIMITS.minGroupSize, { pattern: "sum-num-only" });
  const base = { role: "teacher", lessonKey: "main-6", problem: "1/3+1/4", purpose: "直す" };
  const first = await send(app, "POST", "/api/v1/suggestions", { ...base, pattern: "sum-both" });
  const second = await send(app, "POST", "/api/v1/suggestions", { ...base, pattern: "sum-num-only" });
  assert.equal(second.status, 201);
  assert.notEqual(first.json.id, second.json.id);
  assert.notEqual(first.json.hint, second.json.hint);
  await send(app, "POST", `/api/v1/suggestions/${String(first.json.id)}/decision`, { role: "teacher", decision: "approved", candidateNumber: 1, reason: "よい" });
  const url = "/api/v1/approved-hints?lessonKey=main-6&problem=1/3%2B1/4";
  const onlyFirst = await send(app, "GET", `${url}&pattern=sum-both`);
  assert.deepEqual((onlyFirst.json.items as Body[]).map((item) => item.pattern), ["sum-both"]);
  const otherPattern = await send(app, "GET", `${url}&pattern=sum-num-only`);
  assert.deepEqual(otherPattern.json, { items: [] });
  const badPattern = await send(app, "GET", `${url}&pattern=unclassified`);
  assert.equal(badPattern.status, 400);
});

// 今は日本時間の 2026-11-08。7days は 11-02〜11-08
const onDay = (day: string) => ({ occurredAt: `${day}T10:00:00+09:00` });

test("summary period narrows by occurredOn and applies the minimum count after narrowing", async () => {
  const app = makeApp();
  const n = LOOP_LIMITS.minGroupSize;
  await addStumbles(app, n, onDay("2026-11-08"));
  await addStumbles(app, n - 1, onDay("2026-11-05"));
  await addStumbles(app, n, onDay("2026-11-01"));
  const countOf = async (period?: string) => {
    const result = await query(app, { role: "researcher", scope: "summary", purpose: "調べる", ...(period ? { period } : {}) });
    assert.equal(result.status, 200);
    return (result.json.items as { count: number }[]).map((item) => item.count);
  };
  assert.deepEqual(await countOf(), [3 * n - 1]);
  assert.deepEqual(await countOf("today"), [n]);
  // 11-08 の n 件 + 11-05 の n-1 件。11-01 は 7 日の外
  assert.deepEqual(await countOf("7days"), [2 * n - 1]);
});

test("summary period hides a group that falls under the minimum after narrowing", async () => {
  const app = makeApp();
  const n = LOOP_LIMITS.minGroupSize;
  await addStumbles(app, n - 1, onDay("2026-11-08"));
  await addStumbles(app, n, onDay("2026-11-01"));
  await addStumbles(app, n, onDay("2026-11-02"));
  const today = await query(app, { role: "researcher", scope: "summary", purpose: "調べる", period: "today" });
  assert.deepEqual(today.json, { scope: "summary", items: [] });
  const week = await query(app, { role: "researcher", scope: "summary", purpose: "調べる", period: "7days" });
  assert.equal((week.json.items as { count: number }[])[0]?.count, 2 * n - 1);
});

test("summary period refuses unknown values and records with a period", async () => {
  const app = makeApp();
  for (const period of ["week", "", 7, null, true, ["today"]]) {
    const result = await query(app, { role: "researcher", scope: "summary", purpose: "調べる", period });
    assert.equal(result.status, 400);
    assert.equal(errorCode(result.json), "ADULT_INVALID_REQUEST");
  }
  const records = await query(app, { role: "teacher", scope: "records", purpose: "調べる", period: "today" });
  assert.equal(records.status, 400);
});

test("プリントのてこの記録（print:rika-lever、数だけの問題の形）を受け、自由な文は断る（#293）", async () => {
  const app = makeApp({});
  const base = { chapterId: "print-rika-lever", lessonKey: "print:rika-lever", hintsShown: 0, pattern: "unclassified", source: "demo", occurredAt: new Date().toISOString() };
  assert.equal((await send(app, "POST", "/api/v1/stumbles", { ...base, problem: "左2-30g-右3" })).status, 201);
  assert.equal((await send(app, "POST", "/api/v1/stumbles", { ...base, problem: "左のおもりは何g？" })).status, 400);
  assert.equal((await send(app, "POST", "/api/v1/stumbles", { ...base, problem: "左7-30g-右3" })).status, 400);
});
