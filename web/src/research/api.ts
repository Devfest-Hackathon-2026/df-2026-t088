// 学びの輪の API を呼ぶ。形は docs/product/education-api-contract.md「学びの輪の API」（仮・案）と同じ。
// 開発中は vite の proxy が /api を server へ送る。別の場所の server を使うときは VITE_LOOP_API_URL に書く。

export type Role = "teacher" | "researcher";
export type Scope = "summary" | "records";
/** 間違い方の型。答えの形が規則表に合ったことを示すだけで、原因ではない（docs/product/education-api-contract.md） */
export type NamedPattern = "sum-both" | "sum-num-only" | "same-den-sum" | "lever-same-weight" | "lever-inverse";
export type ErrorPattern = NamedPattern | "unclassified";
export const NAMED_PATTERNS: NamedPattern[] = ["sum-both", "sum-num-only", "same-den-sum", "lever-same-weight", "lever-inverse"];
export const ALL_PATTERNS: ErrorPattern[] = [...NAMED_PATTERNS, "unclassified"];

/** デモで押す「分かんない」の問題。ダミーで、固定 */
export const DEMO_PROBLEM = { lessonKey: "main-6", problem: "1/3+1/4" } as const;

export type SummaryItem = { chapterId: string; lessonKey: string; problem: string; count: number; patterns: { pattern: ErrorPattern; count: number }[] };
export type RecordItem = { lessonKey: string; problem: string; hintsShown: number; occurredOn: string; source: string };
export type ReadResult = { scope: "summary"; items: SummaryItem[] } | { scope: "records"; items: RecordItem[] };
export type RegionSummaryItem = { lessonKey: string; problem: string; pattern: ErrorPattern; count: number };
export type Suggestion = {
  id: string; status: "pending" | "approved" | "rejected" | "revoked"; generatedBy: "table" | "gemini";
  aiFallback?: "check_failed" | "timeout" | "error";
  candidates: { number: number; source: "gemini" | "table"; hint: string; passed: boolean; reason?: string }[];
  selectedCandidateNumber?: number;
  lessonKey: string; problem: string; pattern: NamedPattern; replacesHintIndex: number; hint: string; basis: { count: number };
};
export type ApprovedHint = { pattern: NamedPattern; replacesHintIndex: number; hint: string };
export type AuditEntry = {
  id: number; at: string; role: Role; action: "query" | "suggest" | "decide" | "revoke" | "audit-read";
  targetId: string | null; detail: string | null; reason: string | null; result: "allowed" | "denied";
};

/** code は server の失敗の code。つながらないときは NETWORK */
export class ApiError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

const base = (import.meta.env.VITE_LOOP_API_URL as string | undefined) ?? "";

// 先生の画面（src/teacher/）も同じ呼び出しを使う。動きは変えていない
export async function call<T>(method: "GET" | "POST", path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(base + path, {
      method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("NETWORK", "サーバーにつながりません");
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (json as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(error?.code ?? "UNKNOWN", error?.message ?? "うまくいきませんでした");
  }
  return json as T;
}

export const checkHealth = () => call<{ status: string }>("GET", "/api/health");

export const sendStumble = (hintsShown: number, pattern: ErrorPattern) =>
  call<{ received: true }>("POST", "/api/v1/stumbles", {
    ...DEMO_PROBLEM, hintsShown, pattern, source: "demo", occurredAt: new Date().toISOString(),
  });

// 承認キー。サーバーが決めているときだけ要る。空なら付けない。ブラウザーには保存しない（画面の中だけ）
const keyHeader = (key: string): Record<string, string> => (key.trim() ? { "x-approver-key": key } : {});

// 1 件ずつの記録（records）は、サーバーが承認キーを決めているときキーが要る（#279）。まとめはキーなしで読める
export const readStumbles = (role: Role, scope: Scope, purpose: string, approverKey = "") =>
  call<ReadResult>("POST", "/api/v1/stumbles/query", { role, scope, purpose }, keyHeader(approverKey));

export const createSuggestion = (role: Role, pattern: NamedPattern, purpose: string) =>
  call<Suggestion>("POST", "/api/v1/suggestions", { role, ...DEMO_PROBLEM, pattern, purpose });


// candidateNumber は最後に足した（#154）。先生の画面（#169）など、前からの呼び方はそのまま使える
export const decideSuggestion = (id: string, role: Role, decision: "approved" | "rejected", reason: string, approverKey = "", candidateNumber?: number) =>
  call<{ id: string; status: "approved" | "rejected"; replaced: string[] }>("POST", `/api/v1/suggestions/${encodeURIComponent(id)}/decision`, { role, decision, reason, ...(candidateNumber === undefined ? {} : { candidateNumber }) }, keyHeader(approverKey));

export const revokeSuggestion = (id: string, role: Role, reason: string, approverKey = "") =>
  call<{ id: string; status: "revoked" }>("POST", `/api/v1/suggestions/${encodeURIComponent(id)}/revoke`, { role, reason }, keyHeader(approverKey));

export const readApprovedHints = (pattern: NamedPattern) => {
  const query = new URLSearchParams({ lessonKey: DEMO_PROBLEM.lessonKey, problem: DEMO_PROBLEM.problem, pattern });
  return call<{ items: ApprovedHint[] }>("GET", `/api/v1/approved-hints?${query.toString()}`);
};

export const readAuditLog = (role: Role, approverKey = "") =>
  call<{ items: AuditEntry[] }>("GET", `/api/v1/audit-log?role=${role}`, undefined, keyHeader(approverKey));

export const readRegionSummary = (approverKey = "") =>
  call<{ items: RegionSummaryItem[] }>("GET", "/api/v1/loop/region", undefined, keyHeader(approverKey));

// 研究テーマ「ヒントを替えたあと、次の答えは近づいたか」（docs/product/education-api-contract.md）
export type HintVersion = "base" | "approved";
export type NextOutcome = "correct" | "same" | "other";
export type ThemeStage = "collecting" | "proposal" | "approved" | "comparing";
export type ThemeCell = {
  lessonKey: string; problem: string; pattern: NamedPattern; hintVersion: HintVersion;
  count: number; correct: number; same: number; other: number;
};
export type HintEffect = { stage: ThemeStage; comparable: boolean; cells: ThemeCell[] };

export const readHintEffect = (role: Role) => call<HintEffect>("GET", `/api/v1/themes/hint-effect?role=${role}`);

/** ダミーの「ヒントを見たあとの最初の答え」を 1 件送る。測り方の例で、結果ではない */
export const sendAfterHint = (pattern: NamedPattern, hintVersion: HintVersion, next: NextOutcome) =>
  call<{ received: true }>("POST", "/api/v1/after-hints", {
    ...DEMO_PROBLEM, pattern, hintVersion, next, source: "dummy", occurredAt: new Date().toISOString(),
  });
