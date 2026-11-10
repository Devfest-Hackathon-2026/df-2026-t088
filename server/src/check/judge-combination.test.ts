import test from "node:test";
import assert from "node:assert/strict";
import { judgeCombination } from "./judge-combination.ts";

test("judges a placed combination by its exact sum", () => {
  assert.equal(judgeCombination({ num: 5, den: 6 }, [{ num: 1, den: 2, count: 1 }, { num: 1, den: 3, count: 1 }]), true);
  assert.equal(judgeCombination({ num: 2, den: 3 }, [{ num: 1, den: 2, count: 1 }]), false);
});

test("does not accept pieces without length, but accepts an empty combination for zero", () => {
  assert.equal(judgeCombination({ num: 1, den: 2 }, [{ num: 1, den: 2, count: 1 }, { num: 0, den: 3, count: 1 }]), false);
  assert.equal(judgeCombination({ num: 0, den: 1 }, [{ num: 0, den: 3, count: 1 }]), false);
  assert.equal(judgeCombination({ num: 0, den: 1 }, []), true);
});
