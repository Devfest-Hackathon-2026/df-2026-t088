// お試しの学級（TEACHER_LOGIN=guest）の試験。決まりの正本は docs/product/education-api-contract.md「学級（ワークスペース）の API」
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../app.ts";
import { MockAiClient } from "../ai/mock-client.ts";
import { createLoopStore } from "../loop/store.ts";
import { readTeacherLogin } from "./config.ts";
import { SESSION_COOKIE } from "./session.ts";

const ORIGIN = "https://example.test";
const KEY = "test-key";
const FIXED_SECRET = "0123456789abcdef0123456789abcdef";
const ENV = { TEACHER_LOGIN: "guest", PUBLIC_BASE_URL: `${ORIGIN}/`, LOOP_APPROVER_KEY: KEY };
const JSON_HEADERS = { "content-type": "application/json" };
const HANDOUT = { templateId: "rika-lever", questionText: "てこのはたらき", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } };
const HINT = "同じ大きさのタイルにしてみよう";
const NO_LIMIT = { requestsPerMinute: 100_000, submissionRequestsPerMinute: 100_000, printRequestsPerMinute: 100_000 };

class DraftClient extends MockAiClient {
  override readonly loopHintDraftEnabled = true;
  calls = 0;
  override async draftLoopHint(): Promise<string> {
    this.calls += 1;
    return HINT;
  }
}

type Json = Record<string, any>;
function build(env: Record<string, string | undefined> = ENV, ai: MockAiClient = new MockAiClient(), now?: () => Date) {
  return createApp(ai, env as NodeJS.ProcessEnv, NO_LIMIT, createLoopStore(), now ? { teacherLoginDeps: { now } } : {});
}
type App = ReturnType<typeof build>;

const cookieValue = (response: Response): string | undefined =>
  response.headers.getSetCookie().find((line) => line.startsWith(`${SESSION_COOKIE}=`))?.split(";")[0]?.slice(SESSION_COOKIE.length + 1);
const asCookie = (session: string | undefined): Record<string, string> => ({ cookie: `${SESSION_COOKIE}=${session}`, origin: ORIGIN });
const makeGuest = (app: App, headers: Record<string, string> = { origin: ORIGIN }) =>
  app.request("/api/v1/teacher/guest", { method: "POST", headers: { ...JSON_HEADERS, ...headers }, body: "{}" });
async function newGuest(app: App, client = "198.51.100.1"): Promise<{ session: string; workspace: Json }> {
  const response = await makeGuest(app, { origin: ORIGIN, "x-forwarded-for": client });
  assert.equal(response.status, 200);
  const session = cookieValue(response);
  assert.ok(session);
  return { session, workspace: ((await response.json()) as Json).workspace };
}
const post = (app: App, path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, { method: "POST", headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify(body) });
const getJson = async (app: App, path: string, headers: Record<string, string> = {}): Promise<{ status: number; json: Json }> => {
  const response = await app.request(path, { headers });
  return { status: response.status, json: (await response.json()) as Json };
};
const errorCode = async (response: Response): Promise<string> => ((await response.json()) as { error: { code: string } }).error.code;
const meOf = (app: App, session?: string) => getJson(app, "/api/v1/teacher/me", session ? asCookie(session) : {});

function jpegForm(): FormData {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0, 100, 0, 100, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9]);
  const form = new FormData();
  form.append("image", new Blob([Uint8Array.from(bytes).buffer], { type: "image/jpeg" }), "worksheet.jpg");
  return form;
}
const read = (app: App, headers: Record<string, string>) => app.request("/api/v1/print/read", { method: "POST", body: jpegForm(), headers });
const stumble = (pattern: string, extra: Json = {}) => ({
  chapterId: "fraction", lessonKey: "main-6", problem: "1/3+1/4", hintsShown: 0, pattern, source: "demo", occurredAt: "2026-11-08T10:00:00+09:00", ...extra,
});
async function stumbles(app: App, count: number, extra: Json, pattern = "sum-both"): Promise<void> {
  for (let index = 0; index < count; index += 1) assert.equal((await post(app, "/api/v1/stumbles", stumble(pattern, extra))).status, 201);
}

test("(a) Google の設定も SESSION_SECRET も無しに起動でき、押すと学級ができて me に出る", async () => {
  const settings = readTeacherLogin(ENV as NodeJS.ProcessEnv);
  assert.equal(settings.enabled && settings.signup, "guest");
  assert.equal(settings.enabled && settings.oidc, undefined);
  const app = build();
  assert.deepEqual((await meOf(app)).json, { enabled: true, signedIn: false, signup: "guest" });
  const response = await makeGuest(app);
  assert.equal(response.status, 200);
  const line = response.headers.getSetCookie().find((value) => value.startsWith(`${SESSION_COOKIE}=`)) ?? "";
  assert.match(line, /HttpOnly/i);
  assert.match(line, /SameSite=Lax/i);
  assert.match(line, /Secure/i);
  assert.match(line, /Max-Age=28800/i);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const { workspace } = (await response.json()) as Json;
  assert.deepEqual(Object.keys(workspace).sort(), ["id", "joinCode", "name"]);
  assert.match(workspace.joinCode, /^[A-Z2-9]{6}$/);
  const me = (await meOf(app, cookieValue(response))).json;
  assert.equal(me.signedIn, true);
  assert.equal(me.role, "teacher");
  assert.equal(me.signup, "guest");
  assert.deepEqual(me.workspace, { ...workspace, childCapture: false });
});

test("設定：guest は PUBLIC_BASE_URL が要る。SESSION_SECRET を渡したときは長さを検査する。on・off は今のまま", () => {
  const read = (env: Record<string, string>) => readTeacherLogin(env as NodeJS.ProcessEnv);
  assert.throws(() => read({ TEACHER_LOGIN: "guest" }), /PUBLIC_BASE_URL/);
  assert.throws(() => read({ ...ENV, SESSION_SECRET: "short" }), /at least 32/);
  assert.throws(() => read({ ...ENV, PUBLIC_BASE_URL: "http://example.test" }), /must be https/);
  const fixed = read({ ...ENV, SESSION_SECRET: FIXED_SECRET });
  assert.equal(fixed.enabled && fixed.sessionSecret, FIXED_SECRET);
  const first = read(ENV);
  const second = read(ENV);
  assert.ok(first.enabled && second.enabled && first.sessionSecret.length >= 32 && first.sessionSecret !== second.sessionSecret);
  assert.deepEqual(read({}), { enabled: false });
  assert.throws(() => read({ TEACHER_LOGIN: "on", PUBLIC_BASE_URL: ORIGIN }), /GOOGLE_CLIENT_ID/);
});

test("(b) Origin が違う・無い POST は 403。ほかの設定ではこの経路は無い", async () => {
  const app = build();
  for (const headers of [{} as Record<string, string>, { origin: "https://evil.test" }, { origin: "null" }, { origin: "http://example.test" }, { origin: "https://example.test.evil.test" }]) {
    const response = await makeGuest(app, headers);
    assert.equal(response.status, 403, JSON.stringify(headers));
    assert.equal(await errorCode(response), "FORBIDDEN");
    assert.equal(cookieValue(response), undefined);
  }
  const { session } = await newGuest(app);
  // 学級を持つ人でも、Origin が違えば断る
  assert.equal((await makeGuest(app, { ...asCookie(session), origin: "https://evil.test" })).status, 403);
  const open = { ...ENV, TEACHER_LOGIN: "on", GOOGLE_CLIENT_ID: "c", GOOGLE_CLIENT_SECRET: "s", SESSION_SECRET: FIXED_SECRET, TEACHER_SIGNUP: "open" };
  for (const env of [open, { LOOP_APPROVER_KEY: KEY }]) assert.equal((await makeGuest(build(env))).status, 404);
});

test("(c) 有効な Cookie があれば、押し直しても同じ学級を返し、学級は増えない", async () => {
  const app = build();
  const { session, workspace } = await newGuest(app);
  const again = await makeGuest(app, asCookie(session));
  assert.equal(again.status, 200);
  assert.deepEqual(((await again.json()) as Json).workspace, workspace);
  assert.equal(cookieValue(again), undefined, "新しい Cookie は付けない");
  // 続けて 15 回押しても、1 日 10 個の枠を使わない
  for (let index = 0; index < 15; index += 1) assert.equal((await makeGuest(app, { ...asCookie(session), "x-forwarded-for": "198.51.100.1" })).status, 200);
  assert.notEqual((await newGuest(app)).workspace.id, workspace.id);
});

test("(d) 1 つの接続元からは 1 日 10 個まで。11 個目は 429。別の接続元と翌日は作れる", async () => {
  let at = new Date("2026-11-10T03:00:00Z");
  const app = build(ENV, new MockAiClient(), () => at);
  const ids = new Set<string>();
  for (let index = 0; index < 10; index += 1) ids.add((await newGuest(app, "203.0.113.7")).workspace.id);
  assert.equal(ids.size, 10);
  const eleventh = await makeGuest(app, { origin: ORIGIN, "x-forwarded-for": "203.0.113.7" });
  assert.equal(eleventh.status, 429);
  assert.equal(await errorCode(eleventh), "RATE_LIMITED");
  assert.equal(cookieValue(eleventh), undefined);
  assert.ok((await newGuest(app, "203.0.113.8")).workspace.id);
  // 日本時間の翌日（15:00Z を過ぎる）には数え直す
  at = new Date("2026-11-10T15:30:00Z");
  assert.equal((await makeGuest(app, { origin: ORIGIN, "x-forwarded-for": "203.0.113.7" })).status, 200);
});

test("(e) 2 人の学級は、配った説明も学びの輪も互いに見えない", async () => {
  const app = build();
  const a = await newGuest(app, "198.51.100.1");
  const b = await newGuest(app, "198.51.100.2");
  const handout = await post(app, "/api/v1/print/handouts", HANDOUT, asCookie(a.session));
  assert.equal(handout.status, 201);
  const handoutId = ((await handout.json()) as { id: string }).id;
  const listOf = async (session?: string) => ((await getJson(app, "/api/v1/print/handouts", session ? asCookie(session) : {})).json.items as Json[]).map((item) => item.id);
  assert.deepEqual(await listOf(a.session), [handoutId]);
  assert.deepEqual(await listOf(b.session), []);
  assert.deepEqual(await listOf(), []);
  assert.equal((await app.request(`/api/v1/print/handouts/${handoutId}`, { method: "DELETE", headers: asCookie(b.session) })).status, 404);
  assert.equal((await getJson(app, `/api/v1/join/${a.workspace.joinCode}`)).json.items.length, 1);
  assert.equal((await getJson(app, `/api/v1/join/${b.workspace.joinCode}`)).json.items.length, 0);

  await stumbles(app, 5, { handoutId });
  const assistant = (session: string) => getJson(app, "/api/v1/loop/assistant", asCookie(session));
  assert.equal((await assistant(a.session)).json.items.length, 1);
  assert.equal((await assistant(b.session)).json.items.length, 0);
  const records = async (session: string) => ((await (await post(app, "/api/v1/stumbles/query", { role: "teacher", scope: "records", purpose: "見る" }, asCookie(session))).json()) as Json).items.length;
  assert.equal(await records(a.session), 5);
  assert.equal(await records(b.session), 0);
});

test("(f) guest の人は、課題・時間割の書き込み、名簿の管理、地域のまとめができない", async () => {
  const app = build({ ...ENV, LOOP_BIGQUERY_DATASET: "dataset" });
  const { session } = await newGuest(app);
  const headers = asCookie(session);
  const put = (path: string) => app.request(path, { method: "PUT", headers: { ...JSON_HEADERS, ...headers }, body: "{}" });
  assert.equal((await post(app, "/api/v1/teacher/assignments", {}, headers)).status, 401);
  assert.equal((await put("/api/v1/teacher/timetable")).status, 401);
  assert.equal((await put("/api/v1/teacher/assignments/a-1")).status, 401);
  assert.equal((await app.request("/api/v1/teacher/assignments/a-1", { method: "DELETE", headers })).status, 401);
  assert.equal((await app.request("/api/v1/teacher/members", { headers })).status, 403);
  assert.equal((await post(app, "/api/v1/teacher/members", { email: "x@example.test", role: "admin" }, headers)).status, 403);
  assert.equal((await app.request("/api/v1/teacher/members/x@example.test", { method: "DELETE", headers })).status, 403);
  assert.equal((await app.request("/api/v1/loop/region", { headers })).status, 401);
});

test("(g) 承認キーは guest のときも demo の入口。Cookie があれば Cookie の学級が先", async () => {
  const app = build();
  const demo = { "x-approver-key": KEY };
  assert.equal((await getJson(app, "/api/v1/loop/assistant", demo)).status, 200);
  assert.equal((await post(app, "/api/v1/loop/assistant/samples", { stage: "base" }, demo)).status, 201);
  assert.ok((await getJson(app, "/api/v1/loop/assistant", demo)).json.items.length > 0);
  assert.equal((await getJson(app, "/api/v1/loop/assistant", { "x-approver-key": "wrong" })).status, 401);
  const { session } = await newGuest(app);
  // 自分の学級には見本が入っていない。キーを付けても Cookie が先
  assert.equal((await getJson(app, "/api/v1/loop/assistant", { ...asCookie(session), ...demo })).json.items.length, 0);
  assert.equal((await read(app, demo)).status, 200);
  assert.equal((await post(app, "/api/v1/print/handouts", HANDOUT, demo)).status, 201);
});

test("(h) 読み取りは全学級の合計でも止まる。承認キーは数えない", async () => {
  const app = build({ ...ENV, PRINT_READS_PER_DAY_TOTAL: "3", WORKSPACE_READS_PER_DAY: "30" });
  const a = await newGuest(app, "198.51.100.1");
  const b = await newGuest(app, "198.51.100.2");
  assert.equal((await read(app, asCookie(a.session))).status, 200);
  assert.equal((await read(app, asCookie(a.session))).status, 200);
  assert.equal((await read(app, asCookie(b.session))).status, 200);
  const stopped = await read(app, asCookie(b.session));
  assert.equal(stopped.status, 429);
  assert.deepEqual(((await stopped.json()) as Json).error, { code: "RATE_LIMITED", message: "今日は たくさん使われたので、読み取りは おやすみです。あした また使えます" });
  assert.equal((await read(app, asCookie(a.session))).status, 429);
  for (let index = 0; index < 4; index += 1) assert.equal((await read(app, { "x-approver-key": KEY })).status, 200);
});

test("(h) 学級ごとの上限は今の文のまま。合計が先に尽きるときだけ合計の文が出る", async () => {
  const app = build({ ...ENV, PRINT_READS_PER_DAY_TOTAL: "5", WORKSPACE_READS_PER_DAY: "1" });
  const a = await newGuest(app, "198.51.100.1");
  assert.equal((await read(app, asCookie(a.session))).status, 200);
  const perClass = await read(app, asCookie(a.session));
  assert.equal(perClass.status, 429);
  assert.equal(((await perClass.json()) as Json).error.message, "今日の読み取りの回数を使い切りました。あしたまた使えます");
});

test("(h) 学びの輪の Gemini は全学級の合計でも止まり、表の案だけになる", async () => {
  const ai = new DraftClient();
  const app = build({ ...ENV, LOOP_AI_PER_DAY_TOTAL: "1", LOOP_AI_PER_DAY: "20" }, ai);
  const a = await newGuest(app, "198.51.100.1");
  const b = await newGuest(app, "198.51.100.2");
  const handoutOf = async (session: string) => ((await (await post(app, "/api/v1/print/handouts", HANDOUT, asCookie(session))).json()) as { id: string }).id;
  const handoutA = await handoutOf(a.session);
  const handoutB = await handoutOf(b.session);
  for (const pattern of ["sum-both", "sum-num-only"]) await stumbles(app, 5, { handoutId: handoutA }, pattern);
  await stumbles(app, 5, { handoutId: handoutB });
  const sourcesOf = (items: Json[]) => items.map((item) => (item.suggestion.candidates as Json[]).map((candidate) => candidate.source).join(","));
  const first = sourcesOf((await getJson(app, "/api/v1/loop/assistant", asCookie(a.session))).json.items);
  // 型 1 つにつき下書き 3 本。合計 1 回分だけ呼ばれ、2 つ目の型は表の案だけ
  assert.equal(ai.calls, 3);
  assert.equal(first.filter((value) => value.includes("gemini")).length, 1);
  assert.equal(first.filter((value) => value === "table").length, 1);
  const second = sourcesOf((await getJson(app, "/api/v1/loop/assistant", asCookie(b.session))).json.items);
  assert.equal(ai.calls, 3, "別の学級でも、合計が尽きたら呼ばない");
  assert.deepEqual(second, ["table"]);
});

test("(i) guest では login と callback は 404。logout は今のまま", async () => {
  const app = build();
  assert.equal((await app.request("/api/v1/teacher/login")).status, 404);
  assert.equal((await app.request("/api/v1/teacher/callback?code=c&state=s")).status, 404);
  const { session } = await newGuest(app);
  const out = await post(app, "/api/v1/teacher/logout", {}, asCookie(session));
  assert.equal(out.status, 200);
  assert.deepEqual(await out.json(), { ok: true });
  assert.match(out.headers.getSetCookie().join(";"), new RegExp(`${SESSION_COOKIE}=;`));
});

test("(k) 改ざんした Cookie と、別の起動（別の鍵）で作った Cookie は通らない", async () => {
  const app = build();
  const { session } = await newGuest(app);
  const other = build();
  const forged = `${session.slice(0, -2)}${session.endsWith("A") ? "B" : "A"}A`;
  for (const [target, cookie] of [[app, forged], [app, `${session}x`], [other, session], [app, "bad"]] as const) {
    assert.equal((await meOf(target, cookie)).json.signedIn, false);
    assert.equal((await post(target, "/api/v1/print/handouts", HANDOUT, asCookie(cookie))).status, 401);
    assert.equal((await getJson(target, "/api/v1/loop/assistant", asCookie(cookie))).status, 401);
  }
  // 中身だけを差し替えた Cookie（署名は元のまま）も通らない
  const signature = session.split(".")[1];
  const swapped = `${Buffer.from(JSON.stringify({ kind: "teacher", sub: "someone-else", exp: Date.now() + 3_600_000 })).toString("base64url")}.${signature}`;
  assert.equal((await meOf(app, swapped)).json.signedIn, false);
  // SESSION_SECRET を決めた起動でも、学級はメモリにあるので、別の起動（学級が無い）では通らない
  const fixed = { ...ENV, SESSION_SECRET: FIXED_SECRET };
  const guest = await newGuest(build(fixed));
  assert.equal((await meOf(build(fixed), guest.session)).json.signedIn, false);
});
