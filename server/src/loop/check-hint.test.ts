import test from "node:test";
import assert from "node:assert/strict";
import { checkLoopHint } from "./check-hint.ts";

const valid = "分母がちがうときは、同じ大きさのタイルにそろえて考えましょう";

test("checkLoopHint accepts a short, single paragraph hint", () => {
  assert.deepEqual(checkLoopHint(valid, "+", "1/3+1/4"), { ok: true });
});

test("checkLoopHint returns a fixed reason for every rejected form", () => {
  const cases: [string, string, "+" | "-", string, string][] = [
    ["empty", "   ", "+", "1/3+1/4", "empty"],
    ["too long", "あ".repeat(81), "+", "1/3+1/4", "too_long"],
    ["multiple paragraphs", "前半です\n後半です", "+", "1/3+1/4", "multiple_paragraphs"],
    ["ASCII digit", "2つのタイルをそろえましょう", "+", "1/3+1/4", "has_digit"],
    ["full width digit", "２つのタイルをそろえましょう", "+", "1/3+1/4", "has_digit"],
    ["kanji digit", "二つのタイルをそろえましょう", "+", "1/3+1/4", "has_digit"],
    ["link", "https://example.com を見ましょう", "+", "1/3+1/4", "has_link"],
    ["answer leak", "答えは7/12です", "+", "1/3+1/4", "leak"],
    ["wrong operator", "分母をそろえてから、分子をひきましょう", "+", "1/3+1/4", "wrong_operator"],
  ];
  for (const [name, hint, operator, problem, reason] of cases) {
    assert.deepEqual(checkLoopHint(hint, operator, problem), { ok: false, reason }, name);
  }
  assert.deepEqual(checkLoopHint("分子をたして考えましょう", "-", "3/4-1/4"), { ok: false, reason: "wrong_operator" });
});

test("checkLoopHint catches other forms of add and subtract", () => {
  for (const hint of ["分子でたそう", "分母どうしをたさないよ", "足そう", "足さないで"]) {
    assert.deepEqual(checkLoopHint(hint, "-", "3/4-1/3"), { ok: false, reason: "wrong_operator" }, hint);
  }
  for (const hint of ["分子でひこう", "分母どうしをひかないよ", "引こう", "引かないで"]) {
    assert.deepEqual(checkLoopHint(hint, "+", "1/3+1/4"), { ok: false, reason: "wrong_operator" }, hint);
  }
  assert.deepEqual(checkLoopHint("分母をそろえてから、分子で計算しよう", "-", "3/4-1/3"), { ok: true });
});
