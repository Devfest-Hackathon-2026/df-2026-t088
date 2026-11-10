import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.ts";
import { createHomeStore } from "./store.ts";
import { visibleLength } from "./admin-input.ts";

type Body = Record<string, unknown>;
const START = Date.parse("2026-11-09T10:00:00+09:00");
const JSON_HEADERS = { "content-type": "application/json" };

// signedIn は先生のログインの有無を模す（本物の session は routes の試験で確かめる）
function makeApp(options: { signedIn?: boolean; env?: NodeJS.ProcessEnv } = {}) {
  const now = () => START;
  return createApp(undefined, options.env ?? {}, {}, undefined, {
    now,
    homeStore: createHomeStore({ now }),
    teacherSignedIn: () => options.signedIn ?? false,
  });
}
type App = ReturnType<typeof makeApp>;

async function send(app: App, method: string, path: string, body?: unknown, headers: Record<string, string> = JSON_HEADERS) {
  const response = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, json: (await response.json()) as Body };
}
const code = (json: Body) => (json.error as { code: string }).code;
const details = (json: Body) => (json.error as { details?: { field: string; reason: string }[] }).details;

const VALID = {
  subjectId: "sansu",
  title: "[分数|ぶんすう]のプリント",
  dueAt: "2026-11-10T15:00+09:00",
  link: null,
};

test("先生の書く経路は、先生のログインが無いと通らない（承認キーでも通らない）", async () => {
  const app = makeApp({ env: { LOOP_APPROVER_KEY: "secret-key" } });
  const post = await send(app, "POST", "/api/v1/teacher/assignments", VALID, { ...JSON_HEADERS, "x-approver-key": "secret-key" });
  assert.equal(post.status, 401);
  assert.equal(code(post.json), "LOGIN_REQUIRED");
  const put = await send(app, "PUT", "/api/v1/teacher/timetable", { days: [] });
  assert.equal(code(put.json), "LOGIN_REQUIRED");
  const del = await send(app, "DELETE", "/api/v1/teacher/assignments/hw-kanji-12", undefined, {});
  assert.equal(code(del.json), "LOGIN_REQUIRED");
});

test("先生のログインがあれば、課題を配り、読むと出る。子どもの画面には link が出ない", async () => {
  const app = makeApp({ signedIn: true });
  const created = await send(app, "POST", "/api/v1/teacher/assignments", { ...VALID, link: { kind: "chapterTest", chapterId: "fraction" } });
  assert.equal(created.status, 201);
  const assignment = created.json.assignment as Body;
  assert.match(String(assignment.id), /^hw-[0-9a-f]{8}$/);
  assert.equal(assignment.dueAt, "2026-11-10T15:00:00+09:00");
  assert.deepEqual(assignment.link, { kind: "chapterTest", chapterId: "fraction" });

  const listed = await send(app, "GET", "/api/v1/teacher/assignments", undefined, {});
  const ids = (listed.json.assignments as Body[]).map((item) => item.id);
  assert.ok(ids.includes(assignment.id));

  const child = await send(app, "GET", "/api/v1/home/assignments?student=A-01", undefined, {});
  const mine = (child.json.assignments as Body[]).find((item) => item.id === assignment.id);
  assert.ok(mine);
  assert.equal("link" in (mine as Body), false);
});

test("選べる章の一覧は、写しの章を返す。写しに無い章 id は、形が合っても unknown で弾く", async () => {
  const app = makeApp({ signedIn: true });
  const options = await send(app, "GET", "/api/v1/teacher/link-options", undefined, {});
  assert.equal(options.status, 200);
  assert.deepEqual(options.json.chapters, [
    { chapterId: "fraction", name: "分数" },
    { chapterId: "kokugo-kanji-5", name: "5年の漢字" },
  ]);

  const unknown = await send(app, "POST", "/api/v1/teacher/assignments", { ...VALID, link: { kind: "chapterTest", chapterId: "sansu-5-bunsu" } });
  assert.equal(code(unknown.json), "ADULT_INVALID_REQUEST");
  assert.deepEqual(details(unknown.json), [{ field: "link.chapterId", reason: "unknown" }]);
});

test("入力の検査：字数（ふりがなを除く）、教科、期限の書き方、つながりの形", async () => {
  const app = makeApp({ signedIn: true });
  const tooLong = await send(app, "POST", "/api/v1/teacher/assignments", { ...VALID, title: "あ".repeat(21) });
  assert.equal(tooLong.status, 400);
  assert.equal(code(tooLong.json), "ADULT_INVALID_REQUEST");
  assert.deepEqual(details(tooLong.json), [{ field: "title", reason: "too_long" }]);

  // ふりがなは数えない：「[分数|ぶんすう]」は「分数」の2字
  assert.equal(visibleLength("[分数|ぶんすう]のプリント"), 7);
  assert.equal(visibleLength("[漢字|かんじ]ドリル"), 5);

  const badSubject = await send(app, "POST", "/api/v1/teacher/assignments", { ...VALID, subjectId: "music" });
  assert.deepEqual(details(badSubject.json), [{ field: "subjectId", reason: "unknown" }]);

  const noOffset = await send(app, "POST", "/api/v1/teacher/assignments", { ...VALID, dueAt: "2026-11-10T15:00:00Z" });
  assert.deepEqual(details(noOffset.json), [{ field: "dueAt", reason: "format" }]);

  const unsupported = await send(app, "POST", "/api/v1/teacher/assignments", { ...VALID, link: { kind: "mass", chapterId: "x", key: "main-1" } });
  assert.deepEqual(details(unsupported.json), [{ field: "link", reason: "unsupported" }]);

  const badChapter = await send(app, "POST", "/api/v1/teacher/assignments", { ...VALID, link: { kind: "chapterTest", chapterId: "../etc" } });
  assert.deepEqual(details(badChapter.json), [{ field: "link.chapterId", reason: "format" }]);

  // JSON の形が壊れている本文は、400 で弾く
  const broken = await app.request("/api/v1/teacher/assignments", { method: "POST", headers: JSON_HEADERS, body: "{" });
  assert.equal(broken.status, 400);

  // JSON 以外は受けない
  const plain = await app.request("/api/v1/teacher/assignments", { method: "POST", headers: { "content-type": "text/plain" }, body: "x" });
  assert.equal(plain.status, 415);
});

test("直すと項目が置き換わり、id は変わらない。無い id は ADULT_ASSIGNMENT_NOT_FOUND", async () => {
  const app = makeApp({ signedIn: true });
  const updated = await send(app, "PUT", "/api/v1/teacher/assignments/hw-kanji-12", { ...VALID, title: "[算数|さんすう]のプリント" });
  assert.equal(updated.status, 200);
  const assignment = updated.json.assignment as Body;
  assert.equal(assignment.id, "hw-kanji-12");
  assert.equal(assignment.title, "[算数|さんすう]のプリント");
  assert.equal(assignment.subjectId, "sansu");

  const missing = await send(app, "PUT", "/api/v1/teacher/assignments/hw-none", VALID);
  assert.equal(missing.status, 404);
  assert.equal(code(missing.json), "ADULT_ASSIGNMENT_NOT_FOUND");
});

test("消すと課題と、その課題の出した記録が消える", async () => {
  const app = makeApp({ signedIn: true });
  await send(app, "PUT", "/api/v1/home/assignments/hw-lever-print/submissions/A-01", undefined, {});
  await send(app, "PUT", "/api/v1/home/assignments/hw-lever-print/submissions/A-02", undefined, {});
  const removed = await send(app, "DELETE", "/api/v1/teacher/assignments/hw-lever-print", undefined, {});
  assert.deepEqual(removed.json, { id: "hw-lever-print", removedSubmissions: 2 });

  const status = await send(app, "GET", "/api/v1/teacher/submissions", undefined, {});
  const rows = status.json.assignments as Body[];
  assert.equal(rows.some((row) => row.id === "hw-lever-print"), false);

  const again = await send(app, "DELETE", "/api/v1/teacher/assignments/hw-lever-print", undefined, {});
  assert.equal(code(again.json), "ADULT_ASSIGNMENT_NOT_FOUND");
});

test("時間割は1週間まとめて置き換わる。曜日の重なり・コマの抜け・教科の間違いは弾く", async () => {
  const app = makeApp({ signedIn: true });
  const saved = await send(app, "PUT", "/api/v1/teacher/timetable", {
    days: [
      { weekday: 3, periods: [{ period: 1, subjectId: "kokugo" }] },
      { weekday: 1, periods: [{ period: 1, subjectId: "kokugo" }, { period: 2, subjectId: "sansu" }] },
    ],
  });
  assert.equal(saved.status, 200);
  assert.deepEqual((saved.json.days as Body[]).map((day) => day.weekday), [1, 3]);

  const read = await send(app, "GET", "/api/v1/teacher/timetable", undefined, {});
  assert.equal(read.status, 200);
  assert.equal((read.json.subjects as string[]).length, 13);
  assert.equal((read.json.days as Body[]).length, 2);

  const duplicate = await send(app, "PUT", "/api/v1/teacher/timetable", { days: [{ weekday: 1, periods: [{ period: 1, subjectId: "kokugo" }] }, { weekday: 1, periods: [{ period: 1, subjectId: "kokugo" }] }] });
  assert.deepEqual(details(duplicate.json), [{ field: "days[1].weekday", reason: "duplicate" }]);

  const gap = await send(app, "PUT", "/api/v1/teacher/timetable", { days: [{ weekday: 2, periods: [{ period: 1, subjectId: "kokugo" }, { period: 3, subjectId: "sansu" }] }] });
  assert.deepEqual(details(gap.json), [{ field: "days[0].periods[1].period", reason: "sequence" }]);

  const unknown = await send(app, "PUT", "/api/v1/teacher/timetable", { days: [{ weekday: 2, periods: [{ period: 1, subjectId: "music" }] }] });
  assert.deepEqual(details(unknown.json), [{ field: "days[0].periods[0].subjectId", reason: "unknown" }]);

  const tooMany = await send(app, "PUT", "/api/v1/teacher/timetable", { days: [{ weekday: 2, periods: Array.from({ length: 9 }, (_, index) => ({ period: index + 1, subjectId: "kokugo" })) }] });
  assert.deepEqual(details(tooMany.json), [{ field: "days[0].periods", reason: "too_many" }]);
});

test("承認キーを決めると、先生の読みにキーが要る（書きとは別の決まり）", async () => {
  const app = makeApp({ env: { LOOP_APPROVER_KEY: "secret-key" } });
  const none = await send(app, "GET", "/api/v1/teacher/assignments", undefined, {});
  assert.equal(code(none.json), "UNAUTHORIZED");
  const right = await send(app, "GET", "/api/v1/teacher/timetable", undefined, { "x-approver-key": "secret-key" });
  assert.equal(right.status, 200);
});

test("先生の読み出しは前後の空白を除いた承認キーで照合する", async () => {
  const app = makeApp({ env: { LOOP_APPROVER_KEY: "  secret-key\n" } });
  const response = await send(app, "GET", "/api/v1/teacher/timetable", undefined, { "x-approver-key": "secret-key" });
  assert.equal(response.status, 200);
});
