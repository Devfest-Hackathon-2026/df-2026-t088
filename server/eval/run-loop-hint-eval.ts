import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GeminiAiClient } from "../src/ai/gemini-client.ts";
import { MockAiClient } from "../src/ai/mock-client.ts";
import { readAiSettings } from "../src/ai/settings.ts";
import { assertEvalAiAllowed, assertEvalSettingsMatchIntent, describeAiSettings } from "../src/eval/parts-eval.ts";
import { evaluateLoopHints, formatLoopHintTable, writeLoopHintEvalReport, type LoopHintEvalInput } from "../src/eval/loop-hint-eval.ts";

async function main(): Promise<void> {
  const environment = process.env;
  console.info = (...values: unknown[]) => console.error(...values);
  const forceMock = process.argv.includes("--mock");
  assertEvalAiAllowed(forceMock ? {} : environment);
  const outputArgument = process.argv.slice(2).find((value) => value !== "--mock");
  const outputPath = resolve(outputArgument ?? "eval/results/loop-hint-mock.json");
  const casesPath = fileURLToPath(new URL("./loop-hint-cases.json", import.meta.url));
  const inputs = JSON.parse(await readFile(casesPath, "utf8")) as LoopHintEvalInput[];
  const settings = readAiSettings(forceMock ? {} : environment);
  assertEvalSettingsMatchIntent(environment, settings);
  const client = settings.mode === "mock" ? new MockAiClient() : new GeminiAiClient(settings);
  const report = await evaluateLoopHints(inputs, client);
  report.evaluatedAt = new Date().toISOString();
  report.ai = describeAiSettings(settings);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeLoopHintEvalReport(outputPath, report);
  const table = formatLoopHintTable(report);
  const tablePath = outputPath.replace(/\.json$/u, ".md");
  await writeFile(tablePath, `# 直し方の下書きの評価\n\n日時: ${report.evaluatedAt}\nAI: ${JSON.stringify(report.ai)}\n\n${table}\n`, "utf8");
  process.stdout.write(`${table}\n\nJSON: ${outputPath}\n表: ${tablePath}\n日時: ${report.evaluatedAt}\nAI: ${JSON.stringify(report.ai)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
