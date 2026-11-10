import { printTemplate, type PrintTemplateId } from "./templates.ts";
import { printDemandUnitId, type PrintDemandUnitId } from "./demand.ts";

export type PrintProblem = { templateId: PrintTemplateId; questionText: string; params: Record<string, unknown>; approved: true };
export type PrintValidation = { problems: PrintProblem[]; unsupportedCount: number; unsupportedUnits: PrintDemandUnitId[]; unreadable: boolean; issues: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePrintOutput(value: unknown): PrintValidation {
  const issues: string[] = [];
  if (!isRecord(value) || !Array.isArray(value.problems)) {
    return { problems: [], unsupportedCount: 0, unsupportedUnits: [], unreadable: false, issues: ["応答の形が違います"] };
  }
  const result: PrintProblem[] = [];
  // issues は「作り直せば直りそうな形の間違い」だけ。型が無い問題や読めない写真は正しい答えなので、作り直さない
  if (!Number.isInteger(value.unsupportedCount) || (value.unsupportedCount as number) < 0) issues.push("不対応数の形が違います");
  let unsupportedCount = Number.isInteger(value.unsupportedCount) && (value.unsupportedCount as number) > 0 ? value.unsupportedCount as number : 0;
  const unsupportedUnits: PrintDemandUnitId[] = [];
  if (value.unreadable !== undefined && typeof value.unreadable !== "boolean") issues.push("読めるかどうかの形が違います");
  const entries = value.problems;
  for (const entry of entries) {
    if (!isRecord(entry)) {
      unsupportedCount += 1;
      issues.push("問題の形が違います");
      continue;
    }
    if (entry.templateId === "none") {
      unsupportedCount += 1;
      unsupportedUnits.push(printDemandUnitId(entry.unit));
      continue;
    }
    const template = printTemplate(entry.templateId);
    if (!template) {
      unsupportedCount += 1;
      issues.push("型の一覧にない問題があります");
      continue;
    }
    const paramsIssues = template.validateParams(entry.params);
    if (typeof entry.questionText !== "string" || !entry.questionText.trim() || entry.questionText.length > 200 || !isRecord(entry.params) || paramsIssues.length) {
      unsupportedCount += 1;
      issues.push(...(paramsIssues.length ? paramsIssues : ["問題の文は1から200字です"]));
      continue;
    }
    // 型の言葉が文に無いのは、型の取り違え。作り直しても同じになりやすいので、作り直しは頼まない
    // 数式だけの型は、言葉の代わりに「式として読めて params と同じ」で確かめる
    const questionOk = template.questionMatches
      ? template.questionMatches(entry.questionText as string, entry.params)
      : template.keywords.some((keyword) => (entry.questionText as string).includes(keyword));
    if (!questionOk) {
      unsupportedCount += 1;
      continue;
    }
    if (result.length >= 6) {
      unsupportedCount += 1;
      continue;
    }
    result.push({ templateId: template.id, questionText: entry.questionText, params: entry.params, approved: true });
  }
  return { problems: result, unsupportedCount, unsupportedUnits, unreadable: value.unreadable === true, issues };
}
