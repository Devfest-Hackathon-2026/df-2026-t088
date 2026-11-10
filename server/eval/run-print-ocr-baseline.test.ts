import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { classifyOcrText, evaluateOcrCases, formatOcrMarkdown, parseLeverNumbers, visionText } from "./run-print-ocr-baseline.ts";

test("見本の Vision 応答 JSON から OCR の文字を読む", async () => {
  const fixture = JSON.parse(await readFile(new URL("./fixtures/vision-annotate-sample.json", import.meta.url), "utf8"));
  assert.equal(visionText(fixture), "てこのはたらき\n左 2の目もり 30gのおもり\n右 3の目もり");
});

test("テンプレートのキーワードで型を決め、どれも無ければ不対応にする", () => {
  assert.equal(classifyOcrText("てこの問題。左におもりをつるす"), "rika-lever");
  assert.equal(classifyOcrText("満月の形を調べます"), "rika-moon");
  assert.equal(classifyOcrText("分数の計算"), null);
});

test("左右の近くにある目もりと左のおもりの重さを拾う", () => {
  assert.deepEqual(parseLeverNumbers("左 2の目もりに30gのおもり、右は3の目もり"), {
    left: { pos: 2, g: 30 }, right: { pos: 3 },
  });
  assert.equal(parseLeverNumbers("てこの図。おもりは絵の中だけ"), null);
});

test("OCR の型・数・不対応を採点し、読み取った文字を結果に残さない", async () => {
  const cases = [
    { id: "lever", version: "normal" as const, imagePath: "lever.jpg", expected: { templateId: "rika-lever" as const, params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } } },
    { id: "moon", version: "normal" as const, imagePath: "moon.jpg", expected: { templateId: "rika-moon" as const, params: {} } },
    { id: "other", version: "normal" as const, imagePath: "other.jpg", expected: { templateId: null } },
  ];
  const texts = ["てこ 左 2の目もり 30g 右 3の目もり", "月", "分数"];
  let index = 0;
  const report = await evaluateOcrCases(async () => texts[index++]!, cases);

  assert.equal(report.summary.templateCorrect, 2);
  assert.equal(report.summary.numberCorrect, 1);
  assert.equal(report.summary.unsupportedCorrect, 1);
  assert.equal(report.results.length, 3);
  assert.ok(report.results.every((result) => !JSON.stringify(result).includes("てこ")));
});

test("category ごとの集計を Markdown に出す", async () => {
  const cases = ["figure-only", "decoy"].map((category) => ({
    id: category, version: "normal" as const, category, imagePath: `${category}.jpg`,
    expected: { templateId: null as const },
  }));
  const report = await evaluateOcrCases(async () => "分数", cases);

  assert.equal(report.byCategory["figure-only"]?.total, 1);
  assert.equal(report.byCategory.decoy?.total, 1);
  assert.match(formatOcrMarkdown(report), /種類別/);
  assert.match(formatOcrMarkdown(report), /figure-only/);
});

test("--mock と --images で OCR の種類別評価を実行する", async () => {
  const directory = await mkdtemp(join(tmpdir(), "print-ocr-eval-"));
  try {
    await writeFile(join(directory, "sample.jpg"), await readFile(new URL("./print-images/lever-01-normal.jpg", import.meta.url)));
    await writeFile(join(directory, "sample.json"), JSON.stringify({
      id: "sample", version: "normal", category: "figure-only", expected: { templateId: "rika-lever", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } },
    }));
    const output = join(directory, "result.md");
    const script = fileURLToPath(new URL("./run-print-ocr-baseline.ts", import.meta.url));
    const run = spawnSync(process.execPath, [script, "--mock", "--images", directory, "--output", output], { encoding: "utf8" });

    assert.equal(run.status, 0, run.stderr);
    assert.match(await readFile(output, "utf8"), /figure-only/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
