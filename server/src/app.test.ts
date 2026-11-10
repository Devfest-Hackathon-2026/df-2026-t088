import test from "node:test";
import assert from "node:assert/strict";
import { createApp, selectChildAiClient } from "./app.ts";
import type { AiClient } from "./ai/client.ts";
import { createPartsData, MockAiClient } from "./ai/mock-client.ts";
import { parseExpression } from "./check/expression.ts";
import { isSameFractionPair } from "./request-check.ts";
import type { PartsData } from "./check/parts-check.ts";
import type { ReflectionInput } from "./api-types.ts";

const success = new MockAiClient();

test("子ども向け経路の AI は Gemini の設定に関係なく見本を使う", async () => {
  for (const environment of [
    {},
    { GEMINI_MODE: "developer", GEMINI_API_KEY: "test-api-key", GEMINI_MODEL: "model-x" },
    { GEMINI_MODE: "vertex", GOOGLE_CLOUD_PROJECT: "project-x", GOOGLE_CLOUD_LOCATION: "asia-east1", GEMINI_MODEL: "model-x" },
  ]) {
    const client = selectChildAiClient(environment);
    assert.ok(client instanceof MockAiClient);
    assert.equal((await client.createParts("1/2 + 1/3", new AbortController().signal)).problem, "1/2 + 1/3");
  }
});

test("Gemini が設定された公開構成でも子ども向け3経路は見本で応答する", async () => {
  const app = createApp(undefined, {
    GEMINI_MODE: "vertex",
    GOOGLE_CLOUD_PROJECT: "project-x",
    GOOGLE_CLOUD_LOCATION: "asia-east1",
    GEMINI_MODEL: "model-x",
  });
  const requests = [
    ["/api/v1/parts", { expression: "1/2 + 1/3" }],
    ["/api/v1/similar-problem", { problem: "1/2 + 1/3" }],
    ["/api/v1/reflection", { problem: "1/2 + 1/3", status: "solved", message: "分かった", history: [] }],
  ] as const;
  for (const [path, body] of requests) assert.equal((await post(app, path, body)).status, 200);
});

async function post(app: ReturnType<typeof createApp>, path: string, body: unknown): Promise<Response> {
  return app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

test("parts returns checked contract data and rejects empty, malformed, and long expressions", async () => {
  const app = createApp(success);
  const response = await post(app, "/api/v1/parts", { expression: "1/2 + 1/3" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    problem: "1/2 + 1/3", tool: "fraction_tiles",
    pieces: [{ num: 1, den: 2, count: 1 }, { num: 1, den: 3, count: 1 }, { num: 1, den: 6, count: 5 }],
    answer: { num: 5, den: 6 }, hints: ["1/6 を 1/2 に当ててみよう", "1/6 を 1/3 にも当ててみよう"],
  });
  for (const body of [{ expression: "" }, { expression: 42 }, [], "x"]) {
    const invalid = await post(app, "/api/v1/parts", body);
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json() as { error: { code: string } }).error.code, "INVALID_REQUEST");
  }
  const long = await post(app, "/api/v1/parts", { expression: "1/2 + 1/3".padEnd(41, " ") });
  assert.equal(long.status, 400);
  assert.equal((await long.json() as { error: { code: string } }).error.code, "TOO_LONG");
});

test("returns unreduced answers in reduced form for parts and similar problems", async () => {
  const partsClient = clientWith({ createParts: async (problem) => {
    const data = createPartsData(problem);
    data.answer = { num: 3, den: 6 };
    return data;
  } });
  const parts = await post(createApp(partsClient), "/api/v1/parts", { expression: "1/6 + 1/3" });
  assert.deepEqual((await parts.json() as PartsData).answer, { num: 1, den: 2 });

  const similarClient = clientWith({ createSimilarProblem: async () => {
    const data = createPartsData("1/4 + 1/4");
    data.answer = { num: 3, den: 6 };
    return data;
  } });
  const similar = await post(createApp(similarClient), "/api/v1/similar-problem", { problem: "1/2 + 1/3" });
  assert.deepEqual((await similar.json() as PartsData).answer, { num: 1, den: 2 });
});

test("negative subtraction requests are rejected before calling AI", async () => {
  let calls = 0;
  const client = clientWith({
    createParts: async () => { calls += 1; return undefined; },
    createSimilarProblem: async () => { calls += 1; return undefined; },
  });
  for (const [path, body] of [
    ["/api/v1/parts", { expression: "1/3 - 1/2" }],
    ["/api/v1/similar-problem", { problem: "1/3 - 1/2" }],
  ] as const) {
    const response = await post(createApp(client), path, body);
    assert.equal(response.status, 400);
    assert.equal((await response.json() as { error: { code: string } }).error.code, "INVALID_REQUEST");
  }
  assert.equal(calls, 0);
});

test("parts retries one failed check, then returns the good response", async () => {
  let calls = 0;
  const client = clientWith({ createParts: async (problem) => {
    calls += 1;
    if (calls === 1) return brokenParts(problem);
    return createPartsData(problem);
  } });
  const response = await post(createApp(client), "/api/v1/parts", { expression: "1/2 + 1/3" });
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test("parts retries share one timeout budget instead of using it in full each time", async () => {
  let calls = 0;
  const slowThenBroken = clientWith({ createParts: async (problem, signal) => {
    calls += 1;
    if (calls === 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return brokenParts(problem);
    }
    return new Promise<PartsData>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
    });
  } });
  const started = Date.now();
  const response = await post(createApp(slowThenBroken, process.env, { timeoutMilliseconds: 400 }), "/api/v1/parts", { expression: "1/2 + 1/3" });
  const elapsed = Date.now() - started;
  assert.equal(response.status, 504);
  assert.ok(calls <= 2);
  // 直す前は 300＋400＝700ms ほどかかる。直した後は 400ms ほどで切れる
  assert.ok(elapsed < 550, `全体が timeoutMilliseconds（400ms）を大きく超えた: ${elapsed}ms`);
});

test("parts retries when the checked data belongs to a different expression", async () => {
  let calls = 0;
  const wrongExpression = clientWith({ createParts: async () => {
    calls += 1;
    return createPartsData("1/3 + 1/4");
  } });
  const response = await post(createApp(wrongExpression), "/api/v1/parts", { expression: "1/2 + 1/3" });
  assert.equal(response.status, 422);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "PARTS_NOT_READY");
  assert.equal(calls, 2);

  let retryCalls = 0;
  const originalText = " 1/2 + 1/3 ";
  const corrected = clientWith({ createParts: async (expression) => {
    retryCalls += 1;
    return createPartsData(retryCalls === 1 ? "1/3 + 1/4" : expression);
  } });
  const retried = await post(createApp(corrected), "/api/v1/parts", { expression: originalText });
  assert.equal(retried.status, 200);
  assert.equal((await retried.json() as PartsData).problem, originalText);
  assert.equal(retryCalls, 2);
});

test("malformed model JSON is retried and becomes parts-not-ready", async () => {
  for (const invalidJson of ["", "{broken json"]) {
    let calls = 0;
    const malformed = clientWith({ createParts: async () => { calls += 1; return invalidJson; } });
    const response = await post(createApp(malformed), "/api/v1/parts", { expression: "1/2 + 1/3" });
    assert.equal(response.status, 422);
    assert.equal((await response.json() as { error: { code: string } }).error.code, "PARTS_NOT_READY");
    assert.equal(calls, 2);
  }
});

test("parts stops after one retry and maps AI failures and timeouts", async () => {
  let calls = 0;
  const invalidClient = clientWith({ createParts: async (problem) => { calls += 1; return brokenParts(problem); } });
  const invalid = await post(createApp(invalidClient), "/api/v1/parts", { expression: "1/2 + 1/3" });
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json() as { error: { code: string } }).error.code, "PARTS_NOT_READY");
  assert.equal(calls, 2);

  const unavailable = await post(createApp(clientWith({ createParts: async () => { throw new Error("private input not logged"); } })), "/api/v1/parts", { expression: "1/2 + 1/3" });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { error: {
    code: "AI_UNAVAILABLE", message: "いまは、うまく作れないみたい。少し待ってからもういちど押してね",
  } });

  let aborted = false;
  const slow = clientWith({ createParts: (_problem, signal) => new Promise<PartsData>((_resolve, reject) => {
    signal.addEventListener("abort", () => { aborted = true; reject(new Error("cancelled")); }, { once: true });
  }) });
  const timedOut = await post(createApp(slow, process.env, { timeoutMilliseconds: 10 }), "/api/v1/parts", { expression: "1/2 + 1/3" });
  assert.equal(timedOut.status, 504);
  assert.equal((await timedOut.json() as { error: { code: string } }).error.code, "TIMEOUT");
  assert.equal(aborted, true);
});

test("similar problem uses the same checked data contract", async () => {
  const response = await post(createApp(success), "/api/v1/similar-problem", { problem: "1/2 + 1/3" });
  assert.equal(response.status, 200);
  const data = await response.json() as PartsData;
  assert.equal(data.problem, "1/3 + 1/4");
  assert.equal(data.tool, "fraction_tiles");
  assert.deepEqual(data.answer, { num: 7, den: 12 });
  const subtraction = await success.createSimilarProblem("4/7 - 2/5", new AbortController().signal);
  assert.equal(subtraction.problem, "3/4 - 1/6");
  assert.deepEqual(subtraction.answer, { num: 7, den: 12 });
});

test("similar problem retries results with a different operator or the same fraction pair", async () => {
  for (const invalidProblem of ["1/3 - 1/4", "1/3 + 1/2"]) {
    let calls = 0;
    const client = clientWith({ createSimilarProblem: async () => {
      calls += 1;
      return createPartsData(invalidProblem);
    } });
    const response = await post(createApp(client), "/api/v1/similar-problem", { problem: "1/2 + 1/3" });
    assert.equal(response.status, 422);
    assert.equal(calls, 2);
  }
});

test("parts and similar-problem remove fields outside the public contract", async () => {
  const responseData = (problem: string): PartsData => {
    const data = createPartsData(problem);
    Object.assign(data, { debug: "private" });
    Object.assign(data.pieces[0]!, { debug: "private" });
    Object.assign(data.answer, { debug: "private" });
    return data;
  };
  const client = clientWith({
    createParts: async (problem) => responseData(problem),
    createSimilarProblem: async () => responseData("1/3 + 1/4"),
  });
  for (const [path, body] of [
    ["/api/v1/parts", { expression: "1/2 + 1/3" }],
    ["/api/v1/similar-problem", { problem: "1/2 + 1/3" }],
  ] as const) {
    const response = await post(createApp(client), path, body);
    const data = await response.json() as PartsData;
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(data).sort(), ["answer", "hints", "pieces", "problem", "tool"]);
    assert.deepEqual(Object.keys(data.pieces[0]!).sort(), ["count", "den", "num"]);
    assert.deepEqual(Object.keys(data.answer).sort(), ["den", "num"]);
  }
});

test("reflection validates solved status and explanation length", async () => {
  const input: ReflectionInput = { problem: "1/2 + 1/3", status: "solved", message: "5/6 になった", history: [] };
  const successResponse = await post(createApp(success), "/api/v1/reflection", input);
  assert.equal(successResponse.status, 200);
  assert.equal(typeof (await successResponse.json() as { question: unknown }).question, "string");
  const notSolved = await post(createApp(success), "/api/v1/reflection", { ...input, status: "working" });
  assert.equal(notSolved.status, 409);
  assert.equal((await notSolved.json() as { error: { code: string } }).error.code, "NOT_SOLVED");
  const long = await post(createApp(success), "/api/v1/reflection", { ...input, message: "x".repeat(201) });
  assert.equal(long.status, 400);
  assert.equal((await long.json() as { error: { code: string } }).error.code, "TOO_LONG");
  const empty = await post(createApp(success), "/api/v1/reflection", { ...input, message: "  " });
  assert.equal(empty.status, 400);
  assert.equal((await empty.json() as { error: { code: string } }).error.code, "INVALID_REQUEST");
  const longHistory = await post(createApp(success), "/api/v1/reflection", {
    ...input, history: [{ role: "ai", text: "x".repeat(201) }],
  });
  assert.equal(longHistory.status, 400);
  assert.equal((await longHistory.json() as { error: { code: string } }).error.code, "TOO_LONG");
});

test("reflection validates only the latest four messages from a long history", async () => {
  let received: ReflectionInput | undefined;
  const client = clientWith({ createReflection: async (input) => {
    received = input;
    return "次はどう考える？";
  } });
  const history = Array.from({ length: 100 }, (_, index) => ({
    role: index === 0 ? "invalid" : index % 2 === 0 ? "ai" : "child",
    text: String(index),
  }));
  const response = await post(createApp(client), "/api/v1/reflection", {
    problem: "1/2 + 1/3", status: "solved", message: "分かった", history,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(received?.history.map((item) => item.text), ["96", "97", "98", "99"]);
});

test("zero numerators and huge numbers are rejected before calling AI at all three entrances", async () => {
  let calls = 0;
  const client = clientWith({
    createParts: async () => { calls += 1; return undefined; },
    createSimilarProblem: async () => { calls += 1; return undefined; },
    createReflection: async () => { calls += 1; return "?"; },
  });
  const bodies = (problem: string) => [
    ["/api/v1/parts", { expression: problem }],
    ["/api/v1/similar-problem", { problem }],
    ["/api/v1/reflection", { problem, status: "solved", message: "分かった", history: [] }],
  ] as const;
  for (const problem of ["0/5 + 1/2", "1/2 + 0/3", "1001/2 + 1/3", "1/1001 + 1/3", "1/2 - 1/1001", "りんご", "1/3 - 1/2", "1/2 + 1/3 + 1/4"]) {
    for (const [path, body] of bodies(problem)) {
      const response = await post(createApp(client), path, body);
      assert.equal(response.status, 400, `${path} ${problem}`);
      assert.equal((await response.json() as { error: { code: string } }).error.code, "INVALID_REQUEST");
    }
  }
  assert.equal(calls, 0);
  // 上限ちょうどと、答えが0の式は受ける
  for (const problem of ["99/1000 + 1/1000", "1/2 - 1/2"]) {
    for (const [path, body] of bodies(problem)) {
      assert.equal((await post(createApp(success), path, body)).status, 200, `${path} ${problem}`);
    }
  }
});

test("the numerator and denominator limit comes from limits.ts and AI output is not limited by it", async () => {
  const strict = createApp(success, process.env, { maxFractionTerm: 5 });
  assert.equal((await post(strict, "/api/v1/parts", { expression: "1/6 + 1/2" })).status, 400);
  assert.equal((await post(strict, "/api/v1/parts", { expression: "1/5 + 1/2" })).status, 200);
  // 類題の式（AI が返す部品データ）は入力の上限を超えていても、検算に通れば返す
  const client = clientWith({ createSimilarProblem: async () => createPartsData("1/1200 + 1/1500") });
  assert.equal((await post(createApp(client), "/api/v1/similar-problem", { problem: "1/2 + 1/3" })).status, 200);
});

test("the default mock returns a different pair for similar problems, including reversed pairs", async () => {
  // 11 回続けて呼ぶので、AI を呼ぶ API の 1 分あたりの回数の制限（既定は 10）を広げる
  const app = createApp(success, {}, { aiRequestsPerMinute: 1000 });
  const inputs = ["1/4 + 1/3", "1/3 + 1/4", "1/4 + 1/5", "1/5 + 1/4", "1/2 + 1/5", "1/5 + 1/2",
    "3/4 - 1/6", "5/6 - 1/3", "2/3 - 1/4", "1/2 + 1/3", "7/8 - 1/8"];
  for (const problem of inputs) {
    const response = await post(app, "/api/v1/similar-problem", { problem });
    assert.equal(response.status, 200, problem);
    const returned = parseExpression((await response.json() as PartsData).problem);
    const original = parseExpression(problem);
    assert.ok(returned.ok && original.ok);
    assert.equal(isSameFractionPair(returned.expression, original.expression), false, problem);
  }
});

test("failure logs keep the exception kind but not the input, and tell AI failures from check failures", async () => {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { lines.push(args.join(" ")); };
  try {
    const aiDown = clientWith({ createParts: async () => { throw new TypeError("secret 1/2 + 1/3"); } });
    assert.equal((await post(createApp(aiDown), "/api/v1/parts", { expression: "1/2 + 1/3" })).status, 503);
    // 検算側の不具合：AI は答えたが、後段（公開データの整形）で例外になる
    const broken = clientWith({ createParts: async (problem) => {
      const data = createPartsData(problem);
      Object.defineProperty(data, "tool", { get() { throw new RangeError("secret 1/2 + 1/3"); } });
      return data;
    } });
    assert.equal((await post(createApp(broken), "/api/v1/parts", { expression: "1/2 + 1/3" })).status, 503);
  } finally {
    console.error = original;
  }
  assert.deepEqual(lines, ["failure stage=ai name=TypeError", "failure stage=check name=RangeError"]);
});

test("health endpoint responds without invoking AI", async () => {
  const response = await createApp(success).request("/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", forwardedCount: 0 });
});

test("an unknown route keeps Hono's 404 response", async () => {
  const response = await createApp(success).request("/nope");
  assert.equal(response.status, 404);
});

function brokenParts(problem: string): PartsData {
  const data = createPartsData(problem);
  data.answer = { num: 1, den: 1 };
  return data;
}

function clientWith(overrides: Partial<AiClient>): AiClient {
  return {
    createParts: async (problem) => createPartsData(problem),
    createSimilarProblem: async (problem) => createPartsData(problem),
    createReflection: async (_input) => "1/6 を使うと、何こ分かな？",
    ...overrides,
  };
}
