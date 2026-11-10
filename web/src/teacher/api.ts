// 先生の画面（問題の詳細）が使う API。呼び出しの仕組みは research/api.ts と同じ（call を共有する）。
// 形は docs/product/education-api-contract.md「学びの輪の API」。役割は先生（自己申告で、認証ではない）。
import { call, type ApprovedHint, type NamedPattern, type ReadResult, type Suggestion } from "../research/api";
import { CLASS_COPY } from "./copy";
import { getApproverKey } from "./approver-key";

// 直し方を作る（同じ問題と型に未決の提案があれば、それを返す）。記録の数が足りないと、サーバーが断る
export const createProblemSuggestion = (lessonKey: string, problem: string, pattern: NamedPattern, purpose: string) =>
  call<Suggestion>("POST", "/api/v1/suggestions", { role: "teacher", lessonKey, problem, pattern, purpose }, approverHeaders());

// この問題と型で、承認済みの直し方を読む
export const readApprovedFor = (lessonKey: string, problem: string, pattern: NamedPattern) =>
  call<{ items: ApprovedHint[] }>("GET", `/api/v1/approved-hints?${new URLSearchParams({ lessonKey, problem, pattern }).toString()}`, undefined, approverHeaders());

// 先生の管理（SCR-T06〜T08、#196）の API。形は docs/product/education-api-contract.md「先生の管理の API（仮・案。#196）」。
// 書く経路（POST・PUT・DELETE）は、先生のログイン（TEACHER_LOGIN=on）のときだけ通る。エラーは code と details を持つ
const adminBase = (import.meta.env.VITE_LOOP_API_URL as string | undefined) ?? "";

export type AssignmentLink = { kind: "chapterTest"; chapterId: string } | null;
export type AdminAssignment = { id: string; subjectId: string; title: string; dueAt: string; link: AssignmentLink };
export type AssignmentInput = { subjectId: string; title: string; dueAt: string; link: AssignmentLink };
export type TimetablePeriod = { period: number; subjectId: string };
export type TimetableDay = { weekday: number; periods: TimetablePeriod[] };
export type InputDetail = { field: string; reason: string };

export class AdminApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InputDetail[];
  constructor(code: string, status: number, details: InputDetail[]) {
    super(code);
    this.name = "AdminApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const approverHeaders = (): Record<string, string> => getApproverKey().trim() ? { "x-approver-key": getApproverKey() } : {};

async function adminCall<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(adminBase + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(method === "GET" ? approverHeaders() : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AdminApiError("NETWORK", 0, []);
  }
  const json = (await response.json().catch(() => null)) as { error?: { code?: string; details?: InputDetail[] } } | null;
  if (!response.ok) throw new AdminApiError(json?.error?.code ?? "UNKNOWN", response.status, json?.error?.details ?? []);
  return json as T;
}

const assignmentPath = (id: string) => `/api/v1/teacher/assignments/${encodeURIComponent(id)}`;

export const listAdminAssignments = () =>
  adminCall<{ now: string; assignments: AdminAssignment[] }>("GET", "/api/v1/teacher/assignments");
export const createAssignment = (input: AssignmentInput) =>
  adminCall<{ assignment: AdminAssignment }>("POST", "/api/v1/teacher/assignments", input);
export const updateAssignment = (id: string, input: AssignmentInput) =>
  adminCall<{ assignment: AdminAssignment }>("PUT", assignmentPath(id), input);
export const removeAssignment = (id: string) =>
  adminCall<{ id: string; removedSubmissions: number }>("DELETE", assignmentPath(id));
// 出した数（n/30）は、提出の状況の API から読む（課題の一覧には入らない）
export const readSubmissionCounts = () =>
  adminCall<{ now: string; classSize: number; assignments: { id: string; submittedCount: number }[] }>("GET", "/api/v1/teacher/submissions");

// 子どもの進み（仮）。学級の全員を番号順に。done は章ごとの終えた数、squares は終えた位置
export type ProgressStudent = { number: string; lastStudiedOn: string | null; done: Record<string, number>; squares: Record<string, number[]> };
export const readClassProgress = () => adminCall<{ now: string; students: ProgressStudent[] }>("GET", "/api/v1/teacher/progress");

export const readTimetable = () =>
  adminCall<{ now: string; days: TimetableDay[]; subjects: string[] }>("GET", "/api/v1/teacher/timetable");

export type PrintDemand = { unitId: string; unitName: string; count: number };
export const readPrintDemand = () =>
  adminCall<{ items: PrintDemand[] }>("GET", "/api/v1/print/demand");

export const saveTimetable = (days: TimetableDay[]) =>
  adminCall<{ now: string; days: TimetableDay[] }>("PUT", "/api/v1/teacher/timetable", { days });

// 章のテストとつなぐときに選べる章（サーバーの写し。正本は web の教材データ。選べない章の id は 400 で断られる）
export const readLinkOptions = () =>
  adminCall<{ now: string; chapters: { chapterId: string; name: string }[] }>("GET", "/api/v1/teacher/link-options");

// 学級のようす（SCR-T10）の「詰まっている問題」。summary に期間を付けて読む（契約の案。#235）
export const readSummary = (period: "today" | "7days") =>
  call<ReadResult>("POST", "/api/v1/stumbles/query", { role: "teacher", scope: "summary", purpose: CLASS_COPY.purpose, period }, approverHeaders());

// 先生の役割の管理（SCR-T12、#351）。形は docs/product/education-api-contract.md「先生の役割の管理の API」。管理者のログインだけが使える
export type MemberRole = "admin" | "teacher";
export type TeacherMember = { email: string; role: MemberRole };
export type TeacherMe = { enabled: boolean; signedIn: boolean; role?: MemberRole };

export const readTeacherMe = () => adminCall<TeacherMe>("GET", "/api/v1/teacher/me");
export const listTeacherMembers = () => adminCall<{ members: TeacherMember[]; self: string }>("GET", "/api/v1/teacher/members");
export const saveTeacherMember = (member: TeacherMember) => adminCall<{ member: TeacherMember }>("POST", "/api/v1/teacher/members", member);
export const removeTeacherMember = (email: string) => adminCall<{ email: string }>("DELETE", `/api/v1/teacher/members/${encodeURIComponent(email)}`);
