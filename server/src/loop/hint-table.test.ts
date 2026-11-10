import test from "node:test";
import assert from "node:assert/strict";
import { HINT_BY_PATTERN, NAMED_PATTERNS } from "./hint-table.ts";

// ひき算にも付く型。直し方の文に「たす」の言い方があると、ひき算の子に「たそう」と届いてしまう（#92 の指摘）
const BOTH_OPERATORS = ["sum-both", "sum-num-only"] as const;
const ADDITION_WORDS = /たす|たさ|たそ|たし|足/;

test("hints for patterns that also occur in subtraction do not say add", () => {
  for (const pattern of BOTH_OPERATORS) {
    assert.doesNotMatch(HINT_BY_PATTERN[pattern], ADDITION_WORDS, pattern);
  }
});

test("hints contain no digits so they cannot leak an answer", () => {
  for (const pattern of NAMED_PATTERNS) {
    assert.doesNotMatch(HINT_BY_PATTERN[pattern], /[\d０-９]/, pattern);
  }
});

test("lever patterns have rule-table hints with no numbers", () => {
  assert.deepEqual(NAMED_PATTERNS.slice(-2), ["lever-same-weight", "lever-inverse"]);
  assert.equal(HINT_BY_PATTERN["lever-same-weight"], "左と右では、支点からのきょりがちがうよ。重さ × きょりで比べよう");
  assert.equal(HINT_BY_PATTERN["lever-inverse"], "支点から遠いほど、軽いおもりでつり合うよ");
  for (const pattern of NAMED_PATTERNS.slice(-2)) {
    assert.doesNotMatch(HINT_BY_PATTERN[pattern], /[\d０-９]/, pattern);
  }
});
