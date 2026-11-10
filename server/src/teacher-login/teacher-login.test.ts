import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { Hono } from "hono";
import { SignJWT } from "jose";
import { readTeacherLogin } from "./config.ts";
import { authorizationUrl, challengeOf, verifyIdToken, type OidcConfig } from "./oidc.ts";
import { registerTeacherLoginRoutes, teacherSessionValid } from "./routes.ts";
import { SESSION_COOKIE, signSession, subjectOf, verifySession } from "./session.ts";

const SECRET = "0123456789abcdef0123456789abcdef";
const CONFIG: OidcConfig = { clientId: "client-1", clientSecret: "s3cret", redirectUri: "https://example.test/api/v1/teacher/callback" };
const ENV = {
  TEACHER_LOGIN: "on",
  GOOGLE_CLIENT_ID: "client-1",
  GOOGLE_CLIENT_SECRET: "s3cret",
  PUBLIC_BASE_URL: "https://example.test/",
  SESSION_SECRET: SECRET,
  TEACHER_EMAILS: " Ms.One@school.example , two@school.example ",
};

test("設定：TEACHER_LOGIN が on でなければ、ログインは無効（既定は今のまま）", () => {
  assert.deepEqual(readTeacherLogin({}), { enabled: false });
});

test("設定：足りないものは、名前だけを出して止める（値は出さない）", () => {
  assert.throws(() => readTeacherLogin({ ...ENV, GOOGLE_CLIENT_SECRET: "" }), /GOOGLE_CLIENT_SECRET/);
  assert.throws(() => readTeacherLogin({ ...ENV, SESSION_SECRET: "short" }), /at least 32/);
  assert.throws(() => readTeacherLogin({ ...ENV, PUBLIC_BASE_URL: "http://example.test" }), /must be https/);
});

test("設定：メールは小文字にし、空を除き、リダイレクトの場所を作る", () => {
  const settings = readTeacherLogin(ENV);
  assert.equal(settings.enabled, true);
  if (!settings.enabled) return;
  assert.deepEqual([...settings.allowed].sort(), ["ms.one@school.example", "two@school.example"]);
  assert.equal(settings.oidc?.redirectUri, "https://example.test/api/v1/teacher/callback");
  assert.equal(settings.secure, true);
  assert.equal(settings.home, "/teacher/");
});

test("セッション：署名した Cookie は、期限の前は通り、改ざんと期限切れは通らない", () => {
  const now = new Date("2026-11-09T01:00:00Z");
  const token = signSession(SECRET, now);
  assert.equal(verifySession(SECRET, token, now), true);
  assert.equal(verifySession("another-secret-another-secret-00", token, now), false);
  assert.equal(verifySession(SECRET, `${token}x`, now), false);
  assert.equal(verifySession(SECRET, token, new Date("2026-11-09T10:00:00Z")), false);
  assert.equal(verifySession(SECRET, undefined, now), false);
});

test("PKCE：RFC 7636 の例と同じ変換になる", () => {
  assert.equal(challengeOf("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("認可の URL：PKCE、nonce、state を付け、学校のドメインは hd で示す", () => {
  const url = new URL(authorizationUrl({ ...CONFIG, schoolDomain: "school.example" }, "st", "no", "ch"));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("nonce"), "no");
  assert.equal(url.searchParams.get("hd"), "school.example");
});

// 手元の鍵で ID トークンを作り、検査の各項目を確かめる（Google の鍵は使わない）
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
async function idToken(claims: Record<string, unknown>, audience = CONFIG.clientId, expiresIn = "5m"): Promise<string> {
  return new SignJWT({ email: "ms.one@school.example", email_verified: true, nonce: "no", hd: "school.example", ...claims })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer("https://accounts.google.com")
    .setAudience(audience)
    .setSubject("google-sub-1")
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}

test("ID トークン：正しいものは通り、宛先、nonce、メールの確認、ドメイン、期限の誤りは通らない", async () => {
  const ok = await verifyIdToken({ ...CONFIG, schoolDomain: "school.example" }, await idToken({}), "no", publicKey);
  assert.deepEqual(ok, { subject: "google-sub-1", email: "ms.one@school.example" });
  await assert.rejects(verifyIdToken(CONFIG, await idToken({}, "other-client"), "no", publicKey));
  await assert.rejects(verifyIdToken(CONFIG, await idToken({}), "different-nonce", publicKey), /nonce/);
  await assert.rejects(verifyIdToken(CONFIG, await idToken({ email_verified: false }), "no", publicKey), /not verified/);
  await assert.rejects(verifyIdToken({ ...CONFIG, schoolDomain: "school.example" }, await idToken({ hd: "gmail.example" }), "no", publicKey), /domain/);
  await assert.rejects(verifyIdToken(CONFIG, await idToken({}, CONFIG.clientId, "-1m"), "no", publicKey));
});

// 経路の試験：Google への通信は、手元の応答に替える
function appWith(overrides: { exchange?: () => Promise<string>; verify?: () => Promise<{ subject: string; email: string }> }) {
  const settings = readTeacherLogin(ENV);
  assert.equal(settings.enabled, true);
  const app = new Hono();
  if (settings.enabled) {
    registerTeacherLoginRoutes(app, settings, {
      exchange: overrides.exchange ?? (async () => "token"),
      verify: overrides.verify ?? (async () => ({ subject: "google-sub-1", email: "ms.one@school.example" })),
      now: () => new Date("2026-11-09T01:00:00Z"),
    });
  }
  return { app, settings };
}

function cookieOf(response: Response, name: string): string | undefined {
  const line = response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  return line?.split(";")[0]?.slice(name.length + 1);
}

const stateOf = (login: Response): string => new URL(login.headers.get("location") ?? "").searchParams.get("state") ?? "";

test("経路：login は Google へ送り、state の Cookie を付ける。me は未ログインを返す", async () => {
  const { app } = appWith({});
  const login = await app.request("/api/v1/teacher/login");
  assert.equal(login.status, 302);
  const location = new URL(login.headers.get("location") ?? "");
  assert.equal(location.host, "accounts.google.com");
  assert.ok(cookieOf(login, SESSION_COOKIE));
  assert.ok(location.searchParams.get("state"));
  const me = await app.request("/api/v1/teacher/me");
  assert.deepEqual(await me.json(), { enabled: true, signedIn: false, signup: "roster" });
});

test("経路：名簿の先生は、ログインすると先生の Cookie を受け、me が signedIn を返す", async () => {
  const { app } = appWith({});
  const login = await app.request("/api/v1/teacher/login");
  const state = stateOf(login);
  const callback = await app.request(`/api/v1/teacher/callback?code=c1&state=${state}`, {
    headers: { cookie: `${SESSION_COOKIE}=${cookieOf(login, SESSION_COOKIE)}` },
  });
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "/teacher/");
  const session = cookieOf(callback, SESSION_COOKIE);
  assert.ok(session);
  const me = await app.request("/api/v1/teacher/me", { headers: { cookie: `${SESSION_COOKIE}=${session}` } });
  const body = await me.json() as { enabled: boolean; signedIn: boolean; role: string; signup: string; workspace: { name: string; joinCode: string } };
  assert.deepEqual({ enabled: body.enabled, signedIn: body.signedIn, role: body.role, signup: body.signup }, { enabled: true, signedIn: true, role: "teacher", signup: "roster" }); // role は #351、signup と workspace は学級の API で足した
  assert.equal(body.workspace.name, "わたしの学級");
  assert.match(body.workspace.joinCode, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
});

test("経路：名簿に無いメールは、学校のアカウントでも入れない。state が違うときも入れない", async () => {
  const { app } = appWith({ verify: async () => ({ subject: "x", email: "stranger@school.example" }) });
  const login = await app.request("/api/v1/teacher/login");
  const state = stateOf(login);
  const cookies = `${SESSION_COOKIE}=${cookieOf(login, SESSION_COOKIE)}`;
  const denied = await app.request(`/api/v1/teacher/callback?code=c1&state=${state}`, { headers: { cookie: cookies } });
  assert.match(denied.headers.get("location") ?? "", /login=failed/);
  assert.equal(cookieOf(denied, SESSION_COOKIE), "");

  const mismatch = await app.request("/api/v1/teacher/callback?code=c1&state=other", { headers: { cookie: cookies } });
  assert.match(mismatch.headers.get("location") ?? "", /login=failed/);
});

test("経路：logout は先生の Cookie を消す。設定が無いときは先生として見ない", async () => {
  const { app } = appWith({});
  const logout = await app.request("/api/v1/teacher/logout", { method: "POST" });
  assert.equal(logout.status, 200);
  assert.equal(teacherSessionValid({ enabled: false }, { req: { header: () => undefined } } as never), false);
});

test("先生の読み出し：ログインが on のとき、先生としての読み出しは、ログインが無いと通らない", async () => {
  const { registerLoopRoutes } = await import("../loop/routes.ts");
  const app = new Hono();
  registerLoopRoutes(app, undefined, { authorize: () => false });
  const response = await app.request("/api/v1/stumbles/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role: "teacher", scope: "summary", purpose: "見る" }),
  });
  assert.equal(response.status, 401);
});
