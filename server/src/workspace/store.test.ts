import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryWorkspaceStore, DEMO_WORKSPACE_ID, normalizeWorkspaceName, readReadsPerDay } from "./store.ts";

const NOW = new Date("2026-11-10T01:00:00Z");

test("学級：初めの名前は「わたしの学級」。同じ持ち主には同じ学級を返し、学級コードは決まった字の 6 文字", () => {
  const store = createMemoryWorkspaceStore();
  const first = store.ensureFor("owner-1", NOW);
  assert.notEqual(first, "full");
  if (first === "full") return;
  assert.equal(first.name, "わたしの学級");
  assert.match(first.joinCode, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.ok(first.id.length >= 16);
  assert.deepEqual(store.ensureFor("owner-1", NOW), first);
  assert.deepEqual(store.byOwner("owner-1"), first);
  assert.equal(store.byOwner("owner-2"), undefined);
  assert.notEqual(DEMO_WORKSPACE_ID, first.id);
});

test("学級コードは大文字小文字を区別せず引け、重ならない", () => {
  const store = createMemoryWorkspaceStore();
  const codes = new Set<string>();
  for (let index = 0; index < 300; index += 1) {
    const workspace = store.ensureFor(`owner-${index}`, NOW);
    assert.notEqual(workspace, "full");
    if (workspace !== "full") codes.add(workspace.joinCode);
  }
  assert.equal(codes.size, 300);
  const sample = store.byOwner("owner-7")!;
  assert.equal(store.byJoinCode(sample.joinCode.toLowerCase())?.id, sample.id);
  assert.equal(store.byJoinCode("ZZZZZZ"), undefined);
});

test("学級の数の上限を超えると full を返す。すでにある学級は上限の後も引ける", () => {
  const store = createMemoryWorkspaceStore({ maxWorkspaces: 2 });
  assert.notEqual(store.ensureFor("a", NOW), "full");
  assert.notEqual(store.ensureFor("b", NOW), "full");
  assert.equal(store.ensureFor("c", NOW), "full");
  assert.notEqual(store.ensureFor("a", NOW), "full");
  assert.equal(store.byOwner("c"), undefined);
});

test("名前：前後の空白を除き、1〜30 文字、制御文字は断る。持ち主だけが直せる", () => {
  assert.equal(normalizeWorkspaceName("  3年2組  "), "3年2組");
  assert.equal(normalizeWorkspaceName(""), undefined);
  assert.equal(normalizeWorkspaceName("   "), undefined);
  assert.equal(normalizeWorkspaceName("あ".repeat(30)), "あ".repeat(30));
  assert.equal(normalizeWorkspaceName("あ".repeat(31)), undefined);
  assert.equal(normalizeWorkspaceName("a\nb"), undefined);
  assert.equal(normalizeWorkspaceName("a\u0000b"), undefined);
  assert.equal(normalizeWorkspaceName(5), undefined);
  const store = createMemoryWorkspaceStore();
  store.ensureFor("owner", NOW);
  assert.equal(store.rename("owner", " 4年1組 ")?.name, "4年1組");
  assert.equal(store.byOwner("owner")?.name, "4年1組");
  assert.equal(store.rename("stranger", "x"), undefined);
  assert.equal(store.rename("owner", "a\nb"), undefined);
});

test("読み取りの回数：上限までは数え、超えたら false で数えない。日付が日本時間で変わると戻る。学級ごとに別", () => {
  const store = createMemoryWorkspaceStore({ readsPerDay: 2 });
  const jstMorning = new Date("2026-11-10T00:00:00Z"); // 日本時間 9:00
  assert.equal(store.countRead("w1", jstMorning), true);
  assert.equal(store.countRead("w1", jstMorning), true);
  assert.equal(store.countRead("w1", jstMorning), false);
  assert.equal(store.countRead("w2", jstMorning), true);
  // 世界時間では同じ日（14:59Z）でも、日本時間 23:59 まで同じ日
  assert.equal(store.countRead("w1", new Date("2026-11-10T14:59:00Z")), false);
  // 15:00Z は日本時間の翌日 0:00
  assert.equal(store.countRead("w1", new Date("2026-11-10T15:00:00Z")), true);
});

test("WORKSPACE_READS_PER_DAY：正の整数だけ読み、それ以外は 30", () => {
  assert.equal(readReadsPerDay({}), 30);
  assert.equal(readReadsPerDay({ WORKSPACE_READS_PER_DAY: "5" }), 5);
  assert.equal(readReadsPerDay({ WORKSPACE_READS_PER_DAY: "0" }), 30);
  assert.equal(readReadsPerDay({ WORKSPACE_READS_PER_DAY: "-1" }), 30);
  assert.equal(readReadsPerDay({ WORKSPACE_READS_PER_DAY: "many" }), 30);
});
