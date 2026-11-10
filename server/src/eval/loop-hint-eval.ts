import { writeFile } from "node:fs/promises";
import { checkLoopHint, type LoopHintFailure } from "../loop/check-hint.ts";
import type { NamedPattern } from "../loop/hint-table.ts";

export type LoopHintEvalInput = { pattern: NamedPattern; operator: "+" | "-"; problem: string };
export type LoopHintExample = {
  pattern: NamedPattern;
  operator: "+" | "-";
  problem: string;
  accepted: boolean;
  reason?: LoopHintFailure | "error";
  hint: string;
};
export type LoopHintEvalGroup = {
  pattern: NamedPattern;
  operator: "+" | "-";
  tried: number;
  passed: number;
  failures: Partial<Record<LoopHintFailure | "error", number>>;
};
export type LoopHintEvalReport = {
  repetitions: number;
  evaluatedAt?: string;
  ai?: { mode: "mock" | "developer" | "vertex"; model?: string };
  groups: LoopHintEvalGroup[];
  examples: LoopHintExample[];
};

export async function evaluateLoopHints(
  inputs: LoopHintEvalInput[],
  client: { draftLoopHint?: (input: { pattern: NamedPattern; operator: "+" | "-" }, signal: AbortSignal) => Promise<string> },
  options: { repetitions?: number; timeoutMilliseconds?: number } = {},
): Promise<LoopHintEvalReport> {
  const repetitions = options.repetitions ?? 20;
  if (!Number.isSafeInteger(repetitions) || repetitions < 1) throw new Error("試行回数は正の整数にしてください。");
  if (!client.draftLoopHint) throw new Error("AI クライアントに直し方の下書き機能がありません。");

  const groups: LoopHintEvalGroup[] = [];
  const examples: LoopHintExample[] = [];
  for (const item of inputs) {
    const group: LoopHintEvalGroup = { pattern: item.pattern, operator: item.operator, tried: 0, passed: 0, failures: {} };
    groups.push(group);
    for (let index = 0; index < repetitions; index += 1) {
      let hint = "";
      let reason: LoopHintFailure | "error" | undefined;
      try {
        hint = await client.draftLoopHint(item, AbortSignal.timeout(options.timeoutMilliseconds ?? 10_000));
        const checked = checkLoopHint(hint, item.operator, item.problem);
        if (!checked.ok) reason = checked.reason;
      } catch {
        reason = "error";
      }
      const accepted = reason === undefined;
      group.tried += 1;
      if (accepted) group.passed += 1;
      else {
        const failure = reason ?? "error";
        group.failures[failure] = (group.failures[failure] ?? 0) + 1;
      }
      examples.push({ pattern: item.pattern, operator: item.operator, problem: item.problem, accepted, ...(reason ? { reason } : {}), hint });
    }
  }
  return { repetitions, groups, examples };
}

export async function writeLoopHintEvalReport(path: string, report: LoopHintEvalReport): Promise<void> {
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

export function formatLoopHintTable(report: LoopHintEvalReport): string {
  const rows = [
    "型 | 演算 | 試した数 | 通った数 | 落ちた理由ごとの数",
    "--- | --- | ---: | ---: | ---",
    ...report.groups.map((group) => `${group.pattern} | ${group.operator} | ${group.tried} | ${group.passed} | ${formatFailures(group.failures)}`),
    "",
    "文の例（各型・演算から最大3件）",
    "型 | 演算 | 検査 | 理由 | 文",
    "--- | --- | --- | --- | ---",
  ];
  const counts = new Map<string, number>();
  for (const example of report.examples) {
    const key = `${example.pattern}|${example.operator}`;
    const count = counts.get(key) ?? 0;
    if (count >= 3) continue;
    counts.set(key, count + 1);
    rows.push(`${example.pattern} | ${example.operator} | ${example.accepted ? "通過" : "失敗"} | ${example.reason ?? "なし"} | ${example.hint.replaceAll("|", "\\|")}`);
  }
  return rows.join("\n");
}

function formatFailures(failures: LoopHintEvalGroup["failures"]): string {
  const entries = Object.entries(failures).sort(([left], [right]) => left.localeCompare(right));
  return entries.length ? entries.map(([reason, count]) => `${reason}=${count}`).join(", ") : "なし";
}
