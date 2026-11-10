import assert from "node:assert/strict";
import test from "node:test";
import { createApp as createApplication } from "../app.ts";
import { MockAiClient } from "../ai/mock-client.ts";
import type { AiClient } from "../ai/client.ts";
import type { PrintReadInput } from "../ai/client.ts";
import { LIMITS } from "../limits.ts";
import { SESSION_COOKIE, signSession, subjectOf } from "../teacher-login/session.ts";

function createApp(...args: Parameters<typeof createApplication>): ReturnType<typeof createApplication> {
  return createApplication(args[0], { LOOP_APPROVER_KEY: "test-key", ...args[1] }, args[2], args[3], args[4]);
}

function jpeg(width = 100, height = 100): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9]);
}

function blobPart(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

async function send(app: ReturnType<typeof createApp>, file?: Blob, headers?: Record<string, string>): Promise<Response> {
  const form = new FormData();
  if (file) form.append("image", file, "worksheet.jpg");
  return app.request("/api/v1/print/read", { method: "POST", body: form, headers: headers ?? { "x-approver-key": "test-key" } });
}

function withReadPrint(readPrint: NonNullable<AiClient["readPrint"]>): AiClient {
  return Object.assign(new MockAiClient(), { readPrint });
}

test("プリント読み取りは見本の問題を返し、処理時間をヘッダーに付ける", async () => {
  const response = await send(createApp(new MockAiClient()), new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("server-timing") ?? "", /print-read;dur=/);
  assert.deepEqual(await response.json(), {
    problems: [
      { templateId: "rika-lever", questionText: "左の 2 の めもりに 30g。右の 3 の めもりに 何g つるすと つり合う？", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } }, approved: true },
      { templateId: "rika-moon", questionText: "月の 形が 日によって かわって 見えるのは なぜ？", params: {}, approved: true },
      { templateId: "sansu-fraction-addsub", questionText: "1/2 + 1/3", params: { left: { num: 1, den: 2 }, op: "+", right: { num: 1, den: 3 } }, approved: true },
    ], unsupportedCount: 1, demandRecorded: true,
  });
});

test("見本の分数問題は読み取り後に需要へ記録する", async () => {
  const app = createApp(new MockAiClient(), { LOOP_APPROVER_KEY: "test-key" });
  const read = await send(app, new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
  assert.equal(read.status, 200);
  assert.equal((await read.json() as { demandRecorded: boolean }).demandRecorded, true);
  const response = await app.request("/api/v1/print/demand", { headers: { "x-approver-key": "test-key" } });
  assert.deepEqual(await response.json(), { items: [{ unitId: "sansu-6-01", unitName: "算数 6 年 分数の乗法及び除法", count: 1 }] });
});

test("先生のログイン Cookie でも需要を読める", async () => {
  const secret = "test-session-secret-with-more-than-32-characters";
  const app = createApp(new MockAiClient(), {
    TEACHER_LOGIN: "on",
    GOOGLE_CLIENT_ID: "test-client",
    GOOGLE_CLIENT_SECRET: "test-secret",
    PUBLIC_BASE_URL: "http://localhost:8080",
    SESSION_SECRET: secret,
    TEACHER_EMAILS: "teacher@example.test",
  });
  const session = signSession(secret, new Date(), subjectOf(secret, "teacher@example.test"));
  const response = await app.request("/api/v1/print/demand", { headers: { cookie: `${SESSION_COOKIE}=${session}` } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { items: [] });
});

test("型の無い問題を単元ごとに数え、需要はキーなしで401・キーありで多い順に返す", async () => {
  const app = createApp(withReadPrint(async () => ({ problems: [
    { templateId: "none", questionText: "分数", unit: "sansu-6-01" },
    { templateId: "none", questionText: "速さ", unit: "sansu-6-07" },
    { templateId: "none", questionText: "別の単元", unit: "unknown" },
    { templateId: "none", questionText: "分数", unit: "sansu-6-01" },
  ], unsupportedCount: 0 })), { LOOP_APPROVER_KEY: "test-key" });
  const read = await send(app, new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
  assert.equal(read.status, 422);
  assert.deepEqual(await read.json(), { error: { code: "PRINT_NOT_SUPPORTED", message: "この問題の せつめいは、まだ ありません", demandRecorded: true } });

  assert.equal((await app.request("/api/v1/print/demand")).status, 401);
  const response = await app.request("/api/v1/print/demand", { headers: { "x-approver-key": "test-key" } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { items: [
    { unitId: "sansu-6-01", unitName: "算数 6 年 分数の乗法及び除法", count: 2 },
    { unitId: "other", unitName: "その他", count: 1 },
    { unitId: "sansu-6-07", unitName: "算数 6 年 伴って変わる二つの数量", count: 1 },
  ] });
});

test("Firestore の読み書きに失敗すると保存 API は 503 を返し、プリント読み取りは続ける", async () => {
  const lines: string[] = [];
  const originalError = console.error;
  console.error = (...values: unknown[]) => { lines.push(values.join(" ")); };
  try {
    const fetcher: typeof fetch = async (input) => String(input).includes("metadata.google.internal")
      ? new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 })
      : new Response("失敗", { status: 503 });
    const environment = { PRINT_FIRESTORE_DATABASE: "(default)", GOOGLE_CLOUD_PROJECT: "demo-project", LOOP_APPROVER_KEY: "test-key" };
    const app = createApp(withReadPrint(async () => ({ problems: [{ templateId: "none", questionText: "分数", unit: "sansu-6-01" }], unsupportedCount: 0 })), environment, {}, undefined, { firestoreFetcher: fetcher });
    const listedHandouts = await app.request("/api/v1/print/handouts");
    assert.equal(listedHandouts.status, 503);
    const listedDemand = await app.request("/api/v1/print/demand", { headers: { "x-approver-key": "test-key" } });
    assert.equal(listedDemand.status, 503);
    const read = await send(app, new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
    assert.equal(read.status, 422);
    assert.deepEqual(await read.json(), { error: { code: "PRINT_NOT_SUPPORTED", message: "この問題の せつめいは、まだ ありません", demandRecorded: false } });
  } finally {
    console.error = originalError;
  }
  assert.ok(lines.length > 0);
  assert.ok(lines.every((line) => line === "print firestore failure count=1"));
});

test("一部に型の無い問題があれば、200に需要を数えたことを加える", async () => {
  const app = createApp(withReadPrint(async () => ({ problems: [
    { templateId: "rika-moon", questionText: "月の問題", params: {} },
    { templateId: "none", questionText: "分数", unit: "sansu-6-01" },
  ], unsupportedCount: 0 })));
  const response = await send(app, new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    problems: [{ templateId: "rika-moon", questionText: "月の問題", params: {}, approved: true }],
    unsupportedCount: 1,
    demandRecorded: true,
  });
});

test("ロック中のプリント読み取りは承認キーなしでは 401 を返す", async () => {
  const response = await send(createApplication(new MockAiClient()), new Blob([blobPart(jpeg())], { type: "image/jpeg" }), {});
  assert.equal(response.status, 401);
});

test("子ども撮影を設定で許可したときはプリント読み取りにキーが要らない", async () => {
  const response = await send(createApp(new MockAiClient(), { LOOP_APPROVER_KEY: "test-key", PRINT_CHILD_CAPTURE: "on" }), new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
  assert.equal(response.status, 200);
});

test("先生が説明を配り、子どもが読み、先生が取り下げられる", async () => {
  const app = createApp(new MockAiClient(), { LOOP_APPROVER_KEY: "test-key" });
  const headers = { "content-type": "application/json", "x-approver-key": "test-key" };
  const body = { templateId: "rika-lever", questionText: "てこのはたらき", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } };
  const denied = await app.request("/api/v1/print/handouts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(denied.status, 401);
  const invalid = await app.request("/api/v1/print/handouts", { method: "POST", headers, body: JSON.stringify({ ...body, params: {} }) });
  assert.equal(invalid.status, 400);
  const created = await app.request("/api/v1/print/handouts", { method: "POST", headers, body: JSON.stringify(body) });
  assert.equal(created.status, 201);
  const item = await created.json() as { id: string };
  const listed = await app.request("/api/v1/print/handouts");
  assert.equal(listed.status, 200);
  assert.equal((await listed.json() as { items: { id: string }[] }).items[0]?.id, item.id);
  const deleteDenied = await app.request(`/api/v1/print/handouts/${item.id}`, { method: "DELETE" });
  assert.equal(deleteDenied.status, 401);
  const deleted = await app.request(`/api/v1/print/handouts/${item.id}`, { method: "DELETE", headers: { "x-approver-key": "test-key" } });
  assert.equal(deleted.status, 204);
});

test("型の承認を一覧に返し、取り消しを共通監査へ記録して読み取りに反映する", async () => {
  const app = createApp(new MockAiClient(), { LOOP_APPROVER_KEY: "test-key" });
  const headers = { "content-type": "application/json", "x-approver-key": "test-key" };
  const templates = await app.request("/api/v1/print/templates");
  assert.equal(templates.status, 200);
  assert.deepEqual(await templates.json(), { items: [
    { id: "rika-lever", unit: "理科 6 年 てこのはたらき", approved: true },
    { id: "rika-moon", unit: "理科 6 年 月の見え方", approved: true },
    { id: "sansu-fraction-addsub", unit: "算数 5 年 分数のたし算・ひき算", approved: true },
  ] });

  const denied = await app.request("/api/v1/print/templates/rika-moon/decision", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: "revoked", reason: "内容を見直します" }) });
  assert.equal(denied.status, 401);
  const wrong = await app.request("/api/v1/print/templates/rika-moon/decision", { method: "POST", headers: { ...headers, "x-approver-key": "wrong" }, body: JSON.stringify({ decision: "revoked", reason: "内容を見直します" }) });
  assert.equal(wrong.status, 401);

  const revoked = await app.request("/api/v1/print/templates/rika-moon/decision", { method: "POST", headers, body: JSON.stringify({ decision: "revoked", reason: "内容を見直します" }) });
  assert.equal(revoked.status, 200);
  assert.deepEqual(await revoked.json(), { id: "rika-moon", approved: false });
  const updatedList = await app.request("/api/v1/print/templates");
  assert.equal((await updatedList.json() as { items: { id: string; approved: boolean }[] }).items.find((item) => item.id === "rika-moon")?.approved, false);

  const read = await send(app, new Blob([blobPart(jpeg())], { type: "image/jpeg" }), { "x-approver-key": "test-key" });
  assert.equal(read.status, 200);
  const body = await read.json() as { problems: { templateId: string; approved: boolean }[] };
  assert.equal(body.problems.find((item) => item.templateId === "rika-moon")?.approved, false);
  assert.equal(body.problems.find((item) => item.templateId === "rika-lever")?.approved, true);

  const audit = await app.request("/api/v1/audit-log?role=teacher", { headers: { "x-approver-key": "test-key" } });
  assert.equal(audit.status, 200);
  const items = (await audit.json() as { items: { action: string; targetId: string | null; detail: string | null; reason: string | null }[] }).items;
  assert.ok(items.some((item) => item.action === "revoke" && item.targetId === "rika-moon" && item.detail === "revoked" && item.reason === "内容を見直します"));

  const approved = await app.request("/api/v1/print/templates/rika-moon/decision", { method: "POST", headers, body: JSON.stringify({ decision: "approved", reason: "内容を確認しました" }) });
  assert.equal(approved.status, 200);
  assert.deepEqual(await approved.json(), { id: "rika-moon", approved: true });
});

test("プリント型の承認キーは前後の空白を除いて照合する", async () => {
  const app = createApp(new MockAiClient(), { LOOP_APPROVER_KEY: "  test-key\n" });
  const response = await app.request("/api/v1/print/templates/rika-moon/decision", {
    method: "POST", headers: { "content-type": "application/json", "x-approver-key": "test-key" },
    body: JSON.stringify({ decision: "approved", reason: "確認しました" }),
  });
  assert.equal(response.status, 200);
});

test("プリント読み取りは不正画像を拒否する", async () => {
  for (const [file, code] of [
    [undefined, "IMAGE_INVALID"],
    [new Blob([blobPart(new Uint8Array([1, 2, 3]))], { type: "image/jpeg" }), "IMAGE_INVALID"],
    [new Blob([blobPart(jpeg())], { type: "image/png" }), "IMAGE_INVALID"],
    [new Blob([blobPart(jpeg(1601, 10))], { type: "image/jpeg" }), "IMAGE_INVALID"],
    [new Blob([blobPart(new Uint8Array(2 * 1024 * 1024 + 1))], { type: "image/jpeg" }), "IMAGE_INVALID"],
  ] as const) {
    const response = await send(createApp(new MockAiClient()), file);
    assert.equal(response.status, 400);
    assert.equal((await response.json() as { error: { code: string } }).error.code, code);
  }
});

test("プリント経路の本文上限は2.5MB", async () => {
  const tooLarge = new Blob([blobPart(new Uint8Array(2_621_441))], { type: "image/jpeg" });
  const response = await send(createApp(new MockAiClient()), tooLarge);
  assert.equal(response.status, 413);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "PAYLOAD_TOO_LARGE");
  assert.match(response.headers.get("server-timing") ?? "", /print-read;dur=/);
});

test("検査失敗は理由付きで1回だけ作り直し、全件不対応・読めない場合は区別する", async () => {
  let calls = 0;
  let retryIssues: string[] | undefined;
  const client = withReadPrint(async (input, _signal) => {
    calls += 1;
    if (calls === 2) retryIssues = input.validationIssues;
    return calls === 1 ? { problems: [{ templateId: "rika-lever", questionText: "不正", params: {} }] } : { problems: [{ templateId: "rika-moon", questionText: "月の問題", params: {} }] };
  });
  const recovered = await send(createApp(client), new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
  assert.equal(recovered.status, 200);
  assert.equal(calls, 2);
  assert.ok(retryIssues?.length);

  const unsupported = await send(createApp(withReadPrint(async () => ({ problems: [{ templateId: "unknown", questionText: "問題", params: {} }] }))), new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
  assert.equal(unsupported.status, 422);
  assert.equal((await unsupported.json() as { error: { code: string } }).error.code, "PRINT_NOT_SUPPORTED");

  const unreadable = await send(createApp(withReadPrint(async () => ({ unreadable: true, problems: [] }))), new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
  assert.equal(unreadable.status, 422);
  assert.equal((await unreadable.json() as { error: { code: string } }).error.code, "PRINT_UNREADABLE");
});

test("プリントの失敗ログに写真・文・paramsを出さない", async () => {
  const lines: string[] = [];
  const original = console.info;
  const originalError = console.error;
  console.info = (...values: unknown[]) => { lines.push(values.join(" ")); };
  console.error = (...values: unknown[]) => { lines.push(values.join(" ")); };
  try {
    const client = withReadPrint(async (_input: PrintReadInput) => { throw new Error("secret questionText params photo"); });
    await send(createApp(client), new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
  } finally {
    console.info = original;
    console.error = originalError;
  }
  assert.ok(lines.length);
  assert.equal(lines.join(" ").includes("secret"), false);
  assert.equal(lines.join(" ").includes("questionText"), false);
  assert.equal(lines.join(" ").includes("params"), false);
});

test("AI の返答が15秒を超えると TIMEOUT になり、中断信号を送る", async () => {
  let aborted = false;
  const client = withReadPrint((_input, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => { aborted = true; reject(new Error("cancelled")); }, { once: true });
  }));
  const response = await send(createApp(client, {}, { timeoutMilliseconds: 5 }), new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
  assert.equal(response.status, 504);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "TIMEOUT");
  assert.equal(aborted, true);
});

test("プリント読み取りは接続元ごとに1分の上限まで", async () => {
  const app = createApp(new MockAiClient());
  const file = new Blob([blobPart(jpeg())], { type: "image/jpeg" });
  // 回数は limits.ts から取る。数字を試験に写すと、上限を変えたときに試験だけが古くなる
  for (let count = 0; count < LIMITS.printRequestsPerMinute; count += 1) assert.equal((await send(app, file)).status, 200);
  const limited = await send(app, file);
  assert.equal(limited.status, 429);
  const { error } = await limited.json() as { error: { code: string; scope?: string; retryAfterSeconds?: number } };
  assert.equal(error.code, "RATE_LIMITED");
  // 1 日の上限と分け、待つ秒数を返す（#532）
  assert.equal(error.scope, "minute");
  assert.ok(Number.isInteger(error.retryAfterSeconds) && error.retryAfterSeconds! >= 1 && error.retryAfterSeconds! <= 60);
});

test("通常のAPI本文上限は8KBのまま", async () => {
  const response = await createApp(new MockAiClient()).request("/api/v1/parts", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expression: "x".repeat(9000) }),
  });
  assert.equal(response.status, 413);
});

test("型が無い問題や読めない写真は正しい答えなので、AI を作り直しに呼ばない", async () => {
  for (const reply of [
    { problems: [{ templateId: "rika-moon", questionText: "月の問題", params: {} }], unsupportedCount: 2 },
    { problems: [], unsupportedCount: 3 },
    { problems: [], unsupportedCount: 0, unreadable: true },
  ]) {
    let calls = 0;
    const client = withReadPrint(async () => { calls += 1; return reply; });
    await send(createApp(client), new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
    assert.equal(calls, 1);
  }
});

test("作り直しで説明できる問題が減ったら、前の結果を返す", async () => {
  let calls = 0;
  const lever = { templateId: "rika-lever", questionText: "てこ", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } };
  const client = withReadPrint(async () => {
    calls += 1;
    return calls === 1 ? { problems: [lever, { ...lever, params: {} }], unsupportedCount: 0 } : { problems: [], unsupportedCount: 2 };
  });
  const response = await send(createApp(client), new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
  assert.equal(calls, 2);
  assert.equal(response.status, 200);
  const body = await response.json() as { problems: unknown[]; unsupportedCount: number };
  assert.equal(body.problems.length, 1);
  assert.equal(body.unsupportedCount, 1);
});

test("AI の一時的な失敗は 1 回だけ呼び直す", async () => {
  let calls = 0;
  const client = withReadPrint(async () => {
    calls += 1;
    if (calls === 1) throw new Error("temporary");
    return { problems: [{ templateId: "rika-moon", questionText: "月の問題", params: {} }], unsupportedCount: 0 };
  });
  const response = await send(createApp(client), new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test("1 本目が遅いときは、もう 1 本出して早く返った方を使う", async () => {
  let calls = 0;
  const aborted: boolean[] = [];
  const client = withReadPrint((_input, signal) => {
    calls += 1;
    const index = calls;
    signal.addEventListener("abort", () => { aborted[index] = true; }, { once: true });
    const reply = { problems: [{ templateId: "rika-moon", questionText: "月の問題", params: {} }], unsupportedCount: 0 };
    // 1 本目は返らない。2 本目はすぐ返る
    return index === 1 ? new Promise(() => {}) : Promise.resolve(reply);
  });
  const started = Date.now();
  const response = await send(createApp(client, {}, { timeoutMilliseconds: 3_000, printHedgeAfterMilliseconds: 50 }), new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.ok(Date.now() - started < 1_000);
  assert.equal(aborted[1], true);
});

test("1 本目がすぐ返るときは、2 本目を出さない", async () => {
  let calls = 0;
  const client = withReadPrint(async () => { calls += 1; return { problems: [{ templateId: "rika-moon", questionText: "月の問題", params: {} }], unsupportedCount: 0 }; });
  await send(createApp(client, {}, { timeoutMilliseconds: 3_000, printHedgeAfterMilliseconds: 50 }), new Blob([blobPart(jpeg())], { type: "image/jpeg" }));
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(calls, 1);
});
