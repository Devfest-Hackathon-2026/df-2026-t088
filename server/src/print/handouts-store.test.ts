import assert from "node:assert/strict";
import test from "node:test";
import { createPrintHandoutsStore } from "./handouts-store.ts";

test("配布は新しい順に返し、50件を超えると古い説明を捨てる", async () => {
  let index = 0;
  const store = createPrintHandoutsStore(() => new Date(Date.UTC(2026, 0, 1, 0, 0, index++)));
  for (let item = 0; item < 51; item += 1) {
    await store.add({ templateId: "rika-moon", questionText: `月の形${item}`, params: {}, approved: true }, "demo");
  }
  const items = await store.list("demo");
  assert.equal(items.length, 50);
  assert.equal(items[0]?.questionText, "月の形50");
  assert.equal(items.at(-1)?.questionText, "月の形1");
});

test("配布は学級ごとに分かれ、ほかの学級のものは一覧に出ず、消せない。50件の上限も学級ごと", async () => {
  const store = createPrintHandoutsStore();
  const problem = { templateId: "rika-moon" as const, questionText: "月の形", params: {}, approved: true as const };
  const first = await store.add(problem, "ws-a");
  await store.add(problem, "ws-b");
  assert.deepEqual((await store.list("ws-a")).map((item) => item.id), [first.id]);
  assert.equal(await store.remove(first.id, "ws-b"), false);
  assert.equal((await store.get(first.id))?.id, first.id);
  assert.equal(await store.workspaceIdOf(first.id), "ws-a");
  assert.equal(await store.workspaceIdOf("unknown"), undefined);
  for (let item = 0; item < 50; item += 1) await store.add(problem, "ws-b");
  assert.equal((await store.list("ws-b")).length, 50);
  assert.equal((await store.list("ws-a")).length, 1);
  assert.equal(await store.remove(first.id, "ws-a"), true);
  assert.equal(await store.get(first.id), undefined);
});

test("子どもが撮った説明は既定の一覧に出ず、上限を超えたときは先に外れる（先生が配った説明を押し出さない）", async () => {
  let index = 0;
  const store = createPrintHandoutsStore(() => new Date(Date.UTC(2026, 0, 1, 0, 0, index++)));
  const problem = { templateId: "rika-moon" as const, questionText: "月の形", params: {}, approved: true as const };
  const teacher = await store.add(problem, "ws-a");
  for (let item = 0; item < 60; item += 1) await store.add(problem, "ws-a", "child");
  assert.deepEqual((await store.list("ws-a")).map((item) => item.id), [teacher.id]);
  const all = await store.list("ws-a", { includeChild: true });
  assert.equal(all.length, 50, "子どもの分も 50 に含める");
  assert.equal(all.filter((item) => item.origin === "child").length, 49);
  assert.equal(all.at(-1)?.id, teacher.id);
});
