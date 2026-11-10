import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AiClient, PrintReadInput } from "../src/ai/client.ts";
import { GeminiAiClient } from "../src/ai/gemini-client.ts";
import { MockAiClient } from "../src/ai/mock-client.ts";
import { readAiSettings } from "../src/ai/settings.ts";
import { assertEvalAiAllowed, assertEvalSettingsMatchIntent, describeAiSettings } from "../src/eval/parts-eval.ts";
import { validatePrintOutput } from "../src/print/validate.ts";
import { printTemplate } from "../src/print/templates.ts";

export type PrintTemplateId = "rika-lever" | "rika-moon" | "sansu-fraction-addsub";
export type PrintEvalCategory = "figure-only" | "paraphrase" | "multi" | "moon-figure" | "decoy" | "single" | "mixed" | "unsupported";
export type PrintEvalExpected =
  | { templateId: "rika-lever"; params: { left: { pos: number; g: number }; right: { pos: number } } }
  | { templateId: "sansu-fraction-addsub"; params: { left: { num: number; den: number }; op: "+" | "-"; right: { num: number; den: number } } }
  | { templateId: "rika-moon"; params: Record<string, never> }
  | { templateId: null };
export type PrintEvalCase = {
  id: string;
  version: "normal" | "dark" | "tilted" | "shadow" | "photo";
  imagePath: string;
  expected: PrintEvalExpected;
  category?: PrintEvalCategory;
  kind?: string;
  device?: string;
  conditions?: string[];
};
export type PrintEvalResult = {
  id: string;
  version: PrintEvalCase["version"];
  expectedTemplateId: PrintTemplateId | null;
  templateCorrect: boolean;
  numberCorrect?: boolean;
  droppedCorrect?: boolean;
  validatedMisread?: boolean;
  device?: string;
  conditions?: string[];
  category?: PrintEvalCategory;
  kind?: string;
  elapsedMs: number;
  error?: boolean;
};
export type PrintEvalMetrics = {
  total: number;
  templateScored: number;
  templateCorrect: number;
  templateAccuracy: number;
  numberScored: number;
  numberCorrect: number;
  numberAccuracy: number;
  validatedMisread: number;
  unsupportedScored: number;
  unsupportedCorrect: number;
  unsupportedRecall: number;
  durationMedianMs: number;
  durationP95Ms: number;
};
export type PrintEvalReport = {
  evaluatedAt?: string;
  source: "mock" | "gemini";
  ai?: ReturnType<typeof describeAiSettings>;
  summary: PrintEvalMetrics;
  byVersion: Record<PrintEvalCase["version"], PrintEvalMetrics>;
  byDevice: Record<string, PrintEvalMetrics>;
  byCondition: Record<string, PrintEvalMetrics>;
  byCategory: Record<string, PrintEvalMetrics>;
  results: PrintEvalResult[];
};

type PrintOutput = {
  problems?: unknown;
  unsupportedCount?: unknown;
};

export async function evaluatePrint(
  client: Pick<AiClient, "readPrint">,
  cases: readonly PrintEvalCase[],
  source: PrintEvalReport["source"],
  readImage: (imagePath: string) => Promise<Uint8Array> = async (imagePath) => new Uint8Array(await readFile(imagePath)),
): Promise<PrintEvalReport> {
  if (!client.readPrint) throw new Error("AI クライアントにプリント読み取り機能がありません。");
  const results: PrintEvalResult[] = [];
  for (const item of cases) {
    const started = performance.now();
    let output: unknown;
    let error = false;
    try {
      const bytes = await readImage(item.imagePath);
      const input: PrintReadInput = { image: { mimeType: "image/jpeg", data: Buffer.from(bytes).toString("base64") } };
      output = await client.readPrint(input, AbortSignal.timeout(30_000));
      output = validatePrintOutput(output);
    } catch {
      // 例外内容に読み取った文などが含まれることがあるため、評価結果にも出さない
      error = true;
    }
    const elapsedMs = Math.round((performance.now() - started) * 100) / 100;
    results.push(scoreResult(item, output, elapsedMs, error));
  }

  return {
    source,
    summary: summarize(results),
    byVersion: {
      normal: summarize(results.filter((result) => result.version === "normal")),
      dark: summarize(results.filter((result) => result.version === "dark")),
      tilted: summarize(results.filter((result) => result.version === "tilted")),
      shadow: summarize(results.filter((result) => result.version === "shadow")),
      photo: summarize(results.filter((result) => result.version === "photo")),
    },
    byDevice: summarizeBy(results, (result) => result.device ? [result.device] : []),
    byCondition: summarizeBy(results, (result) => result.conditions ?? []),
    byCategory: summarizeBy(results, (result) => result.category ? [result.category] : []),
    results,
  };
}

function scoreResult(item: PrintEvalCase, value: unknown, elapsedMs: number, error: boolean): PrintEvalResult {
  const result: PrintEvalResult = {
    id: item.id,
    version: item.version,
    expectedTemplateId: item.expected.templateId,
    templateCorrect: false,
    ...(item.device ? { device: item.device } : {}),
    ...(item.conditions ? { conditions: item.conditions } : {}),
    ...(item.category ? { category: item.category } : {}),
    ...(item.kind ? { kind: item.kind } : {}),
    elapsedMs,
    ...(error ? { error: true } : {}),
  };
  if (!isRecord(value)) return result;
  const output = value as PrintOutput;
  const problems = Array.isArray(output.problems) ? output.problems.filter(isRecord) : [];
  if (item.expected.templateId === null) {
    const dropped = problems.length === 0 && Number.isInteger(output.unsupportedCount) && (output.unsupportedCount as number) >= 1;
    result.droppedCorrect = dropped;
    return result;
  }

  const match = problems.find((problem) => problem.templateId === item.expected.templateId);
  result.templateCorrect = match !== undefined;
  if (item.expected.templateId === "rika-lever") {
    result.numberCorrect = match !== undefined && sameLeverParams(match.params, item.expected.params);
    result.validatedMisread = match !== undefined && !result.numberCorrect;
  } else if (item.expected.templateId === "sansu-fraction-addsub") {
    result.numberCorrect = match !== undefined && sameFractionParams(match.params, item.expected.params);
    result.validatedMisread = match !== undefined && !result.numberCorrect;
  }
  return result;
}

function summarize(results: readonly PrintEvalResult[]): PrintEvalMetrics {
  const numberResults = results.filter((result) => result.numberCorrect !== undefined);
  const unsupportedResults = results.filter((result) => result.droppedCorrect !== undefined);
  const durations = results.map((result) => result.elapsedMs).sort((left, right) => left - right);
  const templateCorrect = results.filter((result) => result.templateCorrect).length;
  const numberCorrect = numberResults.filter((result) => result.numberCorrect).length;
  const unsupportedCorrect = unsupportedResults.filter((result) => result.droppedCorrect).length;
  return {
    total: results.length,
    templateScored: results.filter((result) => result.expectedTemplateId !== null).length,
    templateCorrect,
    templateAccuracy: ratio(templateCorrect, results.filter((result) => result.expectedTemplateId !== null).length),
    numberScored: numberResults.length,
    numberCorrect,
    numberAccuracy: ratio(numberCorrect, numberResults.length),
    validatedMisread: results.filter((result) => result.validatedMisread).length,
    unsupportedScored: unsupportedResults.length,
    unsupportedCorrect,
    unsupportedRecall: ratio(unsupportedCorrect, unsupportedResults.length),
    durationMedianMs: median(durations),
    durationP95Ms: percentile(durations, 0.95),
  };
}

function summarizeBy(results: readonly PrintEvalResult[], getGroups: (result: PrintEvalResult) => string[]): Record<string, PrintEvalMetrics> {
  const buckets: Record<string, PrintEvalResult[]> = {};
  for (const result of results) {
    for (const group of getGroups(result)) (buckets[group] ??= []).push(result);
  }
  return Object.fromEntries(Object.entries(buckets).map(([group, groupedResults]) => [group, summarize(groupedResults)]));
}

function sameLeverParams(value: unknown, expected: Extract<PrintEvalExpected, { templateId: "rika-lever" }> ["params"]): boolean {
  if (!isRecord(value) || !isRecord(value.left) || !isRecord(value.right)) return false;
  return value.left.pos === expected.left.pos && value.left.g === expected.left.g && value.right.pos === expected.right.pos;
}

function sameFractionParams(value: unknown, expected: Extract<PrintEvalExpected, { templateId: "sansu-fraction-addsub" }> ["params"]): boolean {
  if (!isRecord(value) || !isRecord(value.left) || !isRecord(value.right)) return false;
  return value.left.num === expected.left.num && value.left.den === expected.left.den
    && value.op === expected.op && value.right.num === expected.right.num && value.right.den === expected.right.den;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ratio(value: number, total: number): number {
  return total ? value / total : 0;
}

function median(sorted: readonly number[]): number {
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2 * 100) / 100;
}

function percentile(sorted: readonly number[], fraction: number): number {
  return sorted.length ? sorted[Math.ceil(sorted.length * fraction) - 1]! : 0;
}

async function loadCases(imagesDirectory: string): Promise<PrintEvalCase[]> {
  const files = (await readdir(imagesDirectory)).filter((file) => extname(file).toLowerCase() === ".jpg").sort();
  const cases: PrintEvalCase[] = [];
  for (const file of files) {
    const jsonPath = resolve(imagesDirectory, `${file.slice(0, -4)}.json`);
    const sidecar: unknown = JSON.parse(await readFile(jsonPath, "utf8"));
    if (!isRecord(sidecar) || typeof sidecar.id !== "string" || !isVersion(sidecar.version) || !isRecord(sidecar.expected)) {
      throw new Error(`正解ファイルの形が違います: ${file.slice(0, -4)}.json`);
    }
    const expected = sidecar.expected as unknown as PrintEvalExpected;
    if (expected.templateId !== null && expected.templateId !== "rika-lever" && expected.templateId !== "rika-moon" && expected.templateId !== "sansu-fraction-addsub") {
      throw new Error(`正解ファイルの型が違います: ${file.slice(0, -4)}.json`);
    }
    if (sidecar.device !== undefined && (typeof sidecar.device !== "string" || !sidecar.device.trim())) {
      throw new Error(`正解ファイルの端末名が違います: ${file.slice(0, -4)}.json`);
    }
    if (sidecar.conditions !== undefined && (!Array.isArray(sidecar.conditions) || !sidecar.conditions.every((condition) => typeof condition === "string" && condition.trim()))) {
      throw new Error(`正解ファイルの条件が違います: ${file.slice(0, -4)}.json`);
    }
    cases.push({
      id: sidecar.id,
      version: sidecar.version,
      imagePath: resolve(imagesDirectory, file),
      expected,
      ...(typeof sidecar.device === "string" ? { device: sidecar.device } : {}),
      ...(Array.isArray(sidecar.conditions) ? { conditions: sidecar.conditions as string[] } : {}),
      ...(isCategory(sidecar.category) ? { category: sidecar.category } : {}),
      ...(typeof sidecar.kind === "string" ? { kind: sidecar.kind } : {}),
    });
  }
  return cases;
}

function isVersion(value: unknown): value is PrintEvalCase["version"] {
  return value === "normal" || value === "dark" || value === "tilted" || value === "shadow" || value === "photo";
}

function isCategory(value: unknown): value is PrintEvalCategory {
  return value === "figure-only" || value === "paraphrase" || value === "multi" || value === "moon-figure" || value === "decoy" || value === "single" || value === "mixed" || value === "unsupported";
}

export function formatPrintEvalMarkdown(report: PrintEvalReport): string {
  const rows = [
    "版 | 問題数 | 型正解率 | 数値正解率 | 検算を通った誤読 | 不対応の除外率 | 時間 中央値 | 時間 95%",
    "--- | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    metricRow("全体", report.summary),
    metricRow("ふつう", report.byVersion.normal),
    metricRow("暗い", report.byVersion.dark),
    metricRow("斜め", report.byVersion.tilted),
    metricRow("影", report.byVersion.shadow),
    metricRow("実写", report.byVersion.photo),
    "",
    "検算を通った誤読は、型と文の検査を通って説明として残り、数値が正解と違った件数です。",
    "",
    "端末別 | 問題数 | 検算を通った誤読 | 数値正解率",
    "--- | ---: | ---: | ---:",
    ...Object.entries(report.byDevice).map(([name, metrics]) => groupMetricRow(name, metrics)),
    "",
    "条件別 | 問題数 | 検算を通った誤読 | 数値正解率",
    "--- | ---: | ---: | ---:",
    ...Object.entries(report.byCondition).map(([name, metrics]) => groupMetricRow(name, metrics)),
    "",
    "種類別 | 問題数 | 検算を通った誤読 | 数値正解率",
    "--- | ---: | ---: | ---:",
    ...Object.entries(report.byCategory).map(([name, metrics]) => groupMetricRow(name, metrics)),
    "",
    `測定元: ${report.source}${report.ai?.model ? ` (${report.ai.model})` : ""}`,
    ...(report.evaluatedAt ? [`測定日時: ${report.evaluatedAt}`] : []),
    "",
    "個別結果には写真・読み取った文・params を含めず、正解したかと所要時間だけを記録しています。",
  ];
  return `${rows.join("\n")}\n`;
}

function metricRow(name: string, metrics: PrintEvalMetrics): string {
  const percent = (correct: number, total: number) => total ? `${(correct / total * 100).toFixed(1)}% (${correct}/${total})` : "対象なし";
  return `${name} | ${metrics.total} | ${percent(metrics.templateCorrect, metrics.templateScored)} | ${percent(metrics.numberCorrect, metrics.numberScored)} | ${metrics.validatedMisread} | ${percent(metrics.unsupportedCorrect, metrics.unsupportedScored)} | ${metrics.durationMedianMs} ms | ${metrics.durationP95Ms} ms`;
}

function groupMetricRow(name: string, metrics: PrintEvalMetrics): string {
  const accuracy = metrics.numberScored ? `${(metrics.numberCorrect / metrics.numberScored * 100).toFixed(1)}% (${metrics.numberCorrect}/${metrics.numberScored})` : "対象なし";
  return `${markdownCell(name)} | ${metrics.total} | ${metrics.validatedMisread} | ${accuracy}`;
}

function markdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replace(/[\r\n]+/g, " ");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const forceMock = args.includes("--mock");
  const environment = forceMock ? {} : process.env;
  assertEvalAiAllowed(forceMock ? {} : environment);
  const settings = readAiSettings(environment);
  assertEvalSettingsMatchIntent(environment, settings);
  const client = settings.mode === "mock" ? new MockAiClient() : new GeminiAiClient(settings);
  const source = settings.mode === "mock" ? "mock" : "gemini";
  const options = new Map<string, string>();
  const positional: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--mock") continue;
    if (argument === "--images" || argument === "--output") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} の値を指定してください。`);
      options.set(argument, value);
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`知らないオプションです: ${argument}`);
    } else positional.push(argument);
  }
  const defaultImagesDirectory = resolve("eval/print-images");
  const imagesDirectory = resolve(options.get("--images") ?? defaultImagesDirectory);
  const outputBase = resolve(options.get("--output") ?? positional[0] ?? `eval/results/print-${source}`);
  const cases = await loadCases(imagesDirectory);
  if (imagesDirectory === defaultImagesDirectory && cases.length !== 60) throw new Error(`検証写真は60枚必要です（現在 ${cases.length} 枚）。`);
  const report = await evaluatePrint(client, cases, source);
  report.evaluatedAt = new Date().toISOString();
  report.ai = describeAiSettings(settings);
  await mkdir(dirname(outputBase), { recursive: true });
  const isCustomImages = options.has("--images");
  const jsonPath = outputBase.endsWith(".json") ? outputBase : `${outputBase}.json`;
  const markdownPath = jsonPath.slice(0, -5) + ".md";
  if (!isCustomImages) await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, formatPrintEvalMarkdown(report), "utf8");
  process.stdout.write(`${JSON.stringify(report.summary)}\n${isCustomImages ? "" : `JSON: ${jsonPath}\n`}Markdown: ${markdownPath}\nAI: ${JSON.stringify(report.ai)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "評価を実行できませんでした。"}\n`);
    process.exitCode = 1;
  });
}
