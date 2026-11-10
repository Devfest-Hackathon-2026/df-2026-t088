import assert from "node:assert/strict";
import test from "node:test";
import { STUDIO_FIXTURES } from "./fixtures.ts";
import { createStudioStore } from "./store.ts";

test("初版からパッチ、承認、取り消しで前の公開版へ戻す", () => {
  const store = createStudioStore({ now: () => new Date("2026-11-09T00:00:00.000Z") });
  store.createLesson("lesson-1", STUDIO_FIXTURES.valid);
  const result = store.applyPatch("lesson-1", {
    baseVersion: 1,
    operations: [{ type: "setStrategy", strategy: "numeric" }],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.version.number, 2);
  assert.equal(result.value.version.status, "review_required");
  assert.deepEqual(result.value.version.transitions, ["draft", "validating", "review_required"]);
  assert.equal(store.decide("lesson-1", 2, "approved").ok, true);
  assert.equal(store.getVersion("lesson-1", 2)?.status, "published");
  assert.equal(store.revoke("lesson-1", 2).ok, true);
  assert.equal(store.getVersion("lesson-1", 2)?.status, "revoked");
  assert.equal(store.getCurrentVersion("lesson-1")?.number, 1);
  assert.equal(store.getCurrentVersion("lesson-1")?.lesson.strategy, "visual");
});

test("生成情報を初版とパッチ版に保存する", () => {
  const store = createStudioStore();
  const generation = { source: "gemini" as const, model: "gemini-test", elapsedMs: 42 };
  store.createLesson("lesson-meta", STUDIO_FIXTURES.valid, { generation });
  const patched = store.applyPatch("lesson-meta", {
    baseVersion: 1,
    operations: [{ type: "setStrategy", strategy: "numeric" }],
  }, { generation: { source: "mock", model: "mock", elapsedMs: 0 } });

  assert.equal(store.getVersion("lesson-meta", 1)?.generation?.model, "gemini-test");
  assert.deepEqual(patched.ok && patched.value.version.generation, { source: "mock", model: "mock", elapsedMs: 0 });
  assert.equal(store.getVersions("lesson-meta")[1]?.generation?.source, "gemini");
});

test("古い baseVersion を拒否し、検査に落ちた版は rejected で記録する", () => {
  const store = createStudioStore();
  store.createLesson("lesson-1", STUDIO_FIXTURES.valid);
  const stale = store.applyPatch("lesson-1", { baseVersion: 0, operations: [{ type: "setStrategy", strategy: "numeric" }] });
  assert.equal(stale.ok, false);
  const invalid = store.applyPatch("lesson-1", {
    baseVersion: 1,
    operations: [{ type: "replaceNumbers", problemNumber: 1, left: { num: 1, den: 13 }, right: { num: 1, den: 2 } }],
  });
  assert.equal(invalid.ok, false);
  assert.equal(store.getVersions("lesson-1").length, 2);
  assert.equal(store.getVersion("lesson-1", 2)?.status, "rejected");
});

test("検査に落ちた版の次は最大版番号の次を採番し、承認できる", () => {
  const store = createStudioStore();
  store.createLesson("lesson-invalid", STUDIO_FIXTURES.valid);
  const invalid = store.applyPatch("lesson-invalid", {
    baseVersion: 1,
    operations: [{ type: "replaceNumbers", problemNumber: 1, left: { num: 1, den: 13 }, right: { num: 1, den: 2 } }],
  });
  assert.equal(invalid.ok, false);
  const next = store.applyPatch("lesson-invalid", { baseVersion: 1, operations: [{ type: "setStrategy", strategy: "numeric" }] });
  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.value.version.number, 3);
  assert.deepEqual(store.getVersions("lesson-invalid").map((version) => version.number), [3, 2, 1]);
  assert.equal(store.decide("lesson-invalid", 3, "approved").ok, true);
  assert.equal(store.getVersion("lesson-invalid", 3)?.status, "published");
});

test("却下した版の次も最大版番号の次を採番し、承認できる", () => {
  const store = createStudioStore();
  store.createLesson("lesson-rejected", STUDIO_FIXTURES.valid);
  const rejected = store.applyPatch("lesson-rejected", { baseVersion: 1, operations: [{ type: "setStrategy", strategy: "numeric" }] });
  assert.equal(rejected.ok, true);
  assert.equal(store.decide("lesson-rejected", 2, "rejected").ok, true);
  const next = store.applyPatch("lesson-rejected", { baseVersion: 1, operations: [{ type: "setStrategy", strategy: "misconception" }] });
  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.value.version.number, 3);
  assert.equal(store.decide("lesson-rejected", 3, "approved").ok, true);
  assert.equal(store.getVersion("lesson-rejected", 3)?.status, "published");
});

test("1つ前の承認済み版がない取り消しを拒否する", () => {
  const store = createStudioStore();
  store.createLesson("lesson-1", STUDIO_FIXTURES.valid);
  assert.equal(store.revoke("lesson-1", 1).ok, false);
});
