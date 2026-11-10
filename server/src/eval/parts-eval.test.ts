import test from "node:test";
import assert from "node:assert/strict";
import type { AiClient } from "../ai/client.ts";
import { createPartsData } from "../ai/mock-client.ts";
import type { ReflectionInput } from "../api-types.ts";
import { assertEvalAiAllowed, assertEvalSettingsMatchIntent, describeAiSettings, evaluateParts, formatEvalTable, median } from "./parts-eval.ts";

const problems = [
  { id: "first", expression: "1/2 + 1/3" },
  { id: "retry", expression: "1/2 + 1/4" },
  { id: "failed", expression: "1/3 + 1/4" },
  { id: "timeout", expression: "1/5 + 1/10" },
];

test("evaluation counts first pass, retry pass, two failures, and timeouts", async () => {
  const calls = new Map<string, number>();
  const client: AiClient = {
    createParts: async (expression) => {
      const count = (calls.get(expression) ?? 0) + 1;
      calls.set(expression, count);
      if (expression === "1/2 + 1/4" && count === 1) return undefined;
      if (expression === "1/3 + 1/4") return undefined;
      if (expression === "1/5 + 1/10") return new Promise(() => {});
      return createPartsData(expression);
    },
    createSimilarProblem: async () => undefined,
    createReflection: async (_input: ReflectionInput) => "",
  };

  const report = await evaluateParts(problems, client, { limits: { timeoutMilliseconds: 5 } });
  const durations = report.results.map(({ durationMilliseconds }) => durationMilliseconds).sort((a, b) => a - b);
  assert.deepEqual(report.summary, {
    total: 4,
    succeeded: 2,
    successRate: 0.5,
    firstTrySucceeded: 1,
    firstTryRate: 0.25,
    retrySucceeded: 1,
    retryRate: 0.25,
    codeCounts: { OK: 2, PARTS_NOT_READY: 1, TIMEOUT: 1 },
    medianMilliseconds: median(durations),
    maxMilliseconds: durations.at(-1),
    lcmMatches: 2,
    lcmChecked: 2,
    hintCounts: [2, 2],
  });
  assert.equal(report.results[0]?.aiCalls, 1);
  assert.equal(report.results[1]?.aiCalls, 2);
  assert.equal(report.results[2]?.aiCalls, 2);
  assert.equal(report.results[3]?.aiCalls, 1);
  assert.equal(report.results[3]?.errorCode, "TIMEOUT");
  assert.equal(calls.get("1/2 + 1/3"), 1);
  assert.equal(calls.get("1/2 + 1/4"), 2);
  assert.equal(calls.get("1/3 + 1/4"), 2);
  assert.equal(calls.get("1/5 + 1/10"), 1);
});

test("real AI modes stop before client construction unless explicitly allowed", () => {
  assert.throws(
    () => assertEvalAiAllowed({ GEMINI_MODE: "developer", GEMINI_MODEL: "model-x" }),
    /EVAL_ALLOW_REAL_AI=1/,
  );
  assert.throws(
    () => assertEvalAiAllowed({ GEMINI_MODE: "vertex", GEMINI_MODEL: "model-x" }),
    /EVAL_ALLOW_REAL_AI=1/,
  );
  assert.doesNotThrow(() => assertEvalAiAllowed({ GEMINI_MODE: "developer", EVAL_ALLOW_REAL_AI: "1" }));
  assert.doesNotThrow(() => assertEvalAiAllowed({}));
});

test("median handles empty, odd, and even counts", () => {
  assert.equal(median([]), 0);
  assert.equal(median([7]), 7);
  assert.equal(median([1, 5, 9]), 5);
  assert.equal(median([1, 4]), 3);
  assert.equal(median([1, 2]), 2);
});

test("allowed real AI that falls back to mock is rejected", () => {
  const allowed = { EVAL_ALLOW_REAL_AI: "1" };
  assert.throws(
    () => assertEvalSettingsMatchIntent(allowed, { mode: "mock", reason: "model_missing" }),
    /モック/,
  );
  assert.doesNotThrow(() => assertEvalSettingsMatchIntent({}, { mode: "mock", reason: "mode_missing" }));
  assert.doesNotThrow(() => assertEvalSettingsMatchIntent(allowed, { mode: "developer", apiKey: "k", model: "m" }));
});

test("report records mode and model without secrets", async () => {
  const client: AiClient = {
    createParts: async (expression) => createPartsData(expression),
    createSimilarProblem: async () => undefined,
    createReflection: async () => "",
  };
  const ai = describeAiSettings({ mode: "developer", apiKey: "secret-key", model: "model-x" });
  assert.deepEqual(ai, { mode: "developer", model: "model-x" });
  const report = await evaluateParts([problems[0]!], client, { ai });
  assert.deepEqual(report.ai, { mode: "developer", model: "model-x" });
  assert.ok(!JSON.stringify(report).includes("secret-key"));
  assert.match(formatEvalTable(report), /測った AI \| developer \(model-x\)/);
  assert.deepEqual(describeAiSettings({ mode: "mock", reason: "mode_missing" }), { mode: "mock" });
});
