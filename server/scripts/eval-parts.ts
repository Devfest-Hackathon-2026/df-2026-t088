import { access, constants, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GeminiAiClient } from "../src/ai/gemini-client.ts";
import { MockAiClient } from "../src/ai/mock-client.ts";
import { readAiSettings } from "../src/ai/settings.ts";
import { assertEvalAiAllowed, assertEvalSettingsMatchIntent, describeAiSettings, evaluateParts, formatEvalTable, writeEvalReport, type EvalProblem } from "../src/eval/parts-eval.ts";

async function main(): Promise<void> {
  const environment = process.env;
  // createApp のアクセスログ(console.info)が表に混ざらないよう、ログは stderr へ流す
  console.info = (...values: unknown[]) => console.error(...values);
  assertEvalAiAllowed(environment);
  const arguments_ = parseArguments(process.argv.slice(2));
  // 課金後に結果を失わないよう、書き先は AI を呼ぶ前に確かめる
  const outPath = arguments_.out ? resolve(arguments_.out) : undefined;
  if (outPath) await assertWritable(outPath);
  const dataPath = fileURLToPath(new URL("../eval/problems.json", import.meta.url));
  const problems = JSON.parse(await readFile(dataPath, "utf8")) as EvalProblem[];
  const selected = arguments_.limit === undefined ? problems : problems.slice(0, arguments_.limit);
  if (selected.length === 0) throw new Error("評価する問題が0問です。server/eval/problems.json を確かめてください。");
  const settings = readAiSettings(environment);
  assertEvalSettingsMatchIntent(environment, settings);
  const client = settings.mode === "mock" ? new MockAiClient() : new GeminiAiClient(settings);
  const report = await evaluateParts(selected, client, { environment, ai: describeAiSettings(settings) });
  process.stdout.write(`${formatEvalTable(report)}\n`);
  if (outPath) await writeEvalReport(outPath, report);
  if (report.summary.succeeded !== report.summary.total) process.exitCode = 1;
}

async function assertWritable(path: string): Promise<void> {
  const directory = dirname(path);
  try {
    if (!(await stat(directory)).isDirectory()) throw new Error("not a directory");
    await access(directory, constants.W_OK);
    const existing = await stat(path).catch(() => undefined);
    if (existing?.isDirectory()) throw new Error("is a directory");
    if (existing) await access(path, constants.W_OK);
  } catch {
    throw new Error(`--out の書き先に書き込めません: ${path}`);
  }
}

function parseArguments(arguments_: string[]): { limit?: number; out?: string } {
  const result: { limit?: number; out?: string } = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const option = arguments_[index];
    const value = arguments_[index + 1];
    if ((option !== "--limit" && option !== "--out") || !value || value.startsWith("--")) {
      throw new Error("Usage: npm run eval:parts -- [--limit <n>] [--out <file>]");
    }
    if (option === "--limit") {
      const limit = Number(value);
      if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("--limit must be a positive integer.");
      result.limit = limit;
    } else {
      result.out = value;
    }
    index += 1;
  }
  return result;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
