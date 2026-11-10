// 学びの輪を学級ごとに分ける試験（issue #423）。ログインの往復は createApp の teacherLoginDeps で手元の応答に替える。
// 決まりの正本は docs/product/education-api-contract.md「学びの輪の API」「学級（ワークスペース）の API」
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../app.ts";
import { MockAiClient } from "../ai/mock-client.ts";
import { SESSION_COOKIE } from "../teacher-login/session.ts";
import { createAiQuota, DEFAULT_AI_PER_DAY, readAiPerDay } from "./ai-quota.ts";
import { createLoopStore } from "./store.ts";

const ORIGIN = "https://example.test";
const KEY = "test-key";
const BASE_ENV = {
  TEACHER_LOGIN: "on",
  GOOGLE_CLIENT_ID: "client-1",
  GOOGLE_CLIENT_SECRET: "s3cret",
  PUBLIC_BASE_URL: `${ORIGIN}/`,
  SESSION_SECRET: "0123456789abcdef0123456789abcdef",
  LOOP_APPROVER_KEY: KEY,
  TEACHER_SIGNUP: "open",
};
const JSON_HEADERS = { "content-type": "application/json" };
const HANDOUT = { templateId: "rika-lever", questionText: "てこのはたらき", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } };
const PATTERN = "sum-both";
const HINT = "同じ大きさのタイルにしてみよう";
const DEMO_KEY = { "x-approver-key": KEY };

class DraftClient extends MockAiClient {
  override readonly loopHintDraftEnabled = true;
  calls = 0;
  override async draftLoopHint(): Promise<string> {
    this.calls += 1;
    return HINT;
  }
}

function build(env: Record<string, string | undefined> = BASE_ENV, ai: MockAiClient = new MockAiClient()) {
  let email = "a@example.test";
  const app = createApp(ai, env as NodeJS.ProcessEnv, { requestsPerMinute: 100_000, submissionRequestsPerMinute: 100_000 }, createLoopStore(), {
    teacherLoginDeps: { exchange: async () => "token", verify: async () => ({ subject: "google-sub", email }) },
  });
  const signIn = async (who: string): Promise<Record<string, string>> => {
    email = who;
    const login = await app.request("/api/v1/teacher/login");
    const state = new URL(login.headers.get("location") ?? "").searchParams.get("state") ?? "";
    const pending = cookieValue(login);
    const callback = await app.request(`/api/v1/teacher/callback?code=c&state=${state}`, { headers: { cookie: `${SESSION_COOKIE}=${pending}` } });
    const session = cookieValue(callback);
    assert.ok(session, `${who} が入れなかった`);
    return { cookie: `${SESSION_COOKIE}=${session}`, origin: ORIGIN };
  };
  return { app, signIn };
}
type App = ReturnType<typeof build>["app"];
type Headers = Record<string, string>;
type Json = Record<string, any>;

function cookieValue(response: Response): string | undefined {
  const line = response.headers.getSetCookie().find((value) => value.startsWith(`${SESSION_COOKIE}=`));
  return line?.split(";")[0]?.slice(SESSION_COOKIE.length + 1);
}

const post = (app: App, path: string, body: unknown, headers: Headers = {}) =>
  app.request(path, { method: "POST", headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify(body) });
const getJson = async (app: App, path: string, headers: Headers = {}): Promise<{ status: number; json: Json }> => {
  const response = await app.request(path, { headers });
  return { status: response.status, json: (await response.json()) as Json };
};
const giveHandout = async (app: App, headers: Headers): Promise<string> => {
  const response = await post(app, "/api/v1/print/handouts", HANDOUT, headers);
  assert.equal(response.status, 201);
  return ((await response.json()) as { id: string }).id;
};
const stumble = (pattern: string, extra: Json = {}) => ({
  chapterId: "fraction", lessonKey: "main-6", problem: "1/3+1/4", hintsShown: 0, pattern, source: "demo", occurredAt: "2026-11-08T10:00:00+09:00", ...extra,
});
async function sendStumbles(app: App, count: number, extra: Json = {}, pattern: string = PATTERN): Promise<void> {
  for (let index = 0; index < count; index += 1) assert.equal((await post(app, "/api/v1/stumbles", stumble(pattern, extra))).status, 201);
}
const summaryOf = async (app: App, headers: Headers): Promise<Json[]> => {
  const response = await post(app, "/api/v1/stumbles/query", { role: "teacher", scope: "summary", purpose: "見る" }, headers);
  assert.equal(response.status, 200);
  return ((await response.json()) as { items: Json[] }).items;
};
const countOf = (items: Json[]) => items.reduce((total, item) => total + (item.count as number), 0);
const assistantOf = (app: App, headers: Headers) => getJson(app, "/api/v1/loop/assistant", headers);
const decide = (app: App, id: string, headers: Headers) => post(app, `/api/v1/suggestions/${id}/decision`, { role: "teacher", decision: "approved", reason: "確認" }, headers);

test("(a) 先生 A の学級の子の間違い（handoutId つき）は A の学びの輪に出て、B にも demo にも出ない。handoutId の無い分は demo だけ", async () => {
  const { app, signIn } = build();
  const a = await signIn("a@example.test");
  const b = await signIn("b@example.test");
  const handoutId = await giveHandout(app, a);
  await sendStumbles(app, 5, { handoutId });
  assert.equal(countOf(await summaryOf(app, a)), 5);
  assert.equal(countOf(await summaryOf(app, b)), 0);
  assert.equal(countOf(await summaryOf(app, DEMO_KEY)), 0);
  assert.equal((await assistantOf(app, a)).json.items.length, 1);
  assert.equal((await assistantOf(app, b)).json.items.length, 0);

  await sendStumbles(app, 5);
  await sendStumbles(app, 5, { handoutId: "no-such-handout" });
  await sendStumbles(app, 5, { handoutId: "bad id/with*chars" });
  assert.equal(countOf(await summaryOf(app, DEMO_KEY)), 15, "無い・見つからない・形が違う handoutId は demo");
  assert.equal(countOf(await summaryOf(app, a)), 5);
  assert.equal(countOf(await summaryOf(app, b)), 0);
});

test("(b) A が承認したヒントは、A の説明を開いた子にだけ出る。B の説明と handoutId なしには出ない", async () => {
  const { app, signIn } = build();
  const a = await signIn("a@example.test");
  const b = await signIn("b@example.test");
  const handoutA = await giveHandout(app, a);
  const handoutB = await giveHandout(app, b);
  await sendStumbles(app, 5, { handoutId: handoutA });
  const suggestion = ((await assistantOf(app, a)).json.items as Json[])[0]!.suggestion as { id: string };
  assert.equal((await decide(app, suggestion.id, a)).status, 200);

  const hints = async (query: string) =>
    (await getJson(app, `/api/v1/approved-hints?lessonKey=main-6&problem=${encodeURIComponent("1/3+1/4")}&pattern=${PATTERN}${query}`)).json.items as Json[];
  assert.equal((await hints(`&handoutId=${handoutA}`)).length, 1);
  assert.equal((await hints(`&handoutId=${handoutB}`)).length, 0);
  assert.equal((await hints("")).length, 0);
  assert.equal((await hints("&handoutId=unknown")).length, 0);
});

test("(c) open で入っただけの人が、承認キー無しで自分の学級の記録・アシスタント・見本・承認・操作の記録を使える", async () => {
  const { app, signIn } = build();
  const open = await signIn("anyone@example.test");
  const handoutId = await giveHandout(app, open);
  await sendStumbles(app, 5, { handoutId });
  const records = await post(app, "/api/v1/stumbles/query", { role: "teacher", scope: "records", purpose: "見る" }, open);
  assert.equal(records.status, 200);
  assert.equal(((await records.json()) as { items: unknown[] }).items.length, 5);

  const assistant = await assistantOf(app, open);
  assert.equal(assistant.status, 200);
  const suggestionId = (assistant.json.items[0].suggestion as { id: string }).id;
  assert.equal((await decide(app, suggestionId, open)).status, 200);
  assert.equal((await post(app, "/api/v1/loop/assistant/samples", { stage: "base" }, open)).status, 201);
  // 見本は押した人の学級に入り、demo には入らない
  assert.equal(countOf(await summaryOf(app, DEMO_KEY)), 0);
  const audit = await getJson(app, "/api/v1/audit-log?role=teacher", open);
  assert.equal(audit.status, 200);
  assert.ok((audit.json.items as Json[]).some((item) => item.action === "decide"));
});

test("(d) open の人は demo の記録を読めず、demo の提案を承認もできない。操作の記録も学級ごと", async () => {
  const { app, signIn } = build();
  const open = await signIn("anyone@example.test");
  await sendStumbles(app, 5);
  assert.equal(countOf(await summaryOf(app, DEMO_KEY)), 5);
  assert.equal(countOf(await summaryOf(app, open)), 0);
  const records = await post(app, "/api/v1/stumbles/query", { role: "teacher", scope: "records", purpose: "見る" }, open);
  assert.deepEqual(((await records.json()) as { items: unknown[] }).items, []);

  const suggestionId = ((await assistantOf(app, DEMO_KEY)).json.items[0].suggestion as { id: string }).id;
  assert.equal((await decide(app, suggestionId, open)).status, 404);
  assert.equal((await post(app, `/api/v1/suggestions/${suggestionId}/revoke`, { role: "teacher", reason: "確認" }, open)).status, 404);
  // demo 側の提案は未決のままで、open の人の操作の記録に demo の操作は混ざらない
  assert.equal(((await assistantOf(app, DEMO_KEY)).json.items[0]).status, "pending");
  const audit = (await getJson(app, "/api/v1/audit-log?role=teacher", open)).json.items as Json[];
  assert.ok(audit.every((item) => item.targetId !== "loop-assistant"));
});

test("(e) 承認キーは demo をこれまでどおり使える。ログインが on でも off でも", async () => {
  for (const env of [BASE_ENV, { LOOP_APPROVER_KEY: KEY }]) {
    const { app } = build(env);
    await sendStumbles(app, 5);
    assert.equal((await assistantOf(app, DEMO_KEY)).status, 200);
    assert.equal((await getJson(app, "/api/v1/audit-log?role=teacher", DEMO_KEY)).status, 200);
    assert.equal((await post(app, "/api/v1/loop/assistant/samples", { stage: "base" }, DEMO_KEY)).status, 201);
    assert.ok(countOf(await summaryOf(app, DEMO_KEY)) >= 5);
    assert.equal((await assistantOf(app, { "x-approver-key": "wrong" })).status, 401);
  }
});

test("(e2) 名簿だけの設定（open でない）では、ログインが on のとき承認キーは学びの輪に通らない。名簿の先生は自分の学級", async () => {
  const { app, signIn } = build({ ...BASE_ENV, TEACHER_SIGNUP: undefined, TEACHER_EMAILS: "roster@school.example" });
  assert.equal((await assistantOf(app, DEMO_KEY)).status, 401);
  const roster = await signIn("roster@school.example");
  assert.equal((await assistantOf(app, roster)).status, 200);
});

test("(f) Cookie も承認キーも無い人は、先生用の経路が 401", async () => {
  const { app } = build();
  await sendStumbles(app, 5);
  assert.equal((await assistantOf(app, {})).status, 401);
  assert.equal((await getJson(app, "/api/v1/audit-log?role=teacher")).status, 401);
  for (const path of ["/api/v1/loop/assistant/samples", "/api/v1/suggestions/suggestion-1/decision", "/api/v1/suggestions/suggestion-1/revoke", "/api/v1/loop/assistant/suggestion-1/alternatives"]) {
    assert.equal((await post(app, path, { stage: "base", role: "teacher", decision: "rejected", reason: "確認" })).status, 401, path);
  }
  assert.equal((await post(app, "/api/v1/stumbles/query", { role: "teacher", scope: "summary", purpose: "見る" })).status, 401);
  assert.equal((await post(app, "/api/v1/stumbles/query", { role: "teacher", scope: "records", purpose: "見る" })).status, 401);
  assert.equal((await post(app, "/api/v1/suggestions", { role: "teacher", lessonKey: "main-6", problem: "1/3+1/4", pattern: PATTERN, purpose: "見る" })).status, 401);
  // 失効した Cookie は先生として見ない
  assert.equal((await assistantOf(app, { cookie: `${SESSION_COOKIE}=bad`, origin: ORIGIN })).status, 401);
});

test("(g) アシスタントが Gemini を呼ぶのは、学級ごとに 1 日 LOOP_AI_PER_DAY 回まで。超えたら呼ばずに表の案だけ。demo は数えない", async () => {
  const ai = new DraftClient();
  const { app, signIn } = build({ ...BASE_ENV, LOOP_AI_PER_DAY: "2" }, ai);
  const a = await signIn("a@example.test");
  const b = await signIn("b@example.test");
  const handoutA = await giveHandout(app, a);
  const handoutB = await giveHandout(app, b);
  for (const pattern of ["sum-both", "sum-num-only", "same-den-sum"]) await sendStumbles(app, 5, { handoutId: handoutA }, pattern);
  const items = (await assistantOf(app, a)).json.items as Json[];
  assert.equal(items.length, 3);
  // 型 1 つにつき下書き 3 本。2 回分（6 本）だけ呼ばれ、残りの 1 つの型は表の案だけ
  assert.equal(ai.calls, 6);
  const sources = items.map((item) => (item.suggestion.candidates as Json[]).map((candidate) => candidate.source).join(","));
  assert.equal(sources.filter((value) => value.includes("gemini")).length, 2);
  assert.equal(sources.filter((value) => value === "table").length, 1);
  // 読み直しても、できた案は作り直さない（数も増えない）
  await assistantOf(app, a);
  assert.equal(ai.calls, 6);
  // B の学級は A の分に引きずられない
  await sendStumbles(app, 5, { handoutId: handoutB });
  await assistantOf(app, b);
  assert.equal(ai.calls, 9);
  // demo は数えない
  for (const pattern of ["sum-both", "sum-num-only", "same-den-sum"]) await sendStumbles(app, 5, {}, pattern);
  await assistantOf(app, DEMO_KEY);
  assert.equal(ai.calls, 18);
});

test("(g2) 上限の数え方：日本時間で日が変わると戻る。demo は数えない。環境変数の読み方", () => {
  let now = new Date("2026-11-10T14:00:00Z"); // 日本時間 23:00
  const quota = createAiQuota(2, () => now);
  assert.equal(quota.take("w1"), true);
  assert.equal(quota.take("w1"), true);
  assert.equal(quota.take("w1"), false);
  assert.equal(quota.take("w2"), true);
  for (let index = 0; index < 50; index += 1) assert.equal(quota.take("demo"), true);
  now = new Date("2026-11-10T15:00:00Z"); // 日本時間 0:00（翌日）
  assert.equal(quota.take("w1"), true);
  assert.equal(readAiPerDay({}), DEFAULT_AI_PER_DAY);
  assert.equal(readAiPerDay({ LOOP_AI_PER_DAY: "5" }), 5);
  assert.equal(readAiPerDay({ LOOP_AI_PER_DAY: "0" }), DEFAULT_AI_PER_DAY);
  assert.equal(readAiPerDay({ LOOP_AI_PER_DAY: "abc" }), DEFAULT_AI_PER_DAY);
});

test("学級ごとの置き場：番号は通しで、別の学級の番号は見つからない", () => {
  const store = createLoopStore();
  const input = { lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both" as const, hint: HINT, count: 5, generatedBy: "table" as const, candidates: [] };
  const first = store.scope("w1").createSuggestion(input);
  const second = store.scope("w2").createSuggestion(input);
  assert.notEqual(first.id, second.id);
  assert.equal(store.scope("w2").findSuggestion(first.id), undefined);
  assert.equal(store.findSuggestion(first.id), undefined);
  assert.equal(store.scope("w1"), store.scope("w1"));
});

test("ログインが on のとき、Cookie も承認キーも無い人が role を変えて案を作っても、Gemini は呼ばない（費用の歯止めを避ける道を塞ぐ）。承認キーの人は今までどおり呼べる", async () => {
  const ai = new DraftClient();
  const { app } = build(BASE_ENV, ai);
  // handoutId の無い記録は demo に入る。だれでも送れる
  await sendStumbles(app, 5);
  const suggestion = { role: "researcher", lessonKey: "main-6", problem: "1/3+1/4", pattern: PATTERN, purpose: "確かめ" };
  const anonymous = await post(app, "/api/v1/suggestions", suggestion);
  // 案そのものは表から作れる（今の決まり）。Gemini だけを呼ばない
  assert.equal(anonymous.status, 201);
  assert.equal(((await anonymous.json()) as Json).generatedBy, "table");
  assert.equal(ai.calls, 0);

  const second = build(BASE_ENV, ai);
  await sendStumbles(second.app, 5);
  const withKey = await post(second.app, "/api/v1/suggestions", suggestion, DEMO_KEY);
  assert.equal(withKey.status, 201);
  assert.ok(ai.calls > 0);
});

test("てこの型の直し方は、Gemini に下書きさせず、人が書いた表の案だけを出す（AI への指示が分数の言葉なので、てこには合わない文が返るため）", async () => {
  const ai = new DraftClient();
  const { app, signIn } = build(BASE_ENV, ai);
  const a = await signIn("a@example.test");
  const handout = await giveHandout(app, a);
  const lever = { chapterId: "rika", lessonKey: "print:rika-lever", problem: "左2-30g-右3", hintsShown: 0, pattern: "lever-same-weight", source: "demo", occurredAt: "2026-11-08T10:00:00+09:00", handoutId: handout };
  for (let index = 0; index < 5; index += 1) assert.equal((await post(app, "/api/v1/stumbles", lever)).status, 201);
  const items = (await assistantOf(app, a)).json.items as Json[];
  assert.equal(items.length, 1);
  assert.equal(ai.calls, 0);
  assert.deepEqual((items[0]!.suggestion.candidates as Json[]).map((candidate) => candidate.source), ["table"]);
  // 分数の型は、今までどおり Gemini に下書きさせる
  await sendStumbles(app, 5, { handoutId: handout });
  await assistantOf(app, a);
  assert.ok(ai.calls > 0);
});

test("本物の Gemini のクライアントは、学びの輪の直し方を下書きしない設定になっている（間違え方を勧める文が返ったため、止めている）", async () => {
  const { GeminiAiClient } = await import("../ai/gemini-client.ts");
  const client = new GeminiAiClient({ mode: "vertex", model: "test-model", project: "test-project", location: "global" } as never);
  assert.equal(client.loopHintDraftEnabled, false);
});
