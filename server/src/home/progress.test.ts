import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.ts";
import { createHomeStore } from "./store.ts";

type Body = Record<string, unknown>;
const START = Date.parse("2026-11-09T10:00:00+09:00");

function makeApp(env: NodeJS.ProcessEnv = {}) {
  const now = () => START;
  return createApp(undefined, env, {}, undefined, { now, homeStore: createHomeStore({ now }) });
}
type App = ReturnType<typeof makeApp>;

async function call(app: App, method: string, path: string, options: { student?: string; body?: unknown; key?: string } = {}) {
  const headers: Record<string, string> = {};
  if (options.student !== undefined) headers["x-student-number"] = options.student;
  if (options.key !== undefined) headers["x-approver-key"] = options.key;
  let body: string | undefined;
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await app.request(path, { method, headers, body });
  return { status: response.status, json: (await response.json()) as Body };
}
const code = (json: Body) => (json.error as { code: string }).code;
type Row = { number: string; lastStudiedOn: string | null; done: Record<string, number>; squares: Record<string, number[]> };
const rowOf = (json: Body, number: string) => (json.students as Row[]).find((row) => row.number === number);

test("子どもは、自分の番号で、終えたマスを送れる（201）。先生は番号順に読める", async () => {
  const app = makeApp();
  const sent = await call(app, "POST", "/api/v1/student/progress", { student: "A-01", body: { chapterId: "decimal", squares: [0, 1, 2] } });
  assert.equal(sent.status, 201);
  assert.deepEqual(sent.json, { received: true });

  const read = await call(app, "GET", "/api/v1/teacher/progress");
  assert.equal(read.status, 200);
  assert.equal((read.json.students as Row[]).length, 30);
  assert.equal((read.json.students as Row[])[0]?.number, "A-01");
  const row = rowOf(read.json, "A-01");
  assert.deepEqual(row?.done, { decimal: 3 });
  assert.deepEqual(row?.squares, { decimal: [0, 1, 2] });
  assert.equal(row?.lastStudiedOn, "2026-11-09");
});

test("同じマスを何度送っても1回と数える。記録が無い人は done が空で、最後に学んだ日は null", async () => {
  const app = makeApp();
  await call(app, "POST", "/api/v1/student/progress", { student: "A-02", body: { chapterId: "integer", squares: [0, 1] } });
  await call(app, "POST", "/api/v1/student/progress", { student: "A-02", body: { chapterId: "integer", squares: [1, 2] } });
  const read = await call(app, "GET", "/api/v1/teacher/progress");
  assert.deepEqual(rowOf(read.json, "A-02")?.done, { integer: 3 });
  assert.deepEqual(rowOf(read.json, "A-03"), { number: "A-03", lastStudiedOn: null, done: {}, squares: {} });
});

test("番号が無い・学級に無い番号は PROGRESS_INVALID_REQUEST（子どもに見せる文）", async () => {
  const app = makeApp();
  const body = { chapterId: "decimal", squares: [0] };
  assert.equal(code((await call(app, "POST", "/api/v1/student/progress", { body })).json), "PROGRESS_INVALID_REQUEST");
  assert.equal(code((await call(app, "POST", "/api/v1/student/progress", { student: "Z-99", body })).json), "PROGRESS_INVALID_REQUEST");
});

test("章の id・マスの位置・件数の形が違えば PROGRESS_INVALID_REQUEST", async () => {
  const app = makeApp();
  const student = "A-04";
  const cases: unknown[] = [
    { chapterId: "Decimal!", squares: [0] },
    { chapterId: "decimal", squares: [] },
    { chapterId: "decimal", squares: [200] },
    { chapterId: "decimal", squares: [1.5] },
    { chapterId: "decimal", squares: "0" },
    [],
  ];
  for (const body of cases) {
    assert.equal(code((await call(app, "POST", "/api/v1/student/progress", { student, body })).json), "PROGRESS_INVALID_REQUEST");
  }
});

test("先生の読み出しは、承認キーが決まっていれば、キーが無いと UNAUTHORIZED", async () => {
  const app = makeApp({ LOOP_APPROVER_KEY: "secret-key" });
  assert.equal(code((await call(app, "GET", "/api/v1/teacher/progress")).json), "UNAUTHORIZED");
  const ok = await call(app, "GET", "/api/v1/teacher/progress", { key: "secret-key" });
  assert.equal(ok.status, 200);
});
