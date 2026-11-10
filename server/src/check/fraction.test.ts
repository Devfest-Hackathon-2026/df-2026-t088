import test from "node:test";
import assert from "node:assert/strict";
import { addFractions, fractionsEqual, gcd, reduceFraction, subtractFractions } from "./fraction.ts";

test("fraction arithmetic uses exact integer values", () => {
  assert.equal(gcd(24, 18), 6);
  assert.deepEqual(reduceFraction({ num: 6, den: 8 }), { num: 3, den: 4 });
  assert.deepEqual(addFractions({ num: 1, den: 2 }, { num: 1, den: 3 }), { num: 5, den: 6 });
  assert.deepEqual(subtractFractions({ num: 3, den: 4 }, { num: 1, den: 6 }), { num: 7, den: 12 });
  assert.equal(fractionsEqual({ num: 2, den: 4 }, { num: 1, den: 2 }), true);
});
