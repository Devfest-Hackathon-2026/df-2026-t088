import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { evaluatePrint, formatPrintEvalMarkdown, type PrintEvalCase } from "./run-print-eval.ts";
import { createAnswerSidecars } from "./make-real-photo-answers.mjs";

const cases: PrintEvalCase[] = [
  {
    id: "lever-normal",
    version: "normal",
    imagePath: "lever-normal.jpg",
    expected: { templateId: "rika-lever", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } },
  },
  {
    id: "moon-dark",
    version: "dark",
    imagePath: "moon-dark.jpg",
    expected: { templateId: "rika-moon", params: {} },
  },
  {
    id: "unsupported-shadow",
    version: "shadow",
    imagePath: "unsupported-shadow.jpg",
    expected: { templateId: null },
  },
];

test("型・数・不対応の正解率を全体と版ごとに集計する", async () => {
  const outputs = [
    { problems: [{ templateId: "rika-lever", questionText: "てこ", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } }], unsupportedCount: 0 },
    { problems: [{ templateId: "rika-moon", questionText: "月", params: {} }], unsupportedCount: 0 },
    { problems: [], unsupportedCount: 1 },
  ];
  let index = 0;
  const report = await evaluatePrint({ readPrint: async () => outputs[index++] }, cases, "mock", async () => new Uint8Array());

  assert.equal(report.summary.total, 3);
  assert.equal(report.summary.templateScored, 2);
  assert.equal(report.summary.templateCorrect, 2);
  assert.equal(report.summary.templateAccuracy, 1);
  assert.equal(report.summary.numberScored, 1);
  assert.equal(report.summary.numberCorrect, 1);
  assert.equal(report.summary.numberAccuracy, 1);
  assert.equal(report.summary.unsupportedScored, 1);
  assert.equal(report.summary.unsupportedCorrect, 1);
  assert.equal(report.summary.unsupportedRecall, 1);
  assert.deepEqual(Object.keys(report.byVersion).sort(), ["dark", "normal", "photo", "shadow", "tilted"]);
  assert.equal(report.byVersion.shadow.unsupportedRecall, 1);
  assert.equal(report.results.length, 3);
  assert.ok(report.results.every((result) => result.elapsedMs >= 0));
});

test("分数は5つの params がすべて一致したときだけ数を正解にする", async () => {
  const fractionCase: PrintEvalCase = {
    id: "fraction-normal", version: "normal", imagePath: "fraction-normal.jpg",
    expected: { templateId: "sansu-fraction-addsub", params: { left: { num: 1, den: 2 }, op: "+", right: { num: 1, den: 3 } } },
  };
  const outputs = [
    { problems: [{ templateId: "sansu-fraction-addsub", questionText: "1/2 + 1/3", params: { left: { num: 1, den: 2 }, op: "+", right: { num: 1, den: 3 } } }], unsupportedCount: 0 },
    { problems: [{ templateId: "sansu-fraction-addsub", questionText: "3/4 - 1/4", params: { left: { num: 3, den: 4 }, op: "-", right: { num: 1, den: 4 } } }], unsupportedCount: 0 },
  ];
  let index = 0;
  const report = await evaluatePrint({ readPrint: async () => outputs[index++] }, [fractionCase, fractionCase], "mock", async () => new Uint8Array());

  assert.equal(report.summary.numberScored, 2);
  assert.equal(report.summary.numberCorrect, 1);
  assert.equal(report.summary.validatedMisread, 1);
});

test("例外を個別の失敗として集計する", async () => {
  const report = await evaluatePrint({ readPrint: async () => { throw new Error("secret photo text"); } }, cases.slice(0, 1), "mock", async () => new Uint8Array());
  assert.equal(report.results[0]?.error, true);
  assert.equal(report.summary.templateAccuracy, 0);
  assert.equal(report.summary.numberAccuracy, 0);
});

test("検算を通った数の誤読と端末・条件ごとの件数を集計する", async () => {
  const photoCases: PrintEvalCase[] = [
    { ...cases[0]!, id: "photo-1", version: "photo", device: "Pixel", conditions: ["handwriting", "shadow"] },
    { ...cases[0]!, id: "photo-2", version: "photo", device: "iPhone", conditions: ["fold"] },
  ];
  let index = 0;
  const report = await evaluatePrint({ readPrint: async () => [
    { problems: [{ templateId: "rika-lever", questionText: "てこの問題", params: { left: { pos: 2, g: 60 }, right: { pos: 3 } } }], unsupportedCount: 0 },
    { problems: [{ templateId: "rika-lever", questionText: "てこの問題", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } }], unsupportedCount: 0 },
  ][index++] }, photoCases, "mock", async () => new Uint8Array());

  assert.equal(report.summary.validatedMisread, 1);
  assert.equal(report.byVersion.photo.total, 2);
  assert.equal(report.byDevice.Pixel?.validatedMisread, 1);
  assert.equal(report.byDevice.iPhone?.validatedMisread, 0);
  assert.equal(report.byCondition.handwriting?.validatedMisread, 1);
  assert.equal(report.byCondition.fold?.validatedMisread, 0);
  assert.match(formatPrintEvalMarkdown(report), /検算を通った誤読/);
  assert.match(formatPrintEvalMarkdown(report), /Pixel/);
  assert.match(formatPrintEvalMarkdown(report), /handwriting/);
});

test("正解 CSV から写真ごとの正解ファイルを作る", () => {
  const generated = createAnswerSidecars([
    "file,templateId,leftPosition,leftWeight,rightPosition,device,conditions",
    "IMG_001.jpg,rika-lever,2,30,3,Pixel,handwriting|shadow",
    "IMG_002.jpg,rika-moon,,,,iPhone,fold",
  ].join("\n"));

  assert.deepEqual(JSON.parse(generated.get("IMG_001.json")!), {
    id: "IMG_001", version: "photo",
    expected: { templateId: "rika-lever", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } },
    device: "Pixel", conditions: ["handwriting", "shadow"],
  });
  assert.deepEqual(JSON.parse(generated.get("IMG_002.json")!), {
    id: "IMG_002", version: "photo", expected: { templateId: "rika-moon", params: {} },
    device: "iPhone", conditions: ["fold"],
  });
});

test("--mock と --images で枚数制限なしの評価を実行し Markdown だけを保存する", async () => {
  const directory = await mkdtemp(join(tmpdir(), "print-photo-eval-"));
  try {
    const fixture = new URL("./print-images/lever-01-normal.jpg", import.meta.url);
    await writeFile(join(directory, "sample.jpg"), await readFile(fixture));
    await writeFile(join(directory, "sample.json"), JSON.stringify({
      id: "sample", version: "photo", expected: { templateId: "rika-lever", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } },
      device: "Pixel", conditions: ["shadow"],
    }));
    const output = join(directory, "result");
    const script = fileURLToPath(new URL("./run-print-eval.ts", import.meta.url));
    const run = spawnSync(process.execPath, [script, "--mock", "--images", directory, "--output", output], { encoding: "utf8" });

    assert.equal(run.status, 0, run.stderr);
    assert.match(await readFile(`${output}.md`, "utf8"), /Pixel/);
    await assert.rejects(readFile(`${output}.json`));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("category ごとの集計を Markdown に出す", async () => {
  const categoryCases = cases.slice(0, 2).map((item, index) => ({ ...item, category: index === 0 ? "figure-only" as const : "moon-figure" as const }));
  const report = await evaluatePrint({ readPrint: async () => ({ problems: [], unsupportedCount: 1 }) }, categoryCases, "mock", async () => new Uint8Array());

  assert.equal(report.byCategory["figure-only"]?.total, 1);
  assert.equal(report.byCategory["moon-figure"]?.total, 1);
  assert.match(formatPrintEvalMarkdown(report), /種類別/);
  assert.match(formatPrintEvalMarkdown(report), /figure-only/);
});
