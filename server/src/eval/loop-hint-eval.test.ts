import test from "node:test";
import assert from "node:assert/strict";
import type { AiClient } from "../ai/client.ts";
import { evaluateLoopHints, formatLoopHintTable, type LoopHintEvalInput } from "./loop-hint-eval.ts";

const input: LoopHintEvalInput[] = [
  { pattern: "sum-both", operator: "+", problem: "1/3+1/4" },
  { pattern: "sum-num-only", operator: "-", problem: "3/4-1/3" },
];

function clientFor(hints: string[]): AiClient {
  let index = 0;
  return {
    createParts: async () => undefined,
    createSimilarProblem: async () => undefined,
    createReflection: async () => "",
    draftLoopHint: async () => hints[index++] ?? "",
  };
}

test("試行ごとに検査結果と理由を型・演算別に数える", async () => {
  const report = await evaluateLoopHints(input, clientFor([
    "分母をそろえて考えましょう",
    "答えは7/12です",
    "分子をたして考えましょう",
    "分母をそろえて考えましょう",
  ]), { repetitions: 2 });

  assert.deepEqual(report.groups.map(({ pattern, operator, tried, passed, failures }) => ({
    pattern, operator, tried, passed, failures,
  })), [
    { pattern: "sum-both", operator: "+", tried: 2, passed: 1, failures: { leak: 1 } },
    { pattern: "sum-num-only", operator: "-", tried: 2, passed: 1, failures: { wrong_operator: 1 } },
  ]);
  assert.deepEqual(report.examples.map(({ accepted, reason }) => ({ accepted, reason })), [
    { accepted: true, reason: undefined },
    { accepted: false, reason: "leak" },
    { accepted: false, reason: "wrong_operator" },
    { accepted: true, reason: undefined },
  ]);
  assert.match(formatLoopHintTable(report), /sum-both/);
  assert.match(formatLoopHintTable(report), /通った/);
});

test("試行回数は正の整数に限る", async () => {
  await assert.rejects(() => evaluateLoopHints(input, clientFor([]), { repetitions: 0 }), /正の整数/);
});
