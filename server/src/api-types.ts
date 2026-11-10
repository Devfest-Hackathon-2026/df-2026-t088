import type { PartsData } from "./check/parts-check.ts";

export type ReflectionInput = {
  problem: string;
  status: "solved";
  message: string;
  history: { role: "ai" | "child"; text: string }[];
};

export type ApiErrorCode =
  | "INVALID_REQUEST" | "TOO_LONG" | "NOT_SOLVED" | "PARTS_NOT_READY"
  | "RATE_LIMITED" | "BUSY" | "AI_UNAVAILABLE" | "TIMEOUT" | "INTERNAL"
  // 学びの輪の API（大人向け）の code
  | "ADULT_INVALID_REQUEST" | "SCOPE_NOT_ALLOWED" | "NOT_FOUND" | "ALREADY_DECIDED" | "NOT_ENOUGH_RECORDS" | "STORE_FULL"
  | "UNAUTHORIZED" | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE"
  // ファーストディスプレイの API（#187）の code。子どもに見せる文
  | "ASSIGNMENT_NOT_FOUND"
  // 子どもの進み（仮）の code。子どもに見せる文（進みの送信だけに使う）
  | "PROGRESS_INVALID_REQUEST"
  // 先生の管理の API（#196）の code。大人に見せる文
  | "LOGIN_REQUIRED" | "ADULT_ASSIGNMENT_NOT_FOUND"
  // 先生の役割の管理の API（#351）の code。大人に見せる文
  | "MEMBER_NOT_FOUND" | "LAST_ADMIN" | "SELF_REMOVAL"
  // 学級（ワークスペース）の API の code。Cookie 付きの書き込みの Origin が合わないとき
  | "FORBIDDEN";

export type ApiFailure = { error: { code: ApiErrorCode; message: string; details?: { field: string; reason: string }[] } };
export type PartsResponse = PartsData;
