// 子どもが学級コードで自分のプリントを撮る道の試験（issue #485）。決まりの正本は docs/product/education-api-contract.md「学級（ワークスペース）の API」
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../app.ts";
import { MockAiClient } from "../ai/mock-client.ts";
import { createLoopStore } from "../loop/store.ts";
import { SESSION_COOKIE } from "../teacher-login/session.ts";

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
type Json = Record<string, any>;
type Headers = Record<string, string>;

function build(env: Record<string, string | undefined> = BASE_ENV) {
  let email = "a@example.test";
  const app = createApp(new MockAiClient(), env as NodeJS.ProcessEnv, { requestsPerMinute: 100_000, submissionRequestsPerMinute: 100_000, printRequestsPerMinute: 100_000 }, createLoopStore(), {
    teacherLoginDeps: { exchange: async () => "token", verify: async () => ({ subject: `sub-${email}`, email }) },
  });
  const signIn = async (who: string): Promise<{ headers: Headers; code: string }> => {
    email = who;
    const login = await app.request("/api/v1/teacher/login");
    const state = new URL(login.headers.get("location") ?? "").searchParams.get("state") ?? "";
    const pending = cookieValue(login);
    const callback = await app.request(`/api/v1/teacher/callback?code=c&state=${state}`, { headers: { cookie: `${SESSION_COOKIE}=${pending}` } });
    const headers = { cookie: `${SESSION_COOKIE}=${cookieValue(callback)}`, origin: ORIGIN };
    const me = await (await app.request("/api/v1/teacher/me", { headers })).json() as Json;
    return { headers, code: me.workspace.joinCode as string };
  };
  return { app, signIn };
}
type App = ReturnType<typeof build>["app"];

function cookieValue(response: Response): string | undefined {
  const line = response.headers.getSetCookie().find((value) => value.startsWith(`${SESSION_COOKIE}=`));
  return line?.split(";")[0]?.slice(SESSION_COOKIE.length + 1);
}

function jpegForm(): FormData {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0, 100, 0, 100, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9]);
  const form = new FormData();
  form.append("image", new Blob([Uint8Array.from(bytes).buffer], { type: "image/jpeg" }), "worksheet.jpg");
  return form;
}
const readAs = (app: App, headers: Headers) => app.request("/api/v1/print/read", { method: "POST", body: jpegForm(), headers });
const childRead = (app: App, code: string) => readAs(app, { "x-class-code": code });
const setCapture = (app: App, teacher: Headers, value: unknown) =>
  app.request("/api/v1/workspace", { method: "PATCH", headers: { ...JSON_HEADERS, ...teacher }, body: JSON.stringify({ childCapture: value }) });
const errorCode = async (response: Response): Promise<string> => ((await response.json()) as { error: { code: string } }).error.code;
const handoutsOf = async (app: App, headers: Headers = {}): Promise<Json[]> =>
  ((await (await app.request("/api/v1/print/handouts", { headers })).json()) as { items: Json[] }).items;
const joinOf = async (app: App, code: string): Promise<Json> => (await app.request(`/api/v1/join/${code}`)).json() as Promise<Json>;

test("(a)(d) 既定（切）の学級のコード・無いコード・ほかの学級のコードでは、子どもの読み取りは 401", async () => {
  const { app, signIn } = build();
  const a = await signIn("a@example.test");
  const b = await signIn("b@example.test");
  await setCapture(app, b.headers, true);
  assert.equal((await joinOf(app, a.code)).childCapture, false);
  const off = await childRead(app, a.code);
  assert.equal(off.status, 401);
  assert.equal(await errorCode(off), "UNAUTHORIZED");
  assert.equal((await childRead(app, "ZZZZZZ")).status, 401);
  assert.equal((await childRead(app, "x".repeat(40))).status, 401);
  assert.equal((await readAs(app, {})).status, 401);
  // 入れた学級のコードは通る。A のコードは切のまま
  assert.equal((await childRead(app, b.code.toLowerCase())).status, 200);
  assert.equal((await childRead(app, a.code)).status, 401);
});

test("(b)(e)(f) 入れると読み取れる。てこと月だけ返り、分数は対応していません。説明は join に出ず、先生の一覧に child で出る", async () => {
  const { app, signIn } = build();
  const a = await signIn("a@example.test");
  assert.equal((await setCapture(app, a.headers, true)).status, 200);
  assert.equal((await joinOf(app, a.code)).childCapture, true);

  const response = await childRead(app, a.code);
  assert.equal(response.status, 200);
  const body = await response.json() as Json;
  assert.deepEqual(body.problems.map((problem: Json) => problem.templateId), ["rika-lever", "rika-moon"]);
  assert.equal(body.unsupportedCount, 2, "モックの未対応 1 件 + 分数 1 件");
  assert.equal(body.demandRecorded, true);
  assert.ok(body.problems.every((problem: Json) => typeof problem.handoutId === "string"));

  // 子どもの一覧（join・Cookie なしの一覧）には出ない。id では読める
  assert.deepEqual((await joinOf(app, a.code)).items, []);
  assert.deepEqual(await handoutsOf(app), []);
  const own = await app.request(`/api/v1/print/handouts/${body.problems[0].handoutId}`);
  assert.equal(own.status, 200);
  assert.equal((await own.json() as Json).origin, undefined);

  // 先生の一覧には origin: child で出る。先生が配ったものは teacher
  const given = await app.request("/api/v1/print/handouts", { method: "POST", headers: { ...JSON_HEADERS, ...a.headers }, body: JSON.stringify({ templateId: "rika-moon", questionText: "月の形", params: {} }) });
  assert.equal(given.status, 201);
  assert.equal(Object.hasOwn(await given.json() as Json, "origin"), false);
  const list = await handoutsOf(app, a.headers);
  assert.deepEqual(list.map((item) => item.origin).sort(), ["child", "child", "teacher"]);
  assert.deepEqual((await joinOf(app, a.code)).items.map((item: Json) => item.origin), [undefined]);
});

test("(f) ほかの学級の先生には子どもが撮った説明が見えず、消せない。持ち主は消せる", async () => {
  const { app, signIn } = build();
  const a = await signIn("a@example.test");
  const b = await signIn("b@example.test");
  await setCapture(app, a.headers, true);
  const id = ((await (await childRead(app, a.code)).json()) as Json).problems[0].handoutId as string;
  assert.deepEqual(await handoutsOf(app, b.headers), []);
  assert.equal((await app.request(`/api/v1/print/handouts/${id}`, { method: "DELETE", headers: b.headers })).status, 404);
  assert.equal((await app.request(`/api/v1/print/handouts/${id}`, { method: "DELETE", headers: {} })).status, 401);
  assert.equal((await app.request(`/api/v1/print/handouts/${id}`, { method: "DELETE", headers: a.headers })).status, 204);
  assert.equal((await app.request(`/api/v1/print/handouts/${id}`)).status, 404);
});

test("(b)(c) 学級の回数と全体の回数が 1 つずつ減り、どちらの上限でも 429", async () => {
  const perClass = build({ ...BASE_ENV, WORKSPACE_READS_PER_DAY: "2" });
  const a = await perClass.signIn("a@example.test");
  await setCapture(perClass.app, a.headers, true);
  // 先生の読み取りと同じ枠を使う
  assert.equal((await readAs(perClass.app, a.headers)).status, 200);
  assert.equal((await childRead(perClass.app, a.code)).status, 200);
  const limited = await childRead(perClass.app, a.code);
  assert.equal(limited.status, 429);
  const limitedBody = await limited.json() as { error: { code: string; scope?: string } };
  assert.deepEqual([limitedBody.error.code, limitedBody.error.scope], ["RATE_LIMITED", "day"]);

  const total = build({ ...BASE_ENV, PRINT_READS_PER_DAY_TOTAL: "2" });
  const t = await total.signIn("t@example.test");
  const other = await total.signIn("u@example.test");
  await setCapture(total.app, t.headers, true);
  await setCapture(total.app, other.headers, true);
  assert.equal((await childRead(total.app, t.code)).status, 200);
  assert.equal((await childRead(total.app, other.code)).status, 200);
  assert.equal((await childRead(total.app, t.code)).status, 429, "全体の上限は、学級が違っても数える");
});

test("(g) 返った handoutId を付けた間違いは、その学級の学びの輪に入る", async () => {
  const { app, signIn } = build();
  const a = await signIn("a@example.test");
  const b = await signIn("b@example.test");
  await setCapture(app, a.headers, true);
  const handoutId = ((await (await childRead(app, a.code)).json()) as Json).problems[0].handoutId as string;
  const stumble = { chapterId: "fraction", lessonKey: "main-6", problem: "1/3+1/4", hintsShown: 0, pattern: "sum-both", source: "demo", occurredAt: "2026-11-08T10:00:00+09:00", handoutId };
  for (let index = 0; index < 5; index += 1) {
    assert.equal((await app.request("/api/v1/stumbles", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(stumble) })).status, 201);
  }
  const count = async (headers: Headers) => {
    const response = await app.request("/api/v1/stumbles/query", { method: "POST", headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify({ role: "teacher", scope: "summary", purpose: "見る" }) });
    return ((await response.json()) as { items: Json[] }).items.reduce((total, item) => total + (item.count as number), 0);
  };
  assert.equal(await count(a.headers), 5);
  assert.equal(await count(b.headers), 0);
});

test("(h) childCapture を切り替えられるのは持ち主だけ。形が違えば 400。name だけの要求は今までどおり", async () => {
  const { app, signIn } = build();
  const a = await signIn("a@example.test");
  const anonymous = await app.request("/api/v1/workspace", { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ childCapture: true }) });
  assert.equal(anonymous.status, 401);
  assert.equal((await joinOf(app, a.code)).childCapture, false);

  for (const value of ["true", 1, null, undefined]) assert.equal((await setCapture(app, a.headers, value)).status, 400);
  for (const body of [{}, { childCapture: true, extra: 1 }, { other: true }, []]) {
    const response = await app.request("/api/v1/workspace", { method: "PATCH", headers: { ...JSON_HEADERS, ...a.headers }, body: JSON.stringify(body) });
    assert.equal(response.status, 400);
  }
  // 名前が悪ければ、childCapture も変えない
  const bad = await app.request("/api/v1/workspace", { method: "PATCH", headers: { ...JSON_HEADERS, ...a.headers }, body: JSON.stringify({ name: "", childCapture: true }) });
  assert.equal(bad.status, 400);
  assert.equal((await joinOf(app, a.code)).childCapture, false);

  const both = await app.request("/api/v1/workspace", { method: "PATCH", headers: { ...JSON_HEADERS, ...a.headers }, body: JSON.stringify({ name: "3年1組", childCapture: true }) });
  assert.equal(both.status, 200);
  assert.deepEqual([(await both.json() as Json).name, (await joinOf(app, a.code)).childCapture], ["3年1組", true]);
  const nameOnly = await app.request("/api/v1/workspace", { method: "PATCH", headers: { ...JSON_HEADERS, ...a.headers }, body: JSON.stringify({ name: "3年2組" }) });
  assert.equal(nameOnly.status, 200);
  assert.equal((await joinOf(app, a.code)).childCapture, true, "name だけの要求では childCapture を変えない");
  const me = await (await app.request("/api/v1/teacher/me", { headers: a.headers })).json() as Json;
  assert.equal(me.workspace.childCapture, true);
  assert.equal((await setCapture(app, a.headers, false)).status, 200);
  assert.equal((await childRead(app, a.code)).status, 401);
});

test("(i) 全体の PRINT_CHILD_CAPTURE=on の道と、承認キー・先生の Cookie の読み取りは今までどおり", async () => {
  const open = build({ ...BASE_ENV, PRINT_CHILD_CAPTURE: "on" });
  const a = await open.signIn("a@example.test");
  assert.equal((await readAs(open.app, {})).status, 200, "全体が on なら、コード無しでも読める");
  assert.equal((await childRead(open.app, a.code)).status, 200, "学級が切でも全体が on なら今の道");
  assert.deepEqual(await handoutsOf(open.app, a.headers), [], "全体 on の道では説明を保存しない");
  const { app, signIn } = build();
  const teacher = await signIn("t@example.test");
  assert.equal((await readAs(app, { "x-approver-key": KEY })).status, 200);
  assert.equal((await readAs(app, teacher.headers)).status, 200);
  // 先生の Cookie があるときは、コードがあっても先生の道（説明は保存しない）
  assert.equal((await readAs(app, { ...teacher.headers, "x-class-code": teacher.code })).status, 200);
  assert.deepEqual(await handoutsOf(app, teacher.headers), []);
});
