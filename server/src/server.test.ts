import test from "node:test";
import assert from "node:assert/strict";
import { assertApproverKeyConfigured } from "./server.ts";

test("本番または Cloud Run では承認キーが空なら起動を止める", () => {
  for (const env of [{ NODE_ENV: "production" }, { K_SERVICE: "service" }, { NODE_ENV: "production", LOOP_APPROVER_KEY: "  \n" }]) {
    assert.throws(() => assertApproverKeyConfigured(env), /LOOP_APPROVER_KEY/);
  }
  assert.doesNotThrow(() => assertApproverKeyConfigured({ NODE_ENV: "production", LOOP_APPROVER_KEY: "key" }));
});

test("ローカル開発とテストは承認キー未設定でも起動できる", () => {
  assert.doesNotThrow(() => assertApproverKeyConfigured({ NODE_ENV: "development" }));
  assert.doesNotThrow(() => assertApproverKeyConfigured({ NODE_ENV: "test" }));
  assert.doesNotThrow(() => assertApproverKeyConfigured({}));
});
