import assert from "node:assert/strict";
import test from "node:test";
import { createFirestorePrintHandoutsStore } from "./handouts-store.ts";
import { PrintDemandStore } from "./demand.ts";

function firestoreValue(value: unknown): unknown {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  if (typeof value === "boolean") return { booleanValue: value };
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)])) } };
  throw new Error("対応していない値");
}

function readValue(value: any): any {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(readValue);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, item]) => [key, readValue(item)]));
  return undefined;
}

test("Firestore の配布説明を REST に保存し、一覧と取り下げに反映する", async () => {
  const docs = new Map<string, any>();
  const calls: { url: string; method: string; headers: Headers; body?: any }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, headers: new Headers(init?.headers), body });
    if (url.includes("metadata.google.internal")) return new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 });
    const path = new URL(url).pathname;
    const id = path.split("/").at(-1)!;
    if (method === "PATCH") {
      docs.set(id, { name: `${path}/${id}`, fields: body.fields });
      return new Response(JSON.stringify(docs.get(id)), { status: 200 });
    }
    if (method === "POST" && path.endsWith(":runQuery")) {
      const wanted = body.structuredQuery.where.fieldFilter.value.stringValue;
      const rows = [...docs.values()].filter((doc) => doc.fields.workspaceId?.stringValue === wanted).map((document) => ({ document }));
      return new Response(JSON.stringify(rows.length > 0 ? rows : [{ readTime: "2026-11-10T00:00:00Z" }]), { status: 200 });
    }
    if (method === "GET" && path.endsWith("/printHandouts")) return new Response(JSON.stringify({ documents: [...docs.values()] }), { status: 200 });
    if (method === "GET") return docs.has(id) ? new Response(JSON.stringify(docs.get(id)), { status: 200 }) : new Response("", { status: 404 });
    if (method === "DELETE") { docs.delete(id); return new Response("", { status: 200 }); }
    return new Response("unexpected request", { status: 500 });
  };
  const store = createFirestorePrintHandoutsStore({ project: "demo-project", database: "(default)", fetcher, now: () => new Date("2026-11-10T00:00:00.000Z") });
  const added = await store.add({ templateId: "rika-moon", questionText: "月の形", params: { note: "ひみつではない値", points: [1, 2] }, approved: true }, "demo");
  assert.equal((await store.list("demo"))[0]?.id, added.id);
  assert.deepEqual(readValue(docs.get(added.id)!.fields.params), { note: "ひみつではない値", points: [1, 2] });
  assert.equal(readValue(docs.get(added.id)!.fields.workspaceId), "demo");
  assert.equal(await store.remove(added.id, "demo"), true);
  assert.equal((await store.list("demo")).length, 0);
  assert.equal(calls.filter((call) => call.url.includes("metadata.google.internal")).length, calls.filter((call) => !call.url.includes("metadata.google.internal")).length);
  assert.ok(calls.filter((call) => !call.url.includes("metadata.google.internal")).every((call) => call.headers.get("authorization") === "Bearer test-token"));
});

test("Firestore の配布説明は学級ごとに分かれ、別の学級のものは読めても消せず、学級の無い古い文書は demo として読む", async () => {
  const docs = new Map<string, any>();
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    if (url.includes("metadata.google.internal")) return new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 });
    const path = new URL(url).pathname;
    const id = path.split("/").at(-1)!;
    if (method === "PATCH") { docs.set(id, { name: `${path}`, fields: body.fields }); return new Response("{}", { status: 200 }); }
    if (method === "POST" && path.endsWith(":runQuery")) {
      const wanted = body.structuredQuery.where.fieldFilter.value.stringValue;
      return new Response(JSON.stringify([...docs.values()].filter((doc) => doc.fields.workspaceId?.stringValue === wanted).map((document) => ({ document }))), { status: 200 });
    }
    if (method === "GET" && path.endsWith("/printHandouts")) return new Response(JSON.stringify({ documents: [...docs.values()] }), { status: 200 });
    if (method === "GET") return docs.has(id) ? new Response(JSON.stringify(docs.get(id)), { status: 200 }) : new Response("", { status: 404 });
    if (method === "DELETE") { docs.delete(id); return new Response("", { status: 200 }); }
    return new Response("unexpected request", { status: 500 });
  };
  let tick = 0;
  const store = createFirestorePrintHandoutsStore({ project: "demo-project", database: "(default)", fetcher, now: () => new Date(Date.UTC(2026, 10, 10, 0, 0, tick++)) });
  const problem = { templateId: "rika-moon" as const, questionText: "月の形", params: {}, approved: true as const };
  const mine = await store.add(problem, "ws-a");
  await store.add(problem, "ws-b");
  assert.deepEqual((await store.list("ws-a")).map((item) => item.id), [mine.id]);
  assert.equal((await store.list("ws-b")).length, 1);
  assert.equal((await store.get(mine.id))?.id, mine.id);
  assert.equal(await store.get("no-such"), undefined);
  assert.equal(await store.remove(mine.id, "ws-b"), false);
  assert.equal((await store.list("ws-a")).length, 1);
  assert.equal(await store.remove(mine.id, "ws-a"), true);

  docs.set("old", { name: "/documents/printHandouts/old", fields: { templateId: { stringValue: "rika-moon" }, questionText: { stringValue: "古い" }, createdAt: { stringValue: "2026-01-01T00:00:00.000Z" }, params: { mapValue: { fields: {} } } } });
  assert.deepEqual((await store.list("demo")).map((item) => item.id), ["old"]);
  assert.equal((await store.list("ws-b")).every((item) => item.id !== "old"), true);
  assert.equal(await store.remove("old", "ws-b"), false);
  assert.equal(await store.remove("old", "demo"), true);
});

test("Firestore の需要は単元ごとの件数と最終日時だけを保存して一覧に返す", async () => {
  let document: any;
  let increments = 0;
  const calls: { url: string; method: string; body?: any }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    if (url.includes("metadata.google.internal")) return new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 });
    if (method === "POST" && url.endsWith("/documents:commit")) {
      increments += 1;
      const write = body.writes[0];
      // commit の文書名は URL ではなくリソース名（projects/.../documents/...）でなければ Firestore に断られる
      assert.equal(write.update.name, "projects/demo-project/databases/(default)/documents/printDemand/sansu-6-01");
      const fields = write.update.fields ?? {};
      assert.deepEqual(write.updateTransforms, [{ fieldPath: "count", increment: { integerValue: "1" } }]);
      document = { name: `${new URL(url).pathname}/sansu-6-01`, fields: { ...document?.fields, ...fields, count: { integerValue: String(increments) } } };
      return new Response(JSON.stringify({ writeResults: [{ updateTime: "2026-11-10T00:00:00.000Z" }] }), { status: 200 });
    }
    if (method === "GET") return new Response(JSON.stringify({ documents: document ? [document] : [] }), { status: 200 });
    return new Response("unexpected request", { status: 500 });
  };
  const store = new PrintDemandStore({ project: "demo-project", database: "(default)", fetcher });
  await store.record("sansu-6-01", new Date("2026-11-10T00:00:00.000Z"));
  await store.record("sansu-6-01", new Date("2026-11-10T01:00:00.000Z"));
  assert.deepEqual(await store.list(), [{ unitId: "sansu-6-01", unitName: "算数 6 年 分数の乗法及び除法", count: 2 }]);
  assert.deepEqual(Object.keys(document.fields).sort(), ["count", "lastSeenAt", "unitId"]);
  assert.equal(document.fields.lastSeenAt.stringValue, "2026-11-10T01:00:00.000Z");
  assert.equal(calls.filter((call) => call.method === "POST" && call.url.endsWith("/documents:commit")).length, 2);
});


test("Firestore の配布説明は origin を保存し、origin の無い古い文書は先生が配ったものとして読む", async () => {
  const docs = new Map<string, any>();
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    if (url.includes("metadata.google.internal")) return new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 });
    const path = new URL(url).pathname;
    if (method === "PATCH") { docs.set(path.split("/").at(-1)!, { name: path, fields: body.fields }); return new Response("{}", { status: 200 }); }
    if (method === "POST") return new Response(JSON.stringify([...docs.values()].map((document) => ({ document }))), { status: 200 });
    return new Response("unexpected request", { status: 500 });
  };
  let tick = 0;
  const store = createFirestorePrintHandoutsStore({ project: "demo-project", database: "(default)", fetcher, now: () => new Date(Date.UTC(2026, 10, 10, 0, 0, tick++)) });
  const problem = { templateId: "rika-moon" as const, questionText: "月の形", params: {}, approved: true as const };
  const child = await store.add(problem, "ws-a", "child");
  assert.equal(docs.get(child.id).fields.origin.stringValue, "child");
  docs.set("old", { name: "/documents/printHandouts/old", fields: { workspaceId: { stringValue: "ws-a" }, templateId: { stringValue: "rika-moon" }, questionText: { stringValue: "古い" }, createdAt: { stringValue: "2026-01-01T00:00:00.000Z" }, params: { mapValue: { fields: {} } } } });
  assert.deepEqual((await store.list("ws-a")).map((item) => [item.id, item.origin]), [["old", "teacher"]]);
  assert.deepEqual((await store.list("ws-a", { includeChild: true })).map((item) => item.origin), ["child", "teacher"]);
});
