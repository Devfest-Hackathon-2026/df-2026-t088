import type { ApiErrorCode, ApiFailure } from "./api-types.ts";

const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_REQUEST: "もういちど、式を入れてみてね",
  TOO_LONG: "長すぎるよ。短くして、もういちど入れてね",
  NOT_SOLVED: "問題が解けてから、話してみてね",
  PARTS_NOT_READY: "この問題は、まだピースにできないみたい。先生にきいてみてね",
  RATE_LIMITED: "少し休んでから、もういちど押してね",
  BUSY: "いま、たくさんの人が使っているよ。少し待ってからもういちど押してね",
  AI_UNAVAILABLE: "いまは、うまく作れないみたい。少し待ってからもういちど押してね",
  TIMEOUT: "思ったより時間がかかっているよ。もういちど押してね",
  INTERNAL: "うまくいかなかったよ。もういちど押してね",
  // 大人に見せる文
  ADULT_INVALID_REQUEST: "入力の内容を確かめてください",
  SCOPE_NOT_ALLOWED: "この役割では、この操作はできません",
  NOT_FOUND: "指定の提案が見つかりません",
  ALREADY_DECIDED: "この提案は決定済みです",
  NOT_ENOUGH_RECORDS: "記録が足りないので、まだ提案を作れません",
  STORE_FULL: "記録がいっぱいで、これ以上は受けられません",
  UNAUTHORIZED: "承認キーが必要か、合っていません",
  PAYLOAD_TOO_LARGE: "送る内容が大きすぎます",
  UNSUPPORTED_MEDIA_TYPE: "JSON で送ってください",
  // 子どもに見せる文（ファーストディスプレイ）
  ASSIGNMENT_NOT_FOUND: "その 出すものは 見つかりませんでした",
  PROGRESS_INVALID_REQUEST: "きろくできませんでした。ゲームを開きなおして、もういちど進んでみてね",
  // 先生の管理の API（#196）
  LOGIN_REQUIRED: "先生のログインが必要です",
  ADULT_ASSIGNMENT_NOT_FOUND: "指定の課題が見つかりません",
  // 先生の役割の管理の API（#351）
  MEMBER_NOT_FOUND: "指定の先生が見つかりません",
  LAST_ADMIN: "最後の管理者は、外せません。先に別の管理者を足してください",
  SELF_REMOVAL: "自分自身は、外せません。ほかの管理者に頼んでください",
  // 学級（ワークスペース）の API
  FORBIDDEN: "この場所からの操作は受けられません。先生の画面から、もういちどやり直してください",
};

const HTTP_STATUS: Record<ApiErrorCode, number> = {
  INVALID_REQUEST: 400, TOO_LONG: 400, NOT_SOLVED: 409, PARTS_NOT_READY: 422,
  RATE_LIMITED: 429, BUSY: 503, AI_UNAVAILABLE: 503, TIMEOUT: 504, INTERNAL: 500,
  ADULT_INVALID_REQUEST: 400, SCOPE_NOT_ALLOWED: 403, NOT_FOUND: 404, ALREADY_DECIDED: 409, NOT_ENOUGH_RECORDS: 422, STORE_FULL: 429,
  UNAUTHORIZED: 401, PAYLOAD_TOO_LARGE: 413, UNSUPPORTED_MEDIA_TYPE: 415,
  ASSIGNMENT_NOT_FOUND: 404,
  PROGRESS_INVALID_REQUEST: 400,
  LOGIN_REQUIRED: 401, ADULT_ASSIGNMENT_NOT_FOUND: 404,
  MEMBER_NOT_FOUND: 404, LAST_ADMIN: 409, SELF_REMOVAL: 409,
  FORBIDDEN: 403,
};

export function apiFailure(code: ApiErrorCode, details?: { field: string; reason: string }[]): { body: ApiFailure; status: number } {
  const error = details ? { code, message: ERROR_MESSAGES[code], details } : { code, message: ERROR_MESSAGES[code] };
  return { body: { error }, status: HTTP_STATUS[code] };
}
