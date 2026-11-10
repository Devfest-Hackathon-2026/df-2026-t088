// ファーストディスプレイの API の呼び出し。待つのは5秒まで（HM-28）。番号はビルドの設定で固定（ADR-004）
import { readClassCode, saveClassCode } from "../../class-code";
import { currentStudentNumber } from "../../student-number";
import type { AssignmentsResponse, JoinResponse, PrintHandout, PrintHandoutsResponse, SubmissionResponse, TimetableResponse } from "./types";

const apiBase = (import.meta.env.VITE_LOOP_API_URL as string | undefined) ?? "";
export const TIMEOUT_MS = 5_000;
/** 子どもの番号（差し替え口は student-number.ts） */
export const studentNumber = currentStudentNumber;

/** つながらない（offline）と、回数の上限（rate）を分ける */
export class HomeApiError extends Error {
  constructor(readonly kind: "offline" | "rate") {
    super(kind);
    this.name = "HomeApiError";
  }
}

/** 学級コードや説明が無かった（404）。404 を分けて受ける経路だけが投げる */
export class NotFoundError extends Error {
  constructor() {
    super("not-found");
    this.name = "NotFoundError";
  }
}

async function call<T>(method: "GET" | "PUT" | "DELETE", path: string, notFoundIsKind = false): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(apiBase + path, { method, signal: controller.signal });
    if (response.status === 429) throw new HomeApiError("rate");
    if (response.status === 404 && notFoundIsKind) throw new NotFoundError();
    if (!response.ok) throw new HomeApiError("offline");
    return (await response.json()) as T;
  } catch (error) {
    throw error instanceof HomeApiError || error instanceof NotFoundError ? error : new HomeApiError("offline");
  } finally {
    clearTimeout(timer);
  }
}

const submissionPath = (assignmentId: string) =>
  `/api/v1/home/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(studentNumber())}`;

export const readAssignments = () => call<AssignmentsResponse>("GET", `/api/v1/home/assignments?student=${encodeURIComponent(studentNumber())}`);
export const readTimetable = () => call<TimetableResponse>("GET", "/api/v1/home/timetable");
export const submitAssignment = (id: string) => call<SubmissionResponse>("PUT", submissionPath(id));
export const withdrawAssignment = (id: string) => call<SubmissionResponse>("DELETE", submissionPath(id));
export const readPrintHandouts = () => call<PrintHandoutsResponse>("GET", "/api/v1/print/handouts");
/** 学級コードの学級。名前と、配られた説明の一覧。コードの大文字小文字は server が区別しない */
export const readJoin = (code: string) => call<JoinResponse>("GET", `/api/v1/join/${encodeURIComponent(code)}`, true);
/** 配られたリンク 1 件 */
export const readPrintHandout = (id: string) => call<PrintHandout>("GET", `/api/v1/print/handouts/${encodeURIComponent(id)}`, true);

/** classCode と childCapture：学級から読めたときだけ。childCapture が true なら、子どもが自分のプリントを撮れる */
export type HandoutList = { items: PrintHandout[]; className: string | null; classMissing: boolean; classCode: string | null; childCapture: boolean };

// 配られた説明の一覧の出どころ。開いた学級コード、無ければ端末に残したコード、それも無ければ見本の学級（今までと同じ）。
// 残したコードで読めなかったときは、画面が出なくならないよう見本の一覧に戻す
export async function loadHandoutList(classCode: string | undefined): Promise<HandoutList> {
  if (classCode !== undefined) {
    try {
      const joined = await readJoin(classCode);
      saveClassCode(classCode);
      return { items: joined.items, className: joined.name, classMissing: false, classCode, childCapture: joined.childCapture === true };
    } catch (error) {
      if (error instanceof NotFoundError) return { items: [], className: null, classMissing: true, classCode: null, childCapture: false };
      throw error;
    }
  }
  const saved = readClassCode();
  if (saved !== null) {
    try {
      const joined = await readJoin(saved);
      return { items: joined.items, className: joined.name, classMissing: false, classCode: saved, childCapture: joined.childCapture === true };
    } catch {
      // 見本の一覧へ
    }
  }
  return { items: (await readPrintHandouts()).items, className: null, classMissing: false, classCode: null, childCapture: false };
}
