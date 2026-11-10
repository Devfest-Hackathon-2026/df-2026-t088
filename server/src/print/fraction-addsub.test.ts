// 型「分数のたし算・ひき算」（#477）の試験。決まりの正本は docs/product/education-api-contract.md「プリントの型「分数のたし算・ひき算」」
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../app.ts";
import { MockAiClient } from "../ai/mock-client.ts";
import type { AiClient } from "../ai/client.ts";
import { toPrintOutput } from "../ai/gemini-client.ts";
import { createLoopStore } from "../loop/store.ts";
import { SESSION_COOKIE } from "../teacher-login/session.ts";
import { validatePrintOutput } from "./validate.ts";

const frac = (num: number, den: number) => ({ num, den });
const problem = (left: { num: number; den: number }, op: string, right: { num: number; den: number }, questionText = `${left.num}/${left.den} ${op} ${right.num}/${right.den}`, extra: Record<string, unknown> = {}) =>
  ({ templateId: "sansu-fraction-addsub", questionText, params: { left, op, right, ...extra } });
const check = (entry: unknown) => validatePrintOutput({ problems: [entry], unsupportedCount: 0 });

test("(a) 範囲の中のたし算・ひき算は検算を通る", () => {
  for (const entry of [problem(frac(1, 2), "+", frac(1, 3)), problem(frac(3, 4), "-", frac(1, 6)), problem(frac(5, 3), "+", frac(4, 3)), problem(frac(11, 8), "-", frac(1, 3)), problem(frac(2, 12), "+", frac(1, 8))]) {
    const result = check(entry);
    assert.equal(result.problems.length, 1, entry.questionText);
    assert.equal(result.unsupportedCount, 0);
    assert.equal(result.problems[0]?.templateId, "sansu-fraction-addsub");
  }
});

test("(b) 契約の表の 1 行ごとに、範囲の外が落ちる", () => {
  const rejected: [string, unknown][] = [
    ["分母 1", problem(frac(1, 1), "+", frac(1, 2))],
    ["分母 13", problem(frac(1, 13), "+", frac(1, 2))],
    ["分子 0", problem(frac(0, 2), "+", frac(1, 3))],
    ["分子が分母の 2 倍より大きい", problem(frac(5, 2), "-", frac(1, 3))],
    ["分数でない値", problem(frac(1.5, 2), "+", frac(1, 3))],
    ["最小公倍数 25 以上", problem(frac(1, 5), "+", frac(1, 7))],
    ["たし算の答えが 3 より大きい", problem(frac(11, 6), "+", frac(8, 6))],
    ["ひき算で左が右と等しい", problem(frac(1, 2), "-", frac(2, 4))],
    ["ひき算で左が右より小さい", problem(frac(1, 6), "-", frac(1, 3))],
    ["記号が + - 以外", problem(frac(1, 2), "*", frac(1, 3), "1/2 * 1/3")],
    ["params に余計な項目", problem(frac(1, 2), "+", frac(1, 3), "1/2 + 1/3", { answer: 1 })],
    ["分数に余計な項目", problem({ num: 1, den: 2, extra: 1 } as never, "+", frac(1, 3))],
    ["questionText が式と食い違う", problem(frac(1, 2), "+", frac(1, 3), "1/2 + 1/4")],
    ["questionText が式でない", problem(frac(1, 2), "+", frac(1, 3), "1/2 たす 1/3")],
    ["questionText の記号が食い違う", problem(frac(3, 4), "-", frac(1, 6), "3/4 + 1/6")],
    ["questionText が約分した形", problem(frac(2, 4), "+", frac(1, 3), "1/2 + 1/3")],
  ];
  for (const [name, entry] of rejected) {
    const result = check(entry);
    assert.equal(result.problems.length, 0, name);
    assert.equal(result.unsupportedCount, 1, name);
  }
  // たし算の答えがちょうど 3 は通る
  assert.equal(check(problem(frac(3, 2), "+", frac(3, 2))).problems.length, 1);
});

test("(c) Gemini の平らな応答から分数の問題を組み立て、questionText は数から作る", () => {
  const output = toPrintOutput({ problems: [
    { templateId: "sansu-fraction-addsub", questionText: "ひとつめの問題（Gemini が書いた文）", fractionLeftNum: 3, fractionLeftDen: 4, fractionOp: "-", fractionRightNum: 1, fractionRightDen: 6 },
  ], unsupportedCount: 0 });
  assert.deepEqual(output, { problems: [problem(frac(3, 4), "-", frac(1, 6))], unsupportedCount: 0 });
  const checked = validatePrintOutput(output);
  assert.equal(checked.problems.length, 1);
  assert.equal(checked.problems[0]?.questionText, "3/4 - 1/6");
  // 数が欠けていれば検査で落ちる（作り直しの理由が付く）
  const missing = validatePrintOutput(toPrintOutput({ problems: [{ templateId: "sansu-fraction-addsub", questionText: "1/2 + 1/3", fractionLeftNum: 1 }], unsupportedCount: 0 }));
  assert.equal(missing.problems.length, 0);
  assert.ok(missing.issues.length > 0);
});

test("(d) 範囲の外の分数は none になり、sansu-5-fraction の需要に数えられる", () => {
  const output = toPrintOutput({ problems: [{ templateId: "none", questionText: "1 1/2 + 1/3", unit: "sansu-5-fraction" }], unsupportedCount: 0 });
  const checked = validatePrintOutput(output);
  assert.equal(checked.problems.length, 0);
  assert.equal(checked.unsupportedCount, 1);
  assert.deepEqual(checked.unsupportedUnits, ["sansu-5-fraction"]);
});

test("(d) 読み取りの応答でも、範囲の外は「対応していません」で需要に残る", async () => {
  const client = Object.assign(new MockAiClient(), { readPrint: async () => ({ problems: [{ templateId: "none", questionText: "1/2 × 1/3", unit: "sansu-5-fraction" }], unsupportedCount: 0 }) }) as AiClient;
  const app = createApp(client, { LOOP_APPROVER_KEY: "test-key" });
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0, 100, 0, 100, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9]);
  const form = new FormData();
  form.append("image", new Blob([Uint8Array.from(bytes).buffer], { type: "image/jpeg" }), "worksheet.jpg");
  const read = await app.request("/api/v1/print/read", { method: "POST", body: form, headers: { "x-approver-key": "test-key" } });
  assert.equal(read.status, 422);
  const demand = await app.request("/api/v1/print/demand", { headers: { "x-approver-key": "test-key" } });
  assert.deepEqual(await demand.json(), { items: [{ unitId: "sansu-5-fraction", unitName: "算数 5 年 分数の計算（まだ対応していない形）", count: 1 }] });
});

const ORIGIN = "https://example.test";
const ENV = { TEACHER_LOGIN: "on", GOOGLE_CLIENT_ID: "client-1", GOOGLE_CLIENT_SECRET: "s3cret", PUBLIC_BASE_URL: `${ORIGIN}/`, SESSION_SECRET: "0123456789abcdef0123456789abcdef", LOOP_APPROVER_KEY: "test-key", TEACHER_SIGNUP: "open" };
const JSON_HEADERS = { "content-type": "application/json" };
const FRACTION_HANDOUT = problem(frac(1, 2), "+", frac(1, 3));
type Json = Record<string, any>;

function build() {
  const app = createApp(new MockAiClient(), ENV as NodeJS.ProcessEnv, { requestsPerMinute: 100_000, submissionRequestsPerMinute: 100_000 }, createLoopStore(), {
    teacherLoginDeps: { exchange: async () => "token", verify: async () => ({ subject: "google-sub", email: "a@example.test" }) },
  });
  const signIn = async (): Promise<Record<string, string>> => {
    const login = await app.request("/api/v1/teacher/login");
    const state = new URL(login.headers.get("location") ?? "").searchParams.get("state") ?? "";
    const pending = cookieValue(login);
    const callback = await app.request(`/api/v1/teacher/callback?code=c&state=${state}`, { headers: { cookie: `${SESSION_COOKIE}=${pending}` } });
    return { cookie: `${SESSION_COOKIE}=${cookieValue(callback)}`, origin: ORIGIN };
  };
  return { app, signIn };
}

function cookieValue(response: Response): string | undefined {
  const line = response.headers.getSetCookie().find((value) => value.startsWith(`${SESSION_COOKIE}=`));
  return line?.split(";")[0]?.slice(SESSION_COOKIE.length + 1);
}

type App = ReturnType<typeof build>["app"];
const post = (app: App, path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, { method: "POST", headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify(body) });

test("(e) 分数の説明を配ると、一覧・1 件・学級コードで読める。範囲の外は配れない", async () => {
  const { app, signIn } = build();
  const teacher = await signIn();
  const created = await post(app, "/api/v1/print/handouts", FRACTION_HANDOUT, teacher);
  assert.equal(created.status, 201);
  const item = await created.json() as Json;
  assert.equal(item.templateId, "sansu-fraction-addsub");
  assert.deepEqual(item.params, FRACTION_HANDOUT.params);
  const listed = await (await app.request("/api/v1/print/handouts", { headers: teacher })).json() as { items: Json[] };
  assert.deepEqual(listed.items.map((entry) => entry.id), [item.id]);
  const one = await app.request(`/api/v1/print/handouts/${item.id}`);
  assert.equal(((await one.json()) as Json).questionText, "1/2 + 1/3");
  const me = await (await app.request("/api/v1/teacher/me", { headers: teacher })).json() as Json;
  const joined = await (await app.request(`/api/v1/join/${me.workspace.joinCode}`)).json() as Json;
  assert.deepEqual(joined.items.map((entry: Json) => entry.id), [item.id]);
  const outside = await post(app, "/api/v1/print/handouts", problem(frac(1, 5), "+", frac(1, 7)), teacher);
  assert.equal(outside.status, 400);
});

test("(f) 学びの輪に分数の間違いを handoutId つきで送れて、学級の一覧と承認ヒントに出る", async () => {
  const { app, signIn } = build();
  const teacher = await signIn();
  const handoutId = ((await (await post(app, "/api/v1/print/handouts", FRACTION_HANDOUT, teacher)).json()) as Json).id as string;
  const base = { chapterId: "print-sansu-fraction-addsub", lessonKey: "print:sansu-fraction-addsub", problem: "1/2 + 1/3", source: "demo", occurredAt: "2026-11-08T10:00:00+09:00", handoutId };
  for (const pattern of ["sum-both", "sum-num-only", "same-den-sum", "unclassified"]) {
    for (let count = 0; count < 5; count += 1) {
      assert.equal((await post(app, "/api/v1/stumbles", { ...base, pattern, hintsShown: 1 })).status, 201, pattern);
    }
  }
  for (const pattern of ["sum-both", "sum-num-only", "same-den-sum"]) {
    assert.equal((await post(app, "/api/v1/after-hints", { ...base, pattern, hintVersion: "base", next: "correct" })).status, 201, pattern);
  }
  const summary = await (await post(app, "/api/v1/stumbles/query", { role: "teacher", scope: "summary", purpose: "見る" }, teacher)).json() as { items: Json[] };
  assert.equal(summary.items.length, 1);
  assert.equal(summary.items[0]?.lessonKey, "print:sansu-fraction-addsub");
  assert.equal(summary.items[0]?.count, 20);
  // 直し方の案は、今ある分数の表のヒントで作れる
  const assistant = await (await app.request("/api/v1/loop/assistant", { headers: teacher })).json() as { items: Json[] };
  const target = assistant.items.find((entry) => entry.pattern === "sum-both");
  assert.ok(target?.suggestion?.id);
  const decided = await post(app, `/api/v1/suggestions/${target!.suggestion.id}/decision`, { role: "teacher", decision: "approved", reason: "確認" }, teacher);
  assert.equal(decided.status, 200);
  const hints = await (await app.request(`/api/v1/approved-hints?lessonKey=print:sansu-fraction-addsub&problem=${encodeURIComponent("1/2 + 1/3")}&pattern=sum-both&handoutId=${handoutId}`)).json() as { items: Json[] };
  assert.equal(hints.items.length, 1);
});
