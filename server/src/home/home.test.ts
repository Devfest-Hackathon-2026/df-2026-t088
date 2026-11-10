import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.ts";
import { createHomeStore } from "./store.ts";
import { jstDayStart, seedAssignments, seedTimetable, toJstIso } from "./seed.ts";

type Body = Record<string, unknown>;
// 2026-11-09（月）10:00 日本時間
const START = Date.parse("2026-11-09T10:00:00+09:00");

function makeApp(options: { now?: () => number; env?: NodeJS.ProcessEnv; limits?: Record<string, number> } = {}) {
  const now = options.now ?? (() => START);
  return createApp(undefined, options.env ?? {}, options.limits ?? {}, undefined, { now, homeStore: createHomeStore({ now }) });
}
type App = ReturnType<typeof makeApp>;

async function send(app: App, method: string, path: string, headers: Record<string, string> = {}) {
  const response = await app.request(path, { method, headers });
  return { status: response.status, json: (await response.json()) as Body };
}
const code = (json: Body) => (json.error as { code: string }).code;
const assignmentsOf = (json: Body) => json.assignments as Body[];

test("期日は起動した日の 0:00（日本時間）から数え、時刻まで持つ", () => {
  // 日本時間の 0:30 は UTC では前の日。日付は日本時間で決める
  const lateNight = Date.parse("2026-11-09T00:30:00+09:00");
  assert.equal(toJstIso(jstDayStart(lateNight)), "2026-11-09T00:00:00+09:00");
  const dues = seedAssignments(lateNight).map((assignment) => assignment.dueAt);
  assert.deepEqual(dues, [
    "2026-11-08T08:30:00+09:00", "2026-11-09T08:30:00+09:00", "2026-11-09T15:00:00+09:00",
    "2026-11-10T08:30:00+09:00", "2026-11-12T08:30:00+09:00", "2026-11-14T08:30:00+09:00",
  ]);
  assert.deepEqual(seedAssignments(START).map((assignment) => assignment.dueAt), dues);
});

test("見本の時間割は月〜金、水だけ5コマで週29コマ", () => {
  const days = seedTimetable();
  assert.deepEqual(days.map((day) => day.weekday), [1, 2, 3, 4, 5]);
  assert.deepEqual(days.map((day) => day.periods.length), [6, 6, 5, 6, 6]);
  const count = (id: string) => days.flatMap((day) => day.periods).filter((period) => period.subjectId === id).length;
  assert.equal(count("kokugo"), 5);
  assert.equal(count("sansu"), 5);
});

test("提出物を読むと、その番号の出した時刻が付く。番号の外は受けない", async () => {
  const app = makeApp();
  const read = await send(app, "GET", "/api/v1/home/assignments?student=A-01");
  assert.equal(read.status, 200);
  assert.equal(read.json.now, "2026-11-09T10:00:00+09:00");
  assert.equal(assignmentsOf(read.json).length, 6);
  assert.ok(assignmentsOf(read.json).every((assignment) => assignment.submittedAt === null));
  for (const student of ["", "A-31", "a-01", "A-1", "B-01"]) {
    const bad = await send(app, "GET", `/api/v1/home/assignments?student=${student}`);
    assert.equal(bad.status, 400, student);
    assert.equal(code(bad.json), "INVALID_REQUEST");
  }
});

test("出すと時刻が付き、もう一度出しても最初の時刻のまま。取り消すと消える", async () => {
  let now = START;
  const app = makeApp({ now: () => now });
  const first = await send(app, "PUT", "/api/v1/home/assignments/hw-lever-print/submissions/A-01");
  assert.equal(first.status, 200);
  assert.deepEqual(first.json, { assignmentId: "hw-lever-print", studentNumber: "A-01", submittedAt: "2026-11-09T10:00:00+09:00", late: false });
  now += 60_000;
  const again = await send(app, "PUT", "/api/v1/home/assignments/hw-lever-print/submissions/A-01");
  assert.equal(again.json.submittedAt, "2026-11-09T10:00:00+09:00");
  const read = await send(app, "GET", "/api/v1/home/assignments?student=A-01");
  const lever = assignmentsOf(read.json).find((assignment) => assignment.id === "hw-lever-print");
  assert.equal(lever?.submittedAt, "2026-11-09T10:00:00+09:00");
  // ほかの番号には出ない（子どもの画面は自分の状況だけ）
  const other = await send(app, "GET", "/api/v1/home/assignments?student=A-02");
  assert.ok(assignmentsOf(other.json).every((assignment) => assignment.submittedAt === null));
  const withdrawn = await send(app, "DELETE", "/api/v1/home/assignments/hw-lever-print/submissions/A-01");
  assert.deepEqual(withdrawn.json, { assignmentId: "hw-lever-print", studentNumber: "A-01", submittedAt: null, late: false });
  // 記録が無くても成功
  const twice = await send(app, "DELETE", "/api/v1/home/assignments/hw-lever-print/submissions/A-01");
  assert.equal(twice.status, 200);
});

test("期日を過ぎて出すと late。無い提出物は ASSIGNMENT_NOT_FOUND", async () => {
  const app = makeApp();
  const late = await send(app, "PUT", "/api/v1/home/assignments/hw-kanji-12/submissions/A-01");
  assert.equal(late.json.late, true);
  const missing = await send(app, "PUT", "/api/v1/home/assignments/hw-none/submissions/A-01");
  assert.equal(missing.status, 404);
  assert.equal(code(missing.json), "ASSIGNMENT_NOT_FOUND");
  const badNumber = await send(app, "PUT", "/api/v1/home/assignments/hw-kanji-12/submissions/A-99");
  assert.equal(code(badNumber.json), "INVALID_REQUEST");
});

test("先生の提出の状況は、出した数・出していない人・おくれた人を期日の順に返す", async () => {
  const app = makeApp();
  await send(app, "PUT", "/api/v1/home/assignments/hw-kanji-12/submissions/A-01");
  await send(app, "PUT", "/api/v1/home/assignments/hw-lever-print/submissions/A-02");
  const status = await send(app, "GET", "/api/v1/teacher/submissions");
  assert.equal(status.status, 200);
  assert.equal(status.json.classSize, 30);
  const rows = assignmentsOf(status.json);
  assert.deepEqual(rows.map((row) => row.id), ["hw-kanji-12", "hw-fraction-print", "hw-lever-print", "hw-history-report", "hw-sewing-plan", "hw-dream-card"]);
  assert.equal(rows[0]?.submittedCount, 1);
  assert.deepEqual(rows[0]?.late, ["A-01"]);
  assert.equal((rows[0]?.notSubmitted as string[]).length, 29);
  assert.ok(!(rows[0]?.notSubmitted as string[]).includes("A-01"));
  assert.deepEqual(rows[2]?.late, []);
  assert.equal(rows[1]?.submittedCount, 0);
});

test("承認キーを決めると、先生の提出の状況にキーが要る", async () => {
  const app = makeApp({ env: { LOOP_APPROVER_KEY: "secret-key" } });
  const none = await send(app, "GET", "/api/v1/teacher/submissions");
  assert.equal(none.status, 401);
  assert.equal(code(none.json), "UNAUTHORIZED");
  const wrong = await send(app, "GET", "/api/v1/teacher/submissions", { "x-approver-key": "nope" });
  assert.equal(wrong.status, 401);
  const right = await send(app, "GET", "/api/v1/teacher/submissions", { "x-approver-key": "secret-key" });
  assert.equal(right.status, 200);
  // 子どもの側の API にはキーが要らない
  const child = await send(app, "GET", "/api/v1/home/assignments?student=A-01");
  assert.equal(child.status, 200);
});

test("出す・取り消すは、ほかの API と別に数える", async () => {
  const app = makeApp({ limits: { requestsPerMinute: 2, submissionRequestsPerMinute: 3 } });
  const path = "/api/v1/home/assignments/hw-kanji-12/submissions/A-01";
  for (let index = 0; index < 3; index += 1) assert.equal((await send(app, "PUT", path)).status, 200);
  assert.equal(code((await send(app, "PUT", path)).json), "RATE_LIMITED");
  // 読む方はまだ通る
  assert.equal((await send(app, "GET", "/api/v1/home/timetable")).status, 200);
  assert.equal((await send(app, "GET", "/api/v1/home/timetable")).status, 200);
  assert.equal((await send(app, "GET", "/api/v1/home/timetable")).status, 429);
});
