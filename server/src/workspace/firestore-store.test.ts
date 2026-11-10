import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../app.ts";
import { createFirestoreWorkspaceStore, createWorkspaceStoreFromEnv, isPersistent } from "./firestore-store.ts";

const NOW = new Date("2026-11-10T01:00:00Z"); // 日本時間 2026-11-10
type Call = { method: string; url: string; body: any };
type Options = { workspaces?: any[]; reads?: any[]; failLoad?: boolean; failWrites?: boolean };

const strings = (fields: Record<string, string>) => Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { stringValue: value }]));
const workspaceDocument = (id: string, ownerSub: string, name: string, joinCode: string) => ({
  name: `projects/p/databases/(default)/documents/workspaces/${id}`,
  fields: strings({ ownerSub, name, joinCode, createdAt: "2026-11-01T00:00:00.000Z" }),
});

function fakeFirestore(options: Options = {}) {
  const calls: Call[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("metadata.google.internal")) return new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 });
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
    if (method === "PATCH") return options.failWrites ? new Response("{}", { status: 500 }) : new Response("{}", { status: 200 });
    if (options.failLoad) return new Response("{}", { status: 503 });
    if (method === "POST") {
      return new Response(JSON.stringify((options.reads ?? []).map((document) => ({ document }))), { status: 200 });
    }
    return new Response(JSON.stringify({ documents: options.workspaces ?? [] }), { status: 200 });
  };
  return { calls, fetcher, writes: () => calls.filter((call) => call.method === "PATCH") };
}

const makeStore = (fake: ReturnType<typeof fakeFirestore>, extra: { readsPerDay?: number } = {}) =>
  createFirestoreWorkspaceStore({ project: "demo-project", database: "(default)", fetcher: fake.fetcher, now: () => NOW, ...extra });

test("起動時に Firestore の学級と今日の回数を読み込み、byOwner・byJoinCode・countRead がそれを返す", async () => {
  const fake = fakeFirestore({
    workspaces: [workspaceDocument("ws-1", "owner-1", "3年1組", "ABC234")],
    reads: [{ fields: { ...strings({ workspaceId: "ws-1", day: "2026-11-10" }), count: { integerValue: "2" } } }],
  });
  const store = makeStore(fake, { readsPerDay: 3 });
  await store.ready();
  assert.deepEqual(store.byOwner("owner-1"), { id: "ws-1", name: "3年1組", joinCode: "ABC234", createdAt: "2026-11-01T00:00:00.000Z", childCapture: false });
  assert.equal(store.byJoinCode("abc234")?.id, "ws-1");
  assert.equal(store.ensureFor("owner-1", NOW) !== "full" && (store.ensureFor("owner-1", NOW) as { id: string }).id, "ws-1");
  assert.equal(store.countRead("ws-1", NOW), true);
  assert.equal(store.countRead("ws-1", NOW), false);
  await store.flush();
  assert.equal(fake.writes().length, 1, "上限を超えた読み取りは書かない");
});

test("ensureFor・rename・countRead は Firestore へ正しい文書を書く。メールや余計な項目は無い", async () => {
  const fake = fakeFirestore();
  const store = makeStore(fake);
  await store.ready();
  const created = store.ensureFor("owner-sub-1", NOW);
  assert.notEqual(created, "full");
  if (created === "full") return;
  store.rename("owner-sub-1", "4年2組");
  store.countRead(created.id, NOW);
  await store.flush();

  const [create, rename, read] = fake.writes();
  assert.ok(create!.url.endsWith(`/documents/workspaces/${created.id}`));
  assert.deepEqual(Object.keys(create!.body.fields).sort(), ["childCapture", "createdAt", "joinCode", "name", "ownerSub"]);
  assert.equal(create!.body.fields.ownerSub.stringValue, "owner-sub-1");
  assert.equal(create!.body.fields.name.stringValue, "わたしの学級");
  assert.equal(rename!.body.fields.name.stringValue, "4年2組");
  assert.equal(rename!.body.fields.joinCode.stringValue, created.joinCode);
  assert.ok(read!.url.endsWith(`/documents/workspaceReads/${created.id}_2026-11-10`));
  assert.deepEqual(read!.body.fields.count, { integerValue: "1" });
  assert.ok(!JSON.stringify(fake.writes()).includes("@"));
});

test("起動時の読み込みが失敗したら、空で始めずに失敗が分かり、次の呼び出しでやり直す", async () => {
  const failing = fakeFirestore({ failLoad: true });
  const store = makeStore(failing);
  await assert.rejects(store.ready());
  assert.throws(() => store.byOwner("owner-1"));
  assert.throws(() => store.ensureFor("owner-1", NOW));
  assert.equal(failing.writes().length, 0);
  await assert.rejects(store.ready());
  assert.ok(failing.calls.length >= 2, "2 回目の ready() は読み込みをやり直す");
});

test("書き込みが失敗しても要求は落ちず、ログに id・名前・学級コード・持ち主の印が出ない", async () => {
  const fake = fakeFirestore({ failWrites: true });
  const store = makeStore(fake);
  await store.ready();
  const messages: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void messages.push(args.join(" "));
  try {
    const created = store.ensureFor("secret-owner-sub", NOW);
    assert.notEqual(created, "full");
    if (created === "full") return;
    assert.equal(store.rename("secret-owner-sub", "ひみつの学級")?.name, "ひみつの学級");
    await store.flush();
    assert.equal(store.byOwner("secret-owner-sub")?.name, "ひみつの学級", "メモリでは使える");
    assert.equal(messages.length, 2);
    for (const forbidden of [created.id, created.joinCode, "ひみつの学級", "secret-owner-sub", "わたしの学級"]) {
      assert.ok(!messages.join("\n").includes(forbidden), forbidden);
    }
  } finally {
    console.error = original;
  }
});

test("設定が無いときはメモリ版で、fetch を 1 回も呼ばない", async () => {
  let called = 0;
  const fetcher: typeof fetch = async () => {
    called += 1;
    return new Response("{}");
  };
  for (const env of [{}, { PRINT_FIRESTORE_DATABASE: "(default)" }, { GOOGLE_CLOUD_PROJECT: "demo-project" }]) {
    const store = createWorkspaceStoreFromEnv(env, fetcher);
    assert.equal(isPersistent(store), false);
    assert.notEqual(store.ensureFor("owner-1", NOW), "full");
    assert.equal(store.countRead("any", NOW), true);
  }
  assert.equal(called, 0);
  assert.equal(isPersistent(createWorkspaceStoreFromEnv({ PRINT_FIRESTORE_DATABASE: "(default)", GOOGLE_CLOUD_PROJECT: "demo-project" }, fetcher)), true);
  assert.equal(called, 0, "作っただけでは呼ばない");
});

test("日付が変わると回数が 0 から数え直しになる（日本時間）", async () => {
  const fake = fakeFirestore();
  const store = makeStore(fake, { readsPerDay: 1 });
  await store.ready();
  const beforeMidnight = new Date("2026-11-10T14:59:00Z"); // 日本時間 23:59
  const afterMidnight = new Date("2026-11-10T15:01:00Z"); // 日本時間 翌 00:01
  assert.equal(store.countRead("ws-1", beforeMidnight), true);
  assert.equal(store.countRead("ws-1", beforeMidnight), false);
  assert.equal(store.countRead("ws-1", afterMidnight), true);
  await store.flush();
  const urls = fake.writes().map((call) => call.url);
  assert.ok(urls[0]!.endsWith("ws-1_2026-11-10"));
  assert.ok(urls[1]!.endsWith("ws-1_2026-11-11"));
  assert.deepEqual(fake.writes()[1]!.body.fields.count, { integerValue: "1" });
});

test("app：読み込みが失敗している間、学級に触る経路は 503 で、ほかの経路は動く", async () => {
  const fake = fakeFirestore({ failLoad: true });
  const original = console.error;
  console.error = () => undefined;
  try {
    const app = createApp(undefined, {
      PRINT_FIRESTORE_DATABASE: "(default)", GOOGLE_CLOUD_PROJECT: "demo-project", TEACHER_LOGIN: "on", TEACHER_SIGNUP: "open",
      GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret", PUBLIC_BASE_URL: "http://localhost:8080", SESSION_SECRET: "x".repeat(40),
    }, {}, undefined, { firestoreFetcher: fake.fetcher });
    assert.equal((await app.request("/api/v1/join/ABC234")).status, 503);
    assert.equal((await app.request("/api/health")).status, 200);
  } finally {
    console.error = original;
  }
});

test("childCapture は Firestore に保存され、項目の無い文書は切として読む", async () => {
  const fake = fakeFirestore({ workspaces: [
    workspaceDocument("ws-1", "owner-1", "3年1組", "ABC234"),
    { ...workspaceDocument("ws-2", "owner-2", "3年2組", "DEF567"), fields: { ...workspaceDocument("ws-2", "owner-2", "3年2組", "DEF567").fields, childCapture: { booleanValue: true } } },
  ] });
  const store = makeStore(fake);
  await store.ready();
  assert.equal(store.byOwner("owner-1")?.childCapture, false);
  assert.equal(store.byOwner("owner-2")?.childCapture, true);
  assert.equal(store.setChildCapture("owner-1", true)?.childCapture, true);
  assert.equal(store.setChildCapture("nobody", true), undefined);
  await store.flush();
  assert.equal(fake.writes().at(-1)!.body.fields.childCapture.booleanValue, true);
  assert.equal(store.byJoinCode("abc234")?.childCapture, true);
});
