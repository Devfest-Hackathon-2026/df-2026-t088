import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PRINT_TEMPLATES } from "../src/print/templates.ts";

type TemplateId = "rika-lever" | "rika-moon";
type Category = "figure-only" | "paraphrase" | "multi" | "moon-figure" | "decoy";
type Expected =
  | { templateId: "rika-lever"; params: { left: { pos: number; g: number }; right: { pos: number } } }
  | { templateId: "rika-moon"; params: Record<string, never> }
  | { templateId: null };
export type OcrEvalCase = { id: string; version: "normal" | "dark" | "tilted" | "shadow" | "photo"; imagePath: string; expected: Expected; category?: Category };
type Metrics = { total: number; templateScored: number; templateCorrect: number; numberScored: number; numberCorrect: number; unsupportedScored: number; unsupportedCorrect: number; durationMedianMs: number; durationP95Ms: number };
type OcrResult = { id: string; version: OcrEvalCase["version"]; category?: Category; templateCorrect: boolean; numberCorrect?: boolean; droppedCorrect?: boolean; elapsedMs: number; error?: boolean };
export type OcrReport = { summary: Metrics; byVersion: Record<OcrEvalCase["version"], Metrics>; byCategory: Record<string, Metrics>; results: OcrResult[] };
type VisionResponse = { responses?: Array<{ fullTextAnnotation?: { text?: string } }> };

export function classifyOcrText(text: string): TemplateId | null {
  return PRINT_TEMPLATES.find((template) => template.keywords.some((keyword) => text.includes(keyword)))?.id ?? null;
}

export function parseLeverNumbers(text: string): Extract<Expected, { templateId: "rika-lever" }> ["params"] | null {
  const leftMatch = /左([\s\S]{0,60}?)(?:右|$)/.exec(text);
  const rightMatch = /右([\s\S]{0,60})/.exec(text);
  if (!leftMatch || !rightMatch) return null;
  const left = leftMatch[1]!;
  const right = rightMatch[1]!;
  const leftPos = /([0-9０-９]+)\s*(?:の\s*)?(?:目もり|めもり)/.exec(left)?.[1];
  const grams = /([0-9０-９]+)\s*g/i.exec(left)?.[1];
  const rightPos = /([0-9０-９]+)\s*(?:の\s*)?(?:目もり|めもり)/.exec(right)?.[1];
  if (!leftPos || !grams || !rightPos) return null;
  const number = (value: string) => Number(value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0)));
  return { left: { pos: number(leftPos), g: number(grams) }, right: { pos: number(rightPos) } };
}

export async function evaluateOcrCases(readText: (item: OcrEvalCase) => Promise<string>, cases: readonly OcrEvalCase[]): Promise<OcrReport> {
  const results: OcrResult[] = [];
  for (const item of cases) {
    const started = performance.now();
    let result: OcrResult = { id: item.id, version: item.version, ...(item.category ? { category: item.category } : {}), templateCorrect: false, elapsedMs: 0 };
    try {
      const text = await readText(item);
      const templateId = classifyOcrText(text);
      result.templateCorrect = templateId === item.expected.templateId;
      if (item.expected.templateId === null) result.droppedCorrect = templateId === null;
      if (item.expected.templateId === "rika-lever") {
        const numbers = templateId === "rika-lever" ? parseLeverNumbers(text) : null;
        result.numberCorrect = numbers !== null && numbers.left.pos === item.expected.params.left.pos
          && numbers.left.g === item.expected.params.left.g && numbers.right.pos === item.expected.params.right.pos;
      }
    } catch {
      result.error = true;
      if (item.expected.templateId === null) result.droppedCorrect = false;
      if (item.expected.templateId === "rika-lever") result.numberCorrect = false;
    }
    result.elapsedMs = Math.round((performance.now() - started) * 100) / 100;
    results.push(result);
  }
  return {
    summary: summarize(results),
    byVersion: {
      normal: summarize(results.filter((result) => result.version === "normal")),
      dark: summarize(results.filter((result) => result.version === "dark")),
      tilted: summarize(results.filter((result) => result.version === "tilted")),
      shadow: summarize(results.filter((result) => result.version === "shadow")),
      photo: summarize(results.filter((result) => result.version === "photo")),
    },
    byCategory: summarizeByCategory(results),
    results,
  };
}

function summarizeByCategory(results: readonly OcrResult[]): Record<string, Metrics> {
  const buckets: Record<string, OcrResult[]> = {};
  for (const result of results) {
    if (result.category) (buckets[result.category] ??= []).push(result);
  }
  return Object.fromEntries(Object.entries(buckets).map(([category, items]) => [category, summarize(items)]));
}

function summarize(results: readonly OcrResult[]): Metrics {
  const expectedTemplates = results.filter((result) => result.droppedCorrect === undefined);
  const numberResults = results.filter((result) => result.numberCorrect !== undefined);
  const unsupported = results.filter((result) => result.droppedCorrect !== undefined);
  const durations = results.map((result) => result.elapsedMs).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor((durations.length - 1) / 2)]! : 0;
  return {
    total: results.length,
    templateScored: expectedTemplates.length,
    templateCorrect: expectedTemplates.filter((result) => result.templateCorrect).length,
    numberScored: numberResults.length,
    numberCorrect: numberResults.filter((result) => result.numberCorrect).length,
    unsupportedScored: unsupported.length,
    unsupportedCorrect: unsupported.filter((result) => result.droppedCorrect).length,
    durationMedianMs: median,
    durationP95Ms: durations.length ? durations[Math.ceil(durations.length * 0.95) - 1]! : 0,
  };
}

export function visionText(value: unknown): string {
  if (typeof value !== "object" || value === null) return "";
  const response = value as VisionResponse;
  return response.responses?.map((item) => item.fullTextAnnotation?.text ?? "").join("\n") ?? "";
}

async function getAccessToken(): Promise<string> {
  for (const args of [["auth", "application-default", "print-access-token"], ["auth", "print-access-token"]]) {
    // Windows の gcloud は gcloud.cmd なので、shell を通さないと見つからない（引数は固定の文字だけ）
    const result = spawnSync("gcloud", args, { encoding: "utf8", windowsHide: true, shell: process.platform === "win32" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Google Cloud のアクセストークンを取得できません。gcloud で認証してください。");
}

async function readVision(bytes: Uint8Array, project: string, token: string): Promise<string> {
  const response = await fetch("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-goog-user-project": project },
    body: JSON.stringify({ requests: [{ image: { content: Buffer.from(bytes).toString("base64") }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }] }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Vision API が HTTP ${response.status} を返しました。`);
  return visionText(await response.json());
}

async function loadCases(imagesDirectory: string): Promise<OcrEvalCase[]> {
  const cases: OcrEvalCase[] = [];
  for (const file of (await readdir(imagesDirectory)).filter((name) => extname(name).toLowerCase() === ".jpg").sort()) {
    const sidecar: unknown = JSON.parse(await readFile(resolve(imagesDirectory, `${file.slice(0, -4)}.json`), "utf8"));
    if (typeof sidecar !== "object" || sidecar === null) throw new Error(`正解ファイルの形が違います: ${file.slice(0, -4)}.json`);
    const entry = sidecar as { id?: unknown; version?: unknown; expected?: unknown; category?: unknown };
    const expected = entry.expected as Expected;
    if (typeof entry.id !== "string" || !["normal", "dark", "tilted", "shadow", "photo"].includes(String(entry.version)) || !expected) {
      throw new Error(`正解ファイルの形が違います: ${file.slice(0, -4)}.json`);
    }
    const categories: Category[] = ["figure-only", "paraphrase", "multi", "moon-figure", "decoy"];
    if (entry.category !== undefined && !categories.includes(entry.category as Category)) throw new Error(`正解ファイルの種類が違います: ${file.slice(0, -4)}.json`);
    cases.push({ id: entry.id, version: entry.version as OcrEvalCase["version"], imagePath: resolve(imagesDirectory, file), expected, ...(entry.category ? { category: entry.category as Category } : {}) });
  }
  return cases;
}

export function formatOcrMarkdown(report: OcrReport, includeHistoricalBaseline = true): string {
  const row = (name: string, metric: Metrics) => {
    const pct = (correct: number, total: number) => total ? `${(correct / total * 100).toFixed(1)}% (${correct}/${total})` : "対象なし";
    return `${name} | ${metric.total} | ${pct(metric.templateCorrect, metric.templateScored)} | ${pct(metric.numberCorrect, metric.numberScored)} | ${pct(metric.unsupportedCorrect, metric.unsupportedScored)} | ${metric.durationMedianMs} ms | ${metric.durationP95Ms} ms`;
  };
  return [
    "## Cloud Vision OCR＋規則による読み取り（#334）",
    "",
    "測定元: Cloud Vision `DOCUMENT_TEXT_DETECTION`。個別結果には写真や OCR の文章を含めず、正解したかと所要時間だけを記録。",
    "",
    "方式 | 問題数 | 型正解率 | 数値正解率 | 不対応の除外率 | 時間 中央値 | 時間 95%",
    "--- | ---: | ---: | ---: | ---: | ---: | ---:",
    row("Cloud Vision OCR＋規則 全体", report.summary),
    row("Cloud Vision OCR＋規則 ふつう", report.byVersion.normal),
    row("Cloud Vision OCR＋規則 暗い", report.byVersion.dark),
    row("Cloud Vision OCR＋規則 斜め", report.byVersion.tilted),
    row("Cloud Vision OCR＋規則 影", report.byVersion.shadow),
    ...(includeHistoricalBaseline ? ["Gemini r2 全体 | 60 | 100.0% (48/48) | 100.0% (40/40) | 100.0% (12/12) | 1190.21 ms | 2130.7 ms"] : []),
    "",
    "### 種類別",
    "",
    "種類 | 問題数 | 型正解率 | 数値正解率 | 不対応の除外率 | 時間 中央値 | 時間 95%",
    "--- | ---: | ---: | ---: | ---: | ---: | ---:",
    ...Object.entries(report.byCategory).map(([name, metrics]) => row(name, metrics)),
    "",
    "### 数の記載場所による内訳",
    "",
    "判断が要る: `server/eval/print-images/*.json` の正解データには、数が問題文と図のどちらに記載されているかがありません。数値問題の総数（40問）は分かりますが、内訳は分類できません。",
    "",
    `測定日時: ${new Date().toISOString()}`,
    "",
    "図の中にしかない数は、この規則では読めないものとして数値の失敗に含めます。",
    "",
    "| ID | 版 | 型正解 | 数値正解 | 不対応正解 | 時間 |",
    "| --- | --- | --- | --- | --- | ---: |",
    ...report.results.map((item) => `| ${item.id} | ${item.version} | ${item.templateCorrect} | ${item.numberCorrect ?? "対象外"} | ${item.droppedCorrect ?? "対象外"} | ${item.elapsedMs} ms |`),
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const forceMock = args.includes("--mock");
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--mock") continue;
    if (argument === "--images" || argument === "--output") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} の値を指定してください。`);
      options.set(argument, value);
      index += 1;
    } else throw new Error(`知らないオプションです: ${argument}`);
  }
  const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const defaultImagesDirectory = resolve(serverDirectory, "eval/print-images");
  const imagesDirectory = resolve(options.get("--images") ?? defaultImagesDirectory);
  const cases = await loadCases(imagesDirectory);
  if (imagesDirectory === defaultImagesDirectory && cases.length !== 60) throw new Error(`検証写真は60枚必要です（現在 ${cases.length} 枚）。`);
  const fixturePath = resolve(serverDirectory, "eval/fixtures/vision-annotate-sample.json");
  const fixture = forceMock ? JSON.parse(await readFile(fixturePath, "utf8")) : undefined;
  const project = process.env.OCR_PROJECT;
  if (!forceMock && !project) throw new Error("OCR_PROJECT を設定してください。");
  // トークンは最初に 1 回だけ取る。取れなければ、全件を「読めなかった」として 0% の表を書く前に止める
  const token = forceMock ? "" : await getAccessToken();
  const report = await evaluateOcrCases(async (item) => {
    if (fixture) return visionText(fixture);
    return readVision(new Uint8Array(await readFile(item.imagePath)), project!, token);
  }, cases);
  if (!forceMock && report.results.every((result) => result.error)) {
    throw new Error("Cloud Vision の呼び出しが全件失敗しました。API の有効化と認証を確かめてください。結果は書いていません。");
  }
  const outputPath = resolve(options.get("--output") ?? resolve(serverDirectory, `eval/results/print-ocr-baseline${forceMock ? "-mock" : ""}.md`));
  await writeFile(outputPath, formatOcrMarkdown(report, !options.has("--images")), "utf8");
  process.stdout.write(`${JSON.stringify(report.summary)}\nMarkdown: ${outputPath}\n${forceMock ? "Mock fixture" : "Cloud Vision"}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "OCR 評価を実行できませんでした。"}\n`);
    process.exitCode = 1;
  });
}
