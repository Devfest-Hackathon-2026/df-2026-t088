import test from "node:test";
import assert from "node:assert/strict";
import { parseExpression } from "./expression.ts";

test("reads ASCII, optional spaces, and full-width fraction expressions", () => {
  assert.deepEqual(parseExpression("1/2+1/3"), { ok: true, expression: { left: { num: 1, den: 2 }, operator: "+", right: { num: 1, den: 3 } } });
  assert.equal(parseExpression("３／４　－　１／６").ok, true);
  assert.equal(parseExpression("３／４－１／６").ok, true);
});

test("rejects mixed numbers, extra terms, and word problems with reasons", () => {
  for (const input of ["1 1/2 + 1/3", "1/2 + 1/3 + 1/4", "花子は1/2個食べました"]) {
    const result = parseExpression(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.reason.length > 0);
  }
});
