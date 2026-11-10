import { writeFile } from "node:fs/promises";
import { createApp } from "../app.ts";
import type { AiClient } from "../ai/client.ts";
import type { PartsData } from "../check/parts-check.ts";
import { parseExpression } from "../check/expression.ts";
import { LIMITS } from "../limits.ts";
import type { AiSettings } from "../ai/settings.ts";

export type EvalProblem = { id: string; expression: string };
export type EvalItem = {
  id: string;
  expression: string;
  httpStatus: number;
  errorCode?: string;
  aiCalls: number;
  durationMilliseconds: number;
  unitPieceDenominatorMatchesLcm?: boolean;
  hintCount?: number;
};
// どの AI で測ったか。鍵や project は含めない
export type EvalAiInfo = { mode: AiSettings["mode"]; model?: string };
export type PartsEvalReport = {
  ai?: EvalAiInfo;
  summary: {
    total: number;
    succeeded: number;
    successRate: number;
    firstTrySucceeded: number;
    firstTryRate: number;
    retrySucceeded: number;
    retryRate: number;
    codeCounts: Record<string, number>;
    medianMilliseconds: number;
    maxMilliseconds: number;
    lcmMatches: number;
    lcmChecked: number;
    hintCounts: number[];
  };
  results: EvalItem[];
};

type EvalLimits = { [Key in keyof typeof LIMITS]: number };

export async function evaluateParts(
  problems: EvalProblem[],
  client: AiClient,
  options: { environment?: NodeJS.ProcessEnv; limits?: Partial<EvalLimits>; ai?: EvalAiInfo } = {},
): Promise<PartsEvalReport> {
  let aiCalls = 0;
  const countedClient: AiClient = {
    createParts: (expression, signal) => { aiCalls += 1; return client.createParts(expression, signal); },
    createSimilarProblem: (problem, signal) => client.createSimilarProblem(problem, signal),
    createReflection: (input, signal) => client.createReflection(input, signal),
  };
  const app = createApp(countedClient, options.environment ?? {}, options.limits);
  const results: EvalItem[] = [];

  for (const problem of problems) {
    aiCalls = 0;
    const startedAt = performance.now();
    const response = await app.request("/api/v1/parts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expression: problem.expression }),
    });
    const durationMilliseconds = Math.round(performance.now() - startedAt);
    const payload: unknown = await response.json();
    const errorCode = response.status >= 400 && isRecord(payload) && isRecord(payload.error)
      && typeof payload.error.code === "string" ? payload.error.code : undefined;
    const result: EvalItem = {
      id: problem.id,
      expression: problem.expression,
      httpStatus: response.status,
      ...(errorCode ? { errorCode } : {}),
      aiCalls,
      durationMilliseconds,
    };
    if (response.ok && isPartsData(payload)) {
      result.unitPieceDenominatorMatchesLcm = hasLcmUnitPiece(problem.expression, payload);
      result.hintCount = payload.hints.length;
    }
    results.push(result);
  }

  const report = summarize(results);
  return options.ai ? { ai: options.ai, ...report } : report;
}

export function assertEvalAiAllowed(environment: NodeJS.ProcessEnv): void {
  const mode = environment.GEMINI_MODE;
  if ((mode === "developer" || mode === "vertex") && environment.EVAL_ALLOW_REAL_AI !== "1") {
    throw new Error(`GEMINI_MODE=${mode} selects real AI. Set EVAL_ALLOW_REAL_AI=1 to allow paid evaluation calls.`);
  }
}

// 本物のつもりで許可したのにモックに落ちたら、測った数字が別物になるので止める
export function assertEvalSettingsMatchIntent(environment: NodeJS.ProcessEnv, settings: AiSettings): void {
  if (environment.EVAL_ALLOW_REAL_AI === "1" && settings.mode === "mock") {
    throw new Error(
      `EVAL_ALLOW_REAL_AI=1 が指定されていますが、設定がモックになりました（reason: ${settings.reason}）。GEMINI_MODE と GEMINI_MODEL を確かめてください。`,
    );
  }
}

export function describeAiSettings(settings: AiSettings): EvalAiInfo {
  return settings.mode === "mock" ? { mode: "mock" } : { mode: settings.mode, model: settings.model };
}

export async function writeEvalReport(path: string, report: PartsEvalReport): Promise<void> {
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

export function formatEvalTable(report: PartsEvalReport): string {
  const summary = report.summary;
  const pct = (count: number, total: number) => total ? `${(count / total * 100).toFixed(1)}%` : "n/a";
  const codeCounts = Object.entries(summary.codeCounts).map(([code, count]) => `${code}=${count}`).join(", ") || "なし";
  const lcmRate = summary.lcmChecked ? `${summary.lcmMatches}/${summary.lcmChecked}` : "n/a";
  const hintAverage = summary.hintCounts.length
    ? (summary.hintCounts.reduce((sum, count) => sum + count, 0) / summary.hintCounts.length).toFixed(2)
    : "n/a";
  const ai = report.ai ? `${report.ai.mode}${report.ai.model ? ` (${report.ai.model})` : ""}` : undefined;
  return [
    "指標 | 結果",
    "--- | ---",
    ...(ai ? [`測った AI | ${ai}`] : []),
    `成功 | ${summary.succeeded}/${summary.total} (${pct(summary.succeeded, summary.total)})`,
    `1回目で成功 | ${summary.firstTrySucceeded}/${summary.total} (${pct(summary.firstTrySucceeded, summary.total)})`,
    `作り直しで成功 | ${summary.retrySucceeded}/${summary.total} (${pct(summary.retrySucceeded, summary.total)})`,
    `エラー code | ${codeCounts}`,
    `時間 中央値 / 最大 | ${summary.medianMilliseconds} ms / ${summary.maxMilliseconds} ms`,
    `単位分数の分母が最小公倍数 | ${lcmRate}`,
    `成功時のヒント数 平均 | ${hintAverage}`,
  ].join("\n");
}

function summarize(results: EvalItem[]): PartsEvalReport {
  const succeeded = results.filter((result) => result.httpStatus === 200);
  const firstTrySucceeded = succeeded.filter((result) => result.aiCalls === 1).length;
  const retrySucceeded = succeeded.filter((result) => result.aiCalls > 1).length;
  const codeCounts: Record<string, number> = {};
  for (const result of results) {
    const code = result.errorCode ?? (result.httpStatus < 400 ? "OK" : `HTTP_${result.httpStatus}`);
    codeCounts[code] = (codeCounts[code] ?? 0) + 1;
  }
  const durations = results.map(({ durationMilliseconds }) => durationMilliseconds).sort((a, b) => a - b);
  const medianMilliseconds = median(durations);
  const lcmResults = succeeded.filter((result) => result.unitPieceDenominatorMatchesLcm !== undefined);
  return {
    summary: {
      total: results.length,
      succeeded: succeeded.length,
      successRate: ratio(succeeded.length, results.length),
      firstTrySucceeded,
      firstTryRate: ratio(firstTrySucceeded, results.length),
      retrySucceeded,
      retryRate: ratio(retrySucceeded, results.length),
      codeCounts,
      medianMilliseconds,
      maxMilliseconds: durations.at(-1) ?? 0,
      lcmMatches: lcmResults.filter((result) => result.unitPieceDenominatorMatchesLcm).length,
      lcmChecked: lcmResults.length,
      hintCounts: succeeded.flatMap((result) => result.hintCount === undefined ? [] : [result.hintCount]),
    },
    results,
  };
}

// 昇順に並んだ値の中央値。偶数個のときは真ん中2つの平均（四捨五入）
export function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function hasLcmUnitPiece(expression: string, data: PartsData): boolean {
  const parsed = parseExpression(expression);
  if (!parsed.ok) return false;
  const { left, right } = parsed.expression;
  const gcd = greatestCommonDivisor(left.den, right.den);
  const lcm = left.den / gcd * right.den;
  return data.pieces.some((piece) => piece.num === 1 && piece.den === lcm);
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = left;
  let b = right;
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function ratio(count: number, total: number): number {
  return total ? count / total : 0;
}

function isPartsData(value: unknown): value is PartsData {
  return isRecord(value) && typeof value.problem === "string" && Array.isArray(value.pieces)
    && Array.isArray(value.hints) && value.hints.every((hint) => typeof hint === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
