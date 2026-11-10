// 形の正本は docs/product/education-api-contract.md「提出物と時間割の API（仮・案）」
import type { SubjectId } from "../../data";

export type TimetableSubjectId = SubjectId | "doutoku" | "sougou" | "gakkatsu";
export type Assignment = { id: string; subjectId: TimetableSubjectId; title: string; dueAt: string; submittedAt: string | null };
export type Period = { period: number; subjectId: TimetableSubjectId };
export type TimetableDay = { weekday: number; periods: Period[] };
export type AssignmentsResponse = { now: string; assignments: Assignment[] };
export type TimetableResponse = { now: string; days: TimetableDay[] };
export type SubmissionResponse = { assignmentId: string; studentNumber: string; submittedAt: string | null; late: boolean };
export type PrintHandout = { id: string; templateId: "rika-lever" | "rika-moon" | "sansu-fraction-addsub"; questionText: string; params: Record<string, unknown>; createdAt: string;
  /** 先生の一覧だけに付く。child は子どもが撮った説明（先生は確かめていない） */
  origin?: "teacher" | "child" };
export type PrintHandoutsResponse = { items: PrintHandout[] };
/** GET /api/v1/join/{code}（学級コードで開く。契約書「学級（ワークスペース）の API」） */
export type JoinResponse = { name: string; childCapture?: boolean; items: PrintHandout[] };
