// ファーストディスプレイの API（API-001〜005）と、先生の管理の API（#196）。形の正本は docs/product/education-api-contract.md
// 「提出物と時間割の API（仮・案）」「先生の管理の API（仮・案）」。名前の欄は作らない。受ける番号は見本の学級だけ（HM-31）
import { timingSafeEqual } from "node:crypto";
import type { Context, Hono } from "hono";
import type { ApiErrorCode } from "../api-types.ts";
import { apiFailure } from "../errors.ts";
import { checkAssignment, checkTimetable, type InputDetail } from "./admin-input.ts";
import { LINK_CHAPTERS, type LinkChapter } from "./chapters.ts";
import { checkProgress } from "./progress-input.ts";
import { CLASS_NUMBERS, TIMETABLE_SUBJECT_IDS } from "./seed.ts";
import type { HomeStore } from "./store.ts";

const NUMBER_PATTERN = /^[A-Z]-\d{2}$/;

/**
 * 子どもの番号を決める口（仮）。今は、ヘッダー x-student-number の値（形と学級の中かを確かめる）。
 * 公開用は、子どものログインの session から番号を取る関数に差し替える（契約の「番号は session から」）。
 * 差し替えるのはこの関数だけ。web 側は student-number.ts の currentStudentNumber を同じ口として使う。
 */
export const studentNumberFromRequest = (context: Context): string | undefined => context.req.header("x-student-number") ?? undefined;

type HomeOptions = {
  approverKey?: string;
  // 先生のログインが on のときだけ、読みの経路が session を見る
  authorize?: (context: Context) => boolean;
  // 書く経路（先生の管理）の守り。承認キーでは通さない。ログインが off のときは常に false
  teacherSignedIn?: (context: Context) => boolean;
  // 選べる章（link-options）。既定は web の写し。試験では差し替える
  linkChapters?: readonly LinkChapter[];
};

function fail(context: Context, code: ApiErrorCode, details?: InputDetail[]): Response {
  const failure = apiFailure(code, details);
  return context.json(failure.body, failure.status as 400);
}

function sameSecret(given: string, expected: string): boolean {
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** JSON の本文を読む。壊れていれば undefined（検査で弾く） */
async function readJson(context: Context): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}

export function registerHomeRoutes<Env extends object>(app: Hono<Env>, store: HomeStore, options: HomeOptions = {}): void {
  const approverKey = options.approverKey?.trim() || undefined;
  // 先生のログインが on ならログイン、off なら承認キー（決めていなければ通る）。本人確認ではない
  const teacherAllowed = (context: Context): boolean => {
    if (options.authorize) return options.authorize(context);
    return !approverKey || sameSecret(context.req.header("x-approver-key") ?? "", approverKey);
  };
  // 書く経路は、先生のログインだけ（承認キーでは書かせない）
  const teacherWriteAllowed = (context: Context): boolean => (options.teacherSignedIn ? options.teacherSignedIn(context) : false);
  const linkChapters = options.linkChapters ?? LINK_CHAPTERS;
  const validStudent = (number: string | undefined): number is string => !!number && NUMBER_PATTERN.test(number) && store.hasStudent(number);

  app.get("/api/v1/home/assignments", (context) => {
    const student = context.req.query("student");
    if (!validStudent(student)) return fail(context, "INVALID_REQUEST");
    // 子どもの画面には、アプリとのつながり（link）は返さない
    return context.json({
      now: store.now(),
      assignments: store.assignments().map((assignment) => ({
        id: assignment.id,
        subjectId: assignment.subjectId,
        title: assignment.title,
        dueAt: assignment.dueAt,
        submittedAt: store.submittedAt(assignment.id, student),
      })),
    });
  });

  app.get("/api/v1/home/timetable", (context) => context.json({ now: store.now(), days: store.timetable() }));

  const submission = (handler: (assignmentId: string, number: string) => unknown) => (context: Context) => {
    const assignmentId = context.req.param("id") ?? "";
    const number = context.req.param("number");
    if (!validStudent(number)) return fail(context, "INVALID_REQUEST");
    if (!store.findAssignment(assignmentId)) return fail(context, "ASSIGNMENT_NOT_FOUND");
    return context.json(handler(assignmentId, number) as object);
  };
  app.put("/api/v1/home/assignments/:id/submissions/:number", submission((id, number) => store.submit(id, number)));
  app.delete("/api/v1/home/assignments/:id/submissions/:number", submission((id, number) => store.withdraw(id, number)));

  // 子どもの進み（仮）。書くのは子どもの番号の口（studentNumberFromRequest）で決まった子だけ。同じマスは何度送っても1回
  app.post("/api/v1/student/progress", async (context) => {
    const number = studentNumberFromRequest(context);
    if (!validStudent(number)) return fail(context, "PROGRESS_INVALID_REQUEST");
    const checked = checkProgress(await readJson(context));
    if (!checked.ok) return fail(context, "PROGRESS_INVALID_REQUEST", checked.details);
    store.recordSquares(number, checked.value.chapterId, checked.value.squares, Date.parse(store.now()));
    return context.json({ received: true }, 201);
  });

  // 先生の子どもの進み（仮）。学級の全員を番号順に返す（記録が無い人は done が空）。名前は返さない
  app.get("/api/v1/teacher/progress", (context) => {
    if (!teacherAllowed(context)) return fail(context, "UNAUTHORIZED");
    return context.json({ now: store.now(), students: store.classProgress() });
  });

  app.get("/api/v1/teacher/submissions", (context) => {
    if (!teacherAllowed(context)) return fail(context, "UNAUTHORIZED");
    return context.json({ now: store.now(), classSize: CLASS_NUMBERS.length, assignments: store.classStatus() });
  });

  // 先生の管理（#196）。読みは teacherAllowed、書きは先生のログインだけ。順番は、ログイン → 入力の検査 → 課題の有無
  app.get("/api/v1/teacher/assignments", (context) => {
    if (!teacherAllowed(context)) return fail(context, "UNAUTHORIZED");
    return context.json({ now: store.now(), assignments: store.assignments() });
  });

  app.get("/api/v1/teacher/link-options", (context) => {
    if (!teacherAllowed(context)) return fail(context, "UNAUTHORIZED");
    return context.json({ now: store.now(), chapters: linkChapters.map(({ chapterId, name }) => ({ chapterId, name })) });
  });

  app.post("/api/v1/teacher/assignments", async (context) => {
    if (!teacherWriteAllowed(context)) return fail(context, "LOGIN_REQUIRED");
    const checked = checkAssignment(await readJson(context), linkChapters);
    if (!checked.ok) return fail(context, "ADULT_INVALID_REQUEST", checked.details);
    return context.json({ assignment: await store.addAssignment(checked.value) }, 201);
  });

  app.put("/api/v1/teacher/assignments/:id", async (context) => {
    if (!teacherWriteAllowed(context)) return fail(context, "LOGIN_REQUIRED");
    const checked = checkAssignment(await readJson(context), linkChapters);
    if (!checked.ok) return fail(context, "ADULT_INVALID_REQUEST", checked.details);
    const updated = await store.updateAssignment(context.req.param("id") ?? "", checked.value);
    if (!updated) return fail(context, "ADULT_ASSIGNMENT_NOT_FOUND");
    return context.json({ assignment: updated });
  });

  app.delete("/api/v1/teacher/assignments/:id", async (context) => {
    if (!teacherWriteAllowed(context)) return fail(context, "LOGIN_REQUIRED");
    const id = context.req.param("id") ?? "";
    const removed = await store.removeAssignment(id);
    if (!removed) return fail(context, "ADULT_ASSIGNMENT_NOT_FOUND");
    return context.json({ id, removedSubmissions: removed.removedSubmissions });
  });

  app.get("/api/v1/teacher/timetable", (context) => {
    if (!teacherAllowed(context)) return fail(context, "UNAUTHORIZED");
    return context.json({ now: store.now(), days: store.timetable(), subjects: TIMETABLE_SUBJECT_IDS });
  });

  app.put("/api/v1/teacher/timetable", async (context) => {
    if (!teacherWriteAllowed(context)) return fail(context, "LOGIN_REQUIRED");
    const checked = checkTimetable(await readJson(context));
    if (!checked.ok) return fail(context, "ADULT_INVALID_REQUEST", checked.details);
    return context.json({ now: store.now(), days: await store.replaceTimetable(checked.value) });
  });
}

/** 出す・取り消す（回数の制限を別に数える道）。guard.ts が使う */
export function isSubmissionRequest(method: string, path: string): boolean {
  return (method === "PUT" || method === "DELETE") && /^\/api\/v1\/home\/assignments\/[^/]+\/submissions\/[^/]+$/.test(path);
}
