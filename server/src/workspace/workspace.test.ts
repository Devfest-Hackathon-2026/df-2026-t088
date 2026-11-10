// 学級（ワークスペース）の API の試験。ログインの往復は createApp の teacherLoginDeps で手元の応答に替える。
// 決まりの正本は docs/product/education-api-contract.md「学級（ワークスペース）の API」
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../app.ts";
import { MockAiClient } from "../ai/mock-client.ts";
import { readTeacherLogin } from "../teacher-login/config.ts";
import { SESSION_COOKIE, signLoginState, signSession, subjectOf } from "../teacher-login/session.ts";

const SECRET = "0123456789abcdef0123456789abcdef";
const ORIGIN = "https://example.test";
const BASE_ENV = {
  TEACHER_LOGIN: "on",
  GOOGLE_CLIENT_ID: "client-1",
  GOOGLE_CLIENT_SECRET: "s3cret",
  PUBLIC_BASE_URL: `${ORIGIN}/`,
  SESSION_SECRET: SECRET,
  LOOP_APPROVER_KEY: "test-key",
};
const OPEN = { ...BASE_ENV, TEACHER_SIGNUP: "open" };
const ROSTER = { ...BASE_ENV, TEACHER_EMAILS: "roster@school.example" };
const JSON_HEADERS = { "content-type": "application/json" };
const BODY = { templateId: "rika-lever", questionText: "てこのはたらき", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } };

function build(env: Record<string, string | undefined>, limits: Record<string, number> = {}) {
  let email = "teacher-a@example.test";
  const app = createApp(new MockAiClient(), env as NodeJS.ProcessEnv, limits, undefined, {
    teacherLoginDeps: { exchange: async () => "token", verify: async () => ({ subject: "google-sub", email }) },
  });
  /** そのメールの人として、login と callback の往復をして、__session の値を返す。入れなければ undefined */
  const signIn = async (who: string): Promise<string | undefined> => {
    email = who;
    const login = await app.request("/api/v1/teacher/login");
    const state = new URL(login.headers.get("location") ?? "").searchParams.get("state") ?? "";
    const pending = valueOf(login, SESSION_COOKIE);
    const callback = await app.request(`/api/v1/teacher/callback?code=c&state=${state}`, { headers: { cookie: `${SESSION_COOKIE}=${pending}` } });
    return callback.headers.get("location")?.includes("login=failed") ? undefined : valueOf(callback, SESSION_COOKIE);
  };
  return { app, signIn };
}

function valueOf(response: Response, name: string): string | undefined {
  const line = response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  return line?.split(";")[0]?.slice(name.length + 1);
}

const asCookie = (session: string | undefined, extra: Record<string, string> = {}) => ({ cookie: `${SESSION_COOKIE}=${session}`, ...extra });
type App = ReturnType<typeof build>["app"];
type Me = { enabled: boolean; signedIn: boolean; role?: string; signup?: string; workspace?: { id: string; name: string; joinCode: string } };
const meOf = async (app: App, session?: string): Promise<Me> => (await app.request("/api/v1/teacher/me", { headers: session ? asCookie(session) : {} })).json() as Promise<Me>;
const listOf = async (app: App, session?: string): Promise<{ id: string }[]> =>
  ((await (await app.request("/api/v1/print/handouts", { headers: session ? asCookie(session) : {} })).json()) as { items: { id: string }[] }).items;
const give = (app: App, session: string) => app.request("/api/v1/print/handouts", { method: "POST", headers: { ...JSON_HEADERS, ...asCookie(session) }, body: JSON.stringify(BODY) });
const errorCode = async (response: Response): Promise<string> => ((await response.json()) as { error: { code: string } }).error.code;

function jpegForm(): FormData {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0, 100, 0, 100, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9]);
  const form = new FormData();
  form.append("image", new Blob([Uint8Array.from(bytes).buffer], { type: "image/jpeg" }), "worksheet.jpg");
  return form;
}
const read = (app: App, headers: Record<string, string>) => app.request("/api/v1/print/read", { method: "POST", body: jpegForm(), headers });

// ---- 入る ----

test("open：名簿が空でも起動でき、名簿に無い人が Google で入ると自分の学級ができる。Cookie は __session の 1 つだけ", async () => {
  const settings = readTeacherLogin(OPEN as NodeJS.ProcessEnv);
  assert.equal(settings.enabled && settings.signup, "open");
  const { app, signIn } = build(OPEN);
  const login = await app.request("/api/v1/teacher/login");
  assert.deepEqual(login.headers.getSetCookie().map((line) => line.split("=")[0]), [SESSION_COOKIE]);
  const session = await signIn("stranger@example.test");
  assert.ok(session);
  const me = await meOf(app, session);
  assert.equal(me.signedIn, true);
  assert.equal(me.signup, "open");
  assert.equal(me.role, "teacher");
  assert.equal(me.workspace?.name, "わたしの学級");
  assert.match(me.workspace?.joinCode ?? "", /^[A-Z2-9]{6}$/);
  // 同じ人がもう一度入っても、同じ学級
  assert.equal((await meOf(app, await signIn("Stranger@example.test"))).workspace?.id, me.workspace?.id);
  // 名簿に無い人は管理者ではない
  assert.equal((await app.request("/api/v1/teacher/members", { headers: asCookie(session) })).status, 403);
});

test("roster：名簿に無い人は入れない。名簿の先生は入れて学級ができる。signup は roster", async () => {
  assert.throws(() => readTeacherLogin(BASE_ENV as NodeJS.ProcessEnv), /ADMIN_EMAILS or TEACHER_EMAILS/);
  const { app, signIn } = build(ROSTER);
  assert.equal(await signIn("stranger@example.test"), undefined);
  assert.deepEqual(await meOf(app), { enabled: true, signedIn: false, signup: "roster" });
  const session = await signIn("roster@school.example");
  assert.ok(session);
  const me = await meOf(app, session);
  assert.equal(me.signup, "roster");
  assert.ok(me.workspace?.joinCode);
});

test("印（sub）の無い Cookie は、名簿の人でも open でも通らない。ログイン途中の Cookie や別の鍵の Cookie も通らない", async () => {
  for (const env of [ROSTER, OPEN]) {
    const { app } = build(env);
    const legacy = signSession(SECRET, new Date());
    assert.equal((await meOf(app, legacy)).signedIn, false);
    assert.equal((await give(app, legacy)).status, 401);
    assert.equal((await app.request("/api/v1/workspace", { method: "PATCH", headers: { ...JSON_HEADERS, ...asCookie(legacy) }, body: JSON.stringify({ name: "x" }) })).status, 401);
    const pending = signLoginState(SECRET, new Date(), { state: "s", nonce: "n", verifier: "v" });
    assert.equal((await meOf(app, pending)).signedIn, false);
    const forged = signSession("another-secret-another-secret-00", new Date(), subjectOf(SECRET, "roster@school.example"));
    assert.equal((await meOf(app, forged)).signedIn, false);
  }
});

test("open：印だけで学級が無い Cookie は通らない", async () => {
  const { app } = build(OPEN);
  const noWorkspace = signSession(SECRET, new Date(), subjectOf(SECRET, "nobody@example.test"));
  assert.equal((await meOf(app, noWorkspace)).signedIn, false);
});

// ---- 配った説明は学級で分かれる ----

test("先生 A の配った説明は先生 B の一覧に出ず、B は A のものを消せない。A は消せる", async () => {
  const { app, signIn } = build(OPEN);
  const a = (await signIn("teacher-a@example.test"))!;
  const b = (await signIn("teacher-b@example.test"))!;
  const created = await give(app, a);
  assert.equal(created.status, 201);
  const item = await created.json() as { id: string };
  assert.deepEqual(Object.keys(item).sort(), ["createdAt", "id", "params", "questionText", "templateId"]);
  assert.deepEqual((await listOf(app, a)).map((entry) => entry.id), [item.id]);
  assert.deepEqual(await listOf(app, b), []);
  assert.deepEqual(await listOf(app), []);
  assert.equal((await app.request(`/api/v1/print/handouts/${item.id}`, { method: "DELETE", headers: asCookie(b, { origin: ORIGIN }) })).status, 404);
  assert.equal((await listOf(app, a)).length, 1);
  assert.equal((await app.request(`/api/v1/print/handouts/${item.id}`, { method: "DELETE", headers: asCookie(a, { origin: ORIGIN }) })).status, 204);
  assert.equal((await listOf(app, a)).length, 0);
});

test("承認キーで配ったものは demo に入り、ログインなしの一覧に出る。先生の学級の一覧には出ない", async () => {
  const { app, signIn } = build(OPEN);
  const teacher = (await signIn("teacher-a@example.test"))!;
  const created = await app.request("/api/v1/print/handouts", { method: "POST", headers: { ...JSON_HEADERS, "x-approver-key": "test-key" }, body: JSON.stringify(BODY) });
  assert.equal(created.status, 201);
  const item = await created.json() as { id: string };
  assert.deepEqual((await listOf(app)).map((entry) => entry.id), [item.id]);
  assert.deepEqual(await listOf(app, teacher), []);
  // 先生が配ったものは demo の一覧に出ない
  await give(app, teacher);
  assert.deepEqual((await listOf(app)).map((entry) => entry.id), [item.id]);
  // 先生は demo のものを消せない
  assert.equal((await app.request(`/api/v1/print/handouts/${item.id}`, { method: "DELETE", headers: asCookie(teacher, { origin: ORIGIN }) })).status, 404);
  assert.equal((await app.request(`/api/v1/print/handouts/${item.id}`, { method: "DELETE", headers: { "x-approver-key": "test-key" } })).status, 204);
});

test("リンクを持つ子どもは 1 件を読める。無い id は 404", async () => {
  const { app, signIn } = build(OPEN);
  const teacher = (await signIn("teacher-a@example.test"))!;
  const item = await (await give(app, teacher)).json() as { id: string };
  const found = await app.request(`/api/v1/print/handouts/${item.id}`);
  assert.equal(found.status, 200);
  assert.equal((await found.json() as { questionText: string }).questionText, BODY.questionText);
  const missing = await app.request("/api/v1/print/handouts/no-such-id");
  assert.equal(missing.status, 404);
  assert.equal(await errorCode(missing), "NOT_FOUND");
});

// ---- 子どもが学級コードで見る ----

test("join：学級コードで学級の名前と一覧が返る（小文字でも）。無いコードは 404。名前を直すと反映される", async () => {
  const { app, signIn } = build(OPEN);
  const teacher = (await signIn("teacher-a@example.test"))!;
  const other = (await signIn("teacher-b@example.test"))!;
  const item = await (await give(app, teacher)).json() as { id: string };
  await give(app, other);
  const code = (await meOf(app, teacher)).workspace!.joinCode;
  const joined = await app.request(`/api/v1/join/${code.toLowerCase()}`);
  assert.equal(joined.status, 200);
  const body = await joined.json() as { name: string; items: { id: string }[] };
  assert.equal(body.name, "わたしの学級");
  assert.deepEqual(body.items.map((entry) => entry.id), [item.id]);
  assert.deepEqual(Object.keys(body).sort(), ["childCapture", "items", "name"]);

  const renamed = await app.request("/api/v1/workspace", { method: "PATCH", headers: { ...JSON_HEADERS, ...asCookie(teacher, { origin: ORIGIN }) }, body: JSON.stringify({ name: "  3年2組  " }) });
  assert.equal(renamed.status, 200);
  const workspace = await renamed.json() as { id: string; name: string; joinCode: string; createdAt: string };
  assert.equal(workspace.name, "3年2組");
  assert.equal(workspace.joinCode, code);
  assert.equal(((await (await app.request(`/api/v1/join/${code}`)).json()) as { name: string }).name, "3年2組");

  for (const unknown of ["ZZZZZZ", "abc", "A".repeat(100)]) {
    const missing = await app.request(`/api/v1/join/${unknown}`);
    assert.equal(missing.status, 404);
    assert.equal(await errorCode(missing), "NOT_FOUND");
  }
});

test("PATCH /workspace：入っていなければ 401、形や名前が違えば 400", async () => {
  const { app, signIn } = build(OPEN);
  const patch = (headers: Record<string, string>, body: unknown) =>
    app.request("/api/v1/workspace", { method: "PATCH", headers: { ...JSON_HEADERS, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
  assert.equal((await patch({}, { name: "x" })).status, 401);
  assert.equal((await patch({ "x-approver-key": "test-key" }, { name: "x" })).status, 401);
  const teacher = (await signIn("teacher-a@example.test"))!;
  const headers = asCookie(teacher, { origin: ORIGIN });
  for (const bad of [{}, { name: 5 }, { name: "" }, { name: "   " }, { name: "あ".repeat(31) }, { name: "a\nb" }, { name: "ok", extra: 1 }, [], "not json"]) {
    const response = await patch(headers, bad);
    assert.equal(response.status, 400, JSON.stringify(bad));
    assert.equal(await errorCode(response), "ADULT_INVALID_REQUEST");
  }
  assert.equal((await meOf(app, teacher)).workspace?.name, "わたしの学級");
});

// ---- 読み取りの回数 ----

test("読み取り：Cookie の先生は 1 日の上限で 429。承認キーのときは数えない。学級ごとに別", async () => {
  const { app, signIn } = build({ ...OPEN, WORKSPACE_READS_PER_DAY: "2" }, { printRequestsPerMinute: 100 });
  const a = (await signIn("teacher-a@example.test"))!;
  const b = (await signIn("teacher-b@example.test"))!;
  const headersOf = (session: string) => asCookie(session, { origin: ORIGIN });
  assert.equal((await read(app, headersOf(a))).status, 200);
  assert.equal((await read(app, headersOf(a))).status, 200);
  const limited = await read(app, headersOf(a));
  assert.equal(limited.status, 429);
  assert.deepEqual((await limited.json() as { error: { code: string; message: string } }).error, { code: "RATE_LIMITED", message: "今日の読み取りの回数を使い切りました。あしたまた使えます" });
  assert.equal((await read(app, headersOf(b))).status, 200);
  for (let index = 0; index < 4; index += 1) assert.equal((await read(app, { "x-approver-key": "test-key" })).status, 200);
});

// ---- Origin と Cache-Control ----

test("Origin が違う、Cookie 付きの書き込みは 403。合う・無い・Cookie なし・GET は通る", async () => {
  const { app, signIn } = build(OPEN);
  const teacher = (await signIn("teacher-a@example.test"))!;
  const post = (headers: Record<string, string>) => app.request("/api/v1/print/handouts", { method: "POST", headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify(BODY) });
  for (const evil of ["https://evil.test", "null", "http://example.test", "https://example.test.evil.test"]) {
    const refused = await post(asCookie(teacher, { origin: evil }));
    assert.equal(refused.status, 403, evil);
    assert.equal(await errorCode(refused), "FORBIDDEN");
  }
  assert.equal((await app.request("/api/v1/workspace", { method: "PATCH", headers: { ...JSON_HEADERS, ...asCookie(teacher, { origin: "https://evil.test" }) }, body: JSON.stringify({ name: "x" }) })).status, 403);
  assert.equal((await app.request("/api/v1/teacher/logout", { method: "POST", headers: { ...JSON_HEADERS, ...asCookie(teacher, { origin: "https://evil.test" }) }, body: "{}" })).status, 403);
  assert.equal((await listOf(app, teacher)).length, 0);
  assert.equal((await post(asCookie(teacher, { origin: ORIGIN }))).status, 201);
  assert.equal((await post(asCookie(teacher))).status, 201);
  assert.equal((await post({ "x-approver-key": "test-key", origin: "https://evil.test" })).status, 201);
  assert.equal((await app.request("/api/v1/print/handouts", { headers: asCookie(teacher, { origin: "https://evil.test" }) })).status, 200);
});

test("Cookie で見分ける応答は Cache-Control: private, no-store を付ける", async () => {
  const { app, signIn } = build(OPEN);
  const teacher = (await signIn("teacher-a@example.test"))!;
  const responses = [
    await app.request("/api/v1/teacher/me"),
    await app.request("/api/v1/teacher/me", { headers: asCookie(teacher) }),
    await app.request("/api/v1/workspace", { method: "PATCH", headers: { ...JSON_HEADERS, ...asCookie(teacher) }, body: JSON.stringify({ name: "x" }) }),
    await app.request("/api/v1/print/handouts"),
    await app.request("/api/v1/print/handouts", { headers: asCookie(teacher) }),
  ];
  for (const response of responses) assert.equal(response.headers.get("cache-control"), "private, no-store");
});

// ---- ログインが on でないとき ----

test("TEACHER_LOGIN が on でないとき：me・handouts・read は今のまま。学級は作れない", async () => {
  const env = { LOOP_APPROVER_KEY: "test-key", TEACHER_SIGNUP: "open" };
  const app = createApp(new MockAiClient(), env as NodeJS.ProcessEnv, { printRequestsPerMinute: 100 });
  const me = await app.request("/api/v1/teacher/me");
  assert.deepEqual(await me.json(), { enabled: false, signedIn: false });
  assert.equal(me.headers.get("cache-control"), null);
  assert.equal((await app.request("/api/v1/print/handouts")).headers.get("cache-control"), null);
  // 承認キーで配り、ログインなしで読める（demo）
  const created = await app.request("/api/v1/print/handouts", { method: "POST", headers: { ...JSON_HEADERS, "x-approver-key": "test-key" }, body: JSON.stringify(BODY) });
  assert.equal(created.status, 201);
  assert.equal(((await (await app.request("/api/v1/print/handouts")).json()) as { items: unknown[] }).items.length, 1);
  // Cookie は先生として見ない。Origin が違っても止めない
  const cookie = asCookie(signSession(SECRET, new Date(), subjectOf(SECRET, "a@example.test")), { origin: "https://evil.test" });
  assert.equal((await app.request("/api/v1/print/handouts", { method: "POST", headers: { ...JSON_HEADERS, ...cookie }, body: JSON.stringify(BODY) })).status, 401);
  // read：キーなしは 401、キーありは何度でも通る（数えない）
  assert.equal((await read(app, {})).status, 401);
  for (let index = 0; index < 35; index += 1) assert.equal((await read(app, { "x-approver-key": "test-key" })).status, 200);
  assert.equal((await app.request("/api/v1/workspace", { method: "PATCH", headers: { ...JSON_HEADERS, "x-approver-key": "test-key" }, body: JSON.stringify({ name: "x" }) })).status, 401);
  assert.equal((await app.request("/api/v1/join/ABC234")).status, 404);
});

test("学びの輪は学級ごと：open で入っただけの人も自分の学級の分を承認キー無しで使える。課題・時間割の書き込みは使えない。承認キーは demo の入口", async () => {
  const { app, signIn } = build({ ...OPEN, TEACHER_EMAILS: "roster@school.example" });
  const open = await signIn("anyone@example.test");
  const roster = await signIn("roster@school.example");
  assert.ok(open && roster);
  const asCookie = (value: string) => ({ cookie: `${SESSION_COOKIE}=${value}`, origin: ORIGIN });

  for (const path of ["/api/v1/audit-log?role=teacher", "/api/v1/loop/assistant"]) {
    assert.equal((await app.request(path, { headers: asCookie(open) })).status, 200, `open: ${path}`);
    assert.equal((await app.request(path, { headers: asCookie(roster) })).status, 200, `roster: ${path}`);
    assert.equal((await app.request(path, { headers: { "x-approver-key": "test-key" } })).status, 200, `key: ${path}`);
    assert.equal((await app.request(path)).status, 401, `none: ${path}`);
  }
  // 見本は押した人の学級に入る（本文が空なら 400。権限の 401 ではない）
  const samples = await app.request("/api/v1/loop/assistant/samples", { method: "POST", headers: { ...JSON_HEADERS, ...asCookie(open) }, body: "{}" });
  assert.equal(samples.status, 400);
  // 課題・時間割（見本の学級を共有している）は、open の人には書かせない
  const assignment = await app.request("/api/v1/teacher/assignments", { method: "POST", headers: { ...JSON_HEADERS, ...asCookie(open) }, body: "{}" });
  assert.equal(assignment.status, 401);
  // 自分の学級のプリントは、open の人も使える
  assert.equal((await app.request("/api/v1/print/handouts", { method: "POST", headers: { ...JSON_HEADERS, ...asCookie(open) }, body: JSON.stringify(BODY) })).status, 201);
});
