// 先生の役割の管理（#351）の試験。認証と権限の変更なので、断る側を先に書いてある。
// 決まりの正本は docs/product/education-api-contract.md「先生の役割の管理の API」
import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { createApp } from "../app.ts";
import { MockAiClient } from "../ai/mock-client.ts";
import { readTeacherLogin } from "../teacher-login/config.ts";
import { registerTeacherLoginRoutes, teacherSessionValid } from "../teacher-login/routes.ts";
import { SESSION_COOKIE, signSession, subjectOf } from "../teacher-login/session.ts";
import { MemoryTeacherMemberStore } from "./store.ts";
import { registerTeacherMemberRoutes } from "./routes.ts";

const SECRET = "0123456789abcdef0123456789abcdef";
const ENV = {
  TEACHER_LOGIN: "on",
  GOOGLE_CLIENT_ID: "client-1",
  GOOGLE_CLIENT_SECRET: "s3cret",
  PUBLIC_BASE_URL: "https://example.test/",
  SESSION_SECRET: SECRET,
  ADMIN_EMAILS: "Boss@school.example",
  TEACHER_EMAILS: "ms.one@school.example, two@school.example",
  SCHOOL_DOMAIN: "school.example",
};
const JSON_HEADERS = { "content-type": "application/json" };

function build(env: Record<string, string | undefined> = ENV, verifiedEmail = "ms.one@school.example") {
  const settings = readTeacherLogin(env as NodeJS.ProcessEnv);
  const app = new Hono();
  registerTeacherLoginRoutes(app, settings, {
    exchange: async () => "token",
    verify: async () => ({ subject: "google-sub", email: verifiedEmail }),
  });
  registerTeacherMemberRoutes(app, settings);
  return { app, settings };
}

/** そのメールの人としてログインした Cookie（Google の往復は省き、同じ形の Cookie を作る） */
const cookieFor = (email: string) => ({ cookie: `${SESSION_COOKIE}=${signSession(SECRET, new Date(), subjectOf(SECRET, email))}` });

async function send(app: Hono, method: string, path: string, headers: Record<string, string> = {}, body?: unknown) {
  const response = await app.request(path, { method, headers: { ...(body === undefined ? {} : JSON_HEADERS), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, json: (await response.json()) as Record<string, any> };
}
const code = (result: { json: Record<string, any> }) => result.json.error?.code;

// ---- 断る側（必ず試験する） ----

test("ログインが off のとき、3 つの API は承認キーがあっても 401 LOGIN_REQUIRED で断る", async () => {
  const app = createApp(new MockAiClient(), { LOOP_APPROVER_KEY: "key-1" });
  const key = { "x-approver-key": "key-1" };
  for (const [method, path, body] of [
    ["GET", "/api/v1/teacher/members", undefined],
    ["POST", "/api/v1/teacher/members", { email: "a@school.example", role: "teacher" }],
    ["DELETE", "/api/v1/teacher/members/a%40school.example", undefined],
  ] as const) {
    const result = await send(app as unknown as Hono, method, path, key, body);
    assert.equal(result.status, 401, `${method} ${path}`);
    assert.equal(code(result), "LOGIN_REQUIRED");
  }
});

test("ログインが on でも、承認キーだけの人（Cookie が無い）は 3 つの API を使えない", async () => {
  const app = createApp(new MockAiClient(), { ...ENV, LOOP_APPROVER_KEY: "key-1" });
  const key = { "x-approver-key": "key-1" };
  for (const [method, path, body] of [
    ["GET", "/api/v1/teacher/members", undefined],
    ["POST", "/api/v1/teacher/members", { email: "a@school.example", role: "teacher" }],
    ["DELETE", "/api/v1/teacher/members/two%40school.example", undefined],
  ] as const) {
    const result = await send(app as unknown as Hono, method, path, key, body);
    assert.equal(result.status, 401, `${method} ${path}`);
    assert.equal(code(result), "LOGIN_REQUIRED");
  }
});

test("管理者でない先生は 403 で断られ、一覧は何も変わらない", async () => {
  const { app, settings } = build();
  const teacher = cookieFor("ms.one@school.example");
  const get = await send(app, "GET", "/api/v1/teacher/members", teacher);
  assert.equal(get.status, 403);
  assert.equal(code(get), "SCOPE_NOT_ALLOWED");
  const post = await send(app, "POST", "/api/v1/teacher/members", teacher, { email: "new@school.example", role: "admin" });
  assert.equal(post.status, 403);
  const del = await send(app, "DELETE", "/api/v1/teacher/members/boss%40school.example", teacher);
  assert.equal(del.status, 403);
  assert.deepEqual(settings.enabled && settings.members.list(), [
    { email: "boss@school.example", role: "admin" },
    { email: "ms.one@school.example", role: "teacher" },
    { email: "two@school.example", role: "teacher" },
  ]);
});

test("役割の印が無い古い Cookie と、改ざんした Cookie は、管理者として扱わない", async () => {
  const { app } = build();
  const legacy = { cookie: `${SESSION_COOKIE}=${signSession(SECRET, new Date())}` };
  // 印の無い Cookie は、先生としても通さない（#363 の 1）
  assert.equal((await send(app, "GET", "/api/v1/teacher/members", legacy)).status, 401);
  const forged = { cookie: `${SESSION_COOKIE}=${signSession("another-secret-another-secret-00", new Date(), subjectOf(SECRET, "boss@school.example"))}` };
  assert.equal((await send(app, "GET", "/api/v1/teacher/members", forged)).status, 401);
  // 一覧に無い人の印
  const stranger = cookieFor("stranger@school.example");
  assert.equal((await send(app, "GET", "/api/v1/teacher/members", stranger)).status, 401);
});

// ---- 管理者ができること ----

test("管理者は一覧を読める。メールの昇順で、self は自分のメール", async () => {
  const { app } = build();
  const result = await send(app, "GET", "/api/v1/teacher/members", cookieFor("boss@school.example"));
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, {
    members: [
      { email: "boss@school.example", role: "admin" },
      { email: "ms.one@school.example", role: "teacher" },
      { email: "two@school.example", role: "teacher" },
    ],
    self: "boss@school.example",
  });
});

test("管理者は先生を足す（201）。メールは小文字にそろえ、同じ人の役割を変えると 200", async () => {
  const { app } = build();
  const admin = cookieFor("boss@school.example");
  const added = await send(app, "POST", "/api/v1/teacher/members", admin, { email: "  New.Teacher@School.Example ", role: "teacher" });
  assert.equal(added.status, 201);
  assert.deepEqual(added.json, { member: { email: "new.teacher@school.example", role: "teacher" } });
  const changed = await send(app, "POST", "/api/v1/teacher/members", admin, { email: "NEW.teacher@school.example", role: "admin" });
  assert.equal(changed.status, 200);
  assert.deepEqual(changed.json, { member: { email: "new.teacher@school.example", role: "admin" } });
  const listed = await send(app, "GET", "/api/v1/teacher/members", admin);
  assert.equal(listed.json.members.filter((member: { email: string }) => member.email === "new.teacher@school.example").length, 1);
});

test("メールの形が違うもの、SCHOOL_DOMAIN の外、役割が違うものは 400 で断る", async () => {
  const { app } = build();
  const admin = cookieFor("boss@school.example");
  for (const email of ["", "no-at-sign", "a@b", "a b@school.example", "a@@school.example", `${"x".repeat(250)}@school.example`]) {
    const result = await send(app, "POST", "/api/v1/teacher/members", admin, { email, role: "teacher" });
    assert.equal(result.status, 400, email);
    assert.equal(code(result), "ADULT_INVALID_REQUEST");
    assert.equal(result.json.error.details[0].field, "email");
  }
  for (const email of ["a@gmail.com", "a@school.example.evil.test", "a@sub.school.example"]) {
    const result = await send(app, "POST", "/api/v1/teacher/members", admin, { email, role: "teacher" });
    assert.equal(result.status, 400, email);
    assert.equal(result.json.error.details[0].reason, "domain");
  }
  const badRole = await send(app, "POST", "/api/v1/teacher/members", admin, { email: "ok@school.example", role: "owner" });
  assert.equal(badRole.status, 400);
  assert.equal(badRole.json.error.details[0].field, "role");
  const notObject = await send(app, "POST", "/api/v1/teacher/members", admin, ["x"]);
  assert.equal(notObject.status, 400);
});

test("SCHOOL_DOMAIN が無ければ、どのドメインのメールも足せる", async () => {
  const { app } = build({ ...ENV, SCHOOL_DOMAIN: undefined });
  const result = await send(app, "POST", "/api/v1/teacher/members", cookieFor("boss@school.example"), { email: "x@gmail.com", role: "teacher" });
  assert.equal(result.status, 201);
});

test("管理者は先生を外せる。一覧に無い人は 404", async () => {
  const { app, settings } = build();
  const admin = cookieFor("boss@school.example");
  const removed = await send(app, "DELETE", "/api/v1/teacher/members/Two%40School.Example", admin);
  assert.equal(removed.status, 200);
  assert.deepEqual(removed.json, { email: "two@school.example" });
  assert.equal(settings.enabled && settings.members.get("two@school.example"), undefined);
  const again = await send(app, "DELETE", "/api/v1/teacher/members/two%40school.example", admin);
  assert.equal(again.status, 404);
  assert.equal(code(again), "MEMBER_NOT_FOUND");
});

test("最後の管理者は外せず、先生に変えることもできない。別の管理者がいれば外せる", async () => {
  const { app } = build({ ...ENV, ADMIN_EMAILS: "boss@school.example" });
  const admin = cookieFor("boss@school.example");
  const demote = await send(app, "POST", "/api/v1/teacher/members", admin, { email: "boss@school.example", role: "teacher" });
  assert.equal(demote.status, 409);
  assert.equal(code(demote), "LAST_ADMIN");

  // もう 1 人を管理者にすると、元の管理者を別の管理者が外せる
  await send(app, "POST", "/api/v1/teacher/members", admin, { email: "two@school.example", role: "admin" });
  const second = cookieFor("two@school.example");
  const removed = await send(app, "DELETE", "/api/v1/teacher/members/boss%40school.example", second);
  assert.equal(removed.status, 200);
  // 残った 1 人は、また最後の管理者
  const last = await send(app, "POST", "/api/v1/teacher/members", second, { email: "two@school.example", role: "teacher" });
  assert.equal(code(last), "LAST_ADMIN");
});

test("自分自身は、ほかに管理者がいても外せない", async () => {
  const { app } = build({ ...ENV, ADMIN_EMAILS: "boss@school.example,deputy@school.example" });
  const result = await send(app, "DELETE", "/api/v1/teacher/members/boss%40school.example", cookieFor("boss@school.example"));
  assert.equal(result.status, 409);
  assert.equal(code(result), "SELF_REMOVAL");
});

// ---- ログインの判定と me ----

test("設定：ADMIN_EMAILS は小文字にして管理者にし、同じメールが両方にあれば管理者。管理者だけでも起動できる", () => {
  const settings = readTeacherLogin({ ...ENV, ADMIN_EMAILS: " Boss@school.example ,two@school.example", TEACHER_EMAILS: "two@school.example,ms.one@school.example" } as NodeJS.ProcessEnv);
  assert.ok(settings.enabled);
  if (!settings.enabled) return;
  assert.deepEqual(settings.members.list(), [
    { email: "boss@school.example", role: "admin" },
    { email: "ms.one@school.example", role: "teacher" },
    { email: "two@school.example", role: "admin" },
  ]);
  const adminOnly = readTeacherLogin({ ...ENV, TEACHER_EMAILS: undefined } as NodeJS.ProcessEnv);
  assert.ok(adminOnly.enabled);
  assert.throws(() => readTeacherLogin({ ...ENV, ADMIN_EMAILS: undefined, TEACHER_EMAILS: " , " } as NodeJS.ProcessEnv), /ADMIN_EMAILS or TEACHER_EMAILS/);
});

test("ログインの判定は一覧で決まる。足した人は入れ、外した人は入れず、今の Cookie も使えなくなる", async () => {
  const { app, settings } = build(ENV, "new@school.example");
  assert.ok(settings.enabled);
  const login = async () => {
    const start = await app.request("/api/v1/teacher/login");
    const cookies = start.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ");
    const state = new URL(start.headers.get("location") ?? "").searchParams.get("state") ?? "";
    const callback = await app.request(`/api/v1/teacher/callback?code=c&state=${state}`, { headers: { cookie: cookies } });
    const session = callback.headers.getSetCookie().find((line) => line.startsWith(`${SESSION_COOKIE}=`));
    return { location: callback.headers.get("location") ?? "", session: session?.split(";")[0] };
  };

  assert.match((await login()).location, /login=failed/);

  const admin = cookieFor("boss@school.example");
  await send(app, "POST", "/api/v1/teacher/members", admin, { email: "new@school.example", role: "teacher" });
  const entered = await login();
  assert.equal(entered.location, "/teacher/");
  assert.ok(entered.session);
  const mine = { cookie: entered.session ?? "" };
  assert.deepEqual(((await send(app, "GET", "/api/v1/teacher/me", mine)).json as Record<string, unknown>).role, "teacher");

  await send(app, "DELETE", "/api/v1/teacher/members/new%40school.example", admin);
  assert.deepEqual((await send(app, "GET", "/api/v1/teacher/me", mine)).json, { enabled: true, signedIn: false, signup: "roster" });
  assert.match((await login()).location, /login=failed/);
});

test("me：管理者は role が admin、先生は teacher、ログインしていなければ role を付けない", async () => {
  const { app } = build();
  const role = async (headers?: Record<string, string>) => {
    const { role: value, signedIn } = (await send(app, "GET", "/api/v1/teacher/me", headers)).json as { role?: string; signedIn: boolean };
    return { role: value, signedIn };
  };
  assert.deepEqual(await role(cookieFor("boss@school.example")), { role: "admin", signedIn: true });
  assert.deepEqual(await role(cookieFor("two@school.example")), { role: "teacher", signedIn: true });
  assert.deepEqual((await send(app, "GET", "/api/v1/teacher/me")).json, { enabled: true, signedIn: false, signup: "roster" });
  // 印の無い古い Cookie は、先生としても通さない（#363 の 1）
  const legacy = { cookie: `${SESSION_COOKIE}=${signSession(SECRET, new Date())}` };
  assert.deepEqual(await role(legacy), { role: undefined, signedIn: false });
});

test("ログインが off のとき、me は今のまま（role を付けない）", async () => {
  const app = createApp(new MockAiClient(), {});
  assert.deepEqual((await send(app as unknown as Hono, "GET", "/api/v1/teacher/me")).json, { enabled: false, signedIn: false });
});

test("Cookie の中にメールは入れない", () => {
  const token = signSession(SECRET, new Date(), subjectOf(SECRET, "boss@school.example"));
  const body = Buffer.from(token.split(".")[0] ?? "", "base64url").toString("utf8");
  assert.equal(body.includes("boss"), false);
  assert.equal(body.includes("@"), false);
});

test("teacherSessionValid：一覧にいる人の Cookie は通り、ログイン off では通らない", async () => {
  const { settings } = build();
  const probe = (use: Parameters<typeof teacherSessionValid>[0]) => new Hono().get("/", (context) => context.json({ valid: teacherSessionValid(use, context) }));
  const headers = cookieFor("two@school.example");
  assert.deepEqual((await (await probe(settings).request("/", { headers })).json()), { valid: true });
  assert.deepEqual((await (await probe({ enabled: false }).request("/", { headers })).json()), { valid: false });
});

test("ストア：メモリのストアは、メールを小文字で持ち、最後の管理者を守る", async () => {
  const store = new MemoryTeacherMemberStore([{ email: "A@x.example", role: "admin" }]);
  assert.deepEqual(store.get("a@X.example"), { email: "a@x.example", role: "admin" });
  assert.equal(await store.remove("a@x.example"), "last-admin");
  assert.equal(await store.set("a@x.example", "teacher"), "last-admin");
  assert.equal(await store.set("b@x.example", "admin"), "added");
  assert.equal(await store.set("b@x.example", "admin"), "changed");
  assert.equal(await store.remove("a@x.example"), "removed");
  assert.equal(await store.remove("a@x.example"), "not-found");
  assert.equal(await store.set("b@x.example", "teacher"), "last-admin");
});
