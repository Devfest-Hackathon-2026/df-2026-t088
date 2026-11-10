import test from "node:test";
import assert from "node:assert/strict";
import { readAiSettings } from "./settings.ts";

test("settings keep mock mode until model id is explicitly configured", () => {
  assert.deepEqual(readAiSettings({}), { mode: "mock", reason: "mode_missing" });
  assert.deepEqual(readAiSettings({ GEMINI_MODE: "developer", GEMINI_API_KEY: "test-api-key" }), { mode: "mock", reason: "model_missing" });
});

test("settings select developer and vertex modes without constructing the SDK", () => {
  assert.deepEqual(readAiSettings({ GEMINI_MODE: "developer", GEMINI_API_KEY: "test-api-key", GEMINI_MODEL: "model-x" }), {
    mode: "developer", apiKey: "test-api-key", model: "model-x",
  });
  assert.deepEqual(readAiSettings({ GEMINI_MODE: "vertex", GOOGLE_CLOUD_PROJECT: "project-x", GOOGLE_CLOUD_LOCATION: "asia-east1", GEMINI_MODEL: "model-x" }), {
    mode: "vertex", project: "project-x", location: "asia-east1", model: "model-x",
  });
});

test("settings reject an unknown GEMINI_MODE even when the model is missing", () => {
  for (const environment of [{ GEMINI_MODE: "develper" }, { GEMINI_MODE: "Developer", GEMINI_MODEL: "model-x" }, { GEMINI_MODE: "mock" }]) {
    assert.throws(() => readAiSettings(environment), /GEMINI_MODE must be developer or vertex/);
  }
  assert.deepEqual(readAiSettings({ GEMINI_MODE: "" }), { mode: "mock", reason: "mode_missing" });
});
