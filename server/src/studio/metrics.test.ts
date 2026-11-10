import assert from "node:assert/strict";
import test from "node:test";
import { summarizeStudioEvidence } from "./metrics.ts";
import { STUDIO_FIXTURES } from "./fixtures.ts";

const version = (number: number, extra: Record<string, unknown> = {}) => ({
  id: `lesson-1@v${number}`, lessonId: "lesson-1", number, baseVersion: number === 1 ? null : number - 1,
  status: "review_required", transitions: ["draft", "validating", "review_required"],
  lesson: STUDIO_FIXTURES.valid, validation: { ok: true }, createdAt: "2026-11-09T00:00:00.000Z", isFixture: false,
  ...extra,
});

test("studio evidence metrics count generation, validation and decisions and calculate nearest-rank percentiles", () => {
  const result = summarizeStudioEvidence([
    version(1, { generation: { model: "mock-model", elapsedMs: 100, source: "mock" }, status: "published" }),
    version(2, { generation: { model: "gemini-model", elapsedMs: 200, source: "measured" }, status: "rejected", validation: { ok: false, issues: ["理由"] } }),
    version(3, { generation: { model: "gemini-model", elapsedMs: 300, source: "dummy" }, status: "review_required" }),
  ]);

  assert.deepEqual(result, {
    generationCount: 3,
    validationPassRate: 2 / 3,
    approvalRate: 1 / 2,
    generationTimeP50Ms: 200,
    generationTimeP95Ms: 300,
  });
});

test("missing measurements stay unmeasured and empty rates are null", () => {
  assert.deepEqual(summarizeStudioEvidence([]), {
    generationCount: 0,
    validationPassRate: null,
    approvalRate: null,
    generationTimeP50Ms: null,
    generationTimeP95Ms: null,
  });
  assert.equal(summarizeStudioEvidence([version(1, { isFixture: true })]).generationTimeP50Ms, null);
});
