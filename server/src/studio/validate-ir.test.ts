import assert from "node:assert/strict";
import test from "node:test";
import { STUDIO_FIXTURES } from "./fixtures.ts";
import { validateLessonIr } from "./validate-ir.ts";

test("正しい見本データを受け入れる", () => {
  assert.deepEqual(validateLessonIr(STUDIO_FIXTURES.valid), { ok: true });
});

test("形が壊れた見本データを先生向けの理由つきで拒否する", () => {
  const result = validateLessonIr(STUDIO_FIXTURES.invalidShape);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.issues.length > 0 && result.issues.every((issue) => issue.length > 0));
});

test("計算が合わない見本データを先生向けの理由つきで拒否する", () => {
  const result = validateLessonIr(STUDIO_FIXTURES.invalidMath);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.issues.some((issue) => issue.includes("ひき算")));
});

test("未知の項目と未知の種類を拒否する", () => {
  const base = STUDIO_FIXTURES.valid;
  assert.equal(validateLessonIr({ ...base, extra: true }).ok, false);
  assert.equal(validateLessonIr({ ...base, problems: [{ ...base.problems[0], kind: "unknown" }] }).ok, false);
});

test("分数の範囲とひき算の正の答えを検査する", () => {
  const base = STUDIO_FIXTURES.valid;
  const problem = base.problems[0];
  assert.equal(validateLessonIr({ ...base, problems: [{ ...problem, left: { num: 1, den: 13 } }] }).ok, false);
  assert.equal(validateLessonIr({ ...base, problems: [{ ...problem, kind: "calculate", operator: "-", left: { num: 1, den: 3 }, right: { num: 1, den: 2 } }] }).ok, false);
});

test("ヒントは既存の安全検査を通す", () => {
  const base = STUDIO_FIXTURES.valid;
  const problem = base.problems[0];
  assert.equal(validateLessonIr({ ...base, problems: [{ ...problem, hints: ["答えは 5/6 です"] }] }).ok, false);
});
