import assert from "node:assert/strict";
import test from "node:test";
import { STUDIO_FIXTURES } from "./fixtures.ts";
import { applyStudioPatch, type StudioPatch } from "./patch.ts";

test("4 種類の操作をまとめて適用する", () => {
  const patch: StudioPatch = {
    baseVersion: 1,
    operations: [
      { type: "replaceHint", problemNumber: 1, hintNumber: 1, text: "タイルの大きさを見比べましょう" },
      { type: "addHint", problemNumber: 1, text: "同じ大きさに分けてみましょう" },
      { type: "replaceNumbers", problemNumber: 1, left: { num: 1, den: 3 }, right: { num: 1, den: 6 } },
      { type: "setStrategy", strategy: "numeric" },
    ],
  };
  const result = applyStudioPatch(STUDIO_FIXTURES.valid, patch);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.lesson.strategy, "numeric");
    assert.deepEqual(result.lesson.problems[0]?.left, { num: 1, den: 3 });
    assert.deepEqual(result.lesson.problems[0]?.hints, ["タイルの大きさを見比べましょう", "同じ大きさに分けてみましょう"]);
  }
});

test("問題番号・ヒント番号と上限を守る", () => {
  assert.equal(applyStudioPatch(STUDIO_FIXTURES.valid, { baseVersion: 1, operations: [{ type: "replaceHint", problemNumber: 0, hintNumber: 1, text: "見ましょう" }] }).ok, false);
  assert.equal(applyStudioPatch(STUDIO_FIXTURES.valid, { baseVersion: 1, operations: [{ type: "addHint", problemNumber: 1, text: "二つ目" }, { type: "addHint", problemNumber: 1, text: "三つ目" }, { type: "addHint", problemNumber: 1, text: "四つ目" }] }).ok, false);
});

test("未知の操作と不正な形を拒否する", () => {
  const unknown = { baseVersion: 1, operations: [{ type: "deleteProblem", problemNumber: 1 }] } as unknown as StudioPatch;
  assert.equal(applyStudioPatch(STUDIO_FIXTURES.valid, unknown).ok, false);
  const malformed = { baseVersion: 1, operations: [{ type: "setStrategy", strategy: "guess" }] } as unknown as StudioPatch;
  assert.equal(applyStudioPatch(STUDIO_FIXTURES.valid, malformed).ok, false);
});
