import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "../../e2e/node_modules/playwright/index.mjs";
import { printTemplate } from "../src/print/templates.ts";

const fraction = (left, op, right) => ({
  templateId: "sansu-fraction-addsub",
  params: { left: { num: left[0], den: left[1] }, op, right: { num: right[0], den: right[1] } },
});
const single = [
  { id: "fraction-01", text: "計算しましょう。", expression: fraction([1, 2], "+", [1, 3]) },
  { id: "fraction-02", text: "次の計算をしましょう。", expression: fraction([3, 4], "-", [1, 4]) },
  { id: "fraction-03", text: "分数のたし算をしましょう。", expression: fraction([1, 3], "+", [1, 6]) },
  { id: "fraction-04", text: "計算しましょう。", expression: fraction([5, 6], "-", [1, 3]) },
  { id: "fraction-05", text: "次の式を計算しましょう。", expression: fraction([2, 5], "+", [1, 10]) },
  { id: "fraction-06", text: "計算しましょう。", expression: fraction([1, 2], "-", [1, 6]), horizontal: true },
  { id: "fraction-07", text: "次の計算をしましょう。", expression: fraction([1, 4], "+", [1, 8]), horizontal: true },
  { id: "fraction-08", text: "分数のひき算をしましょう。", expression: fraction([7, 8], "-", [3, 8]) },
].map((question) => ({ ...question, kind: "single", expected: question.expression }));

const multiple = [
  ["fraction-multi-01", [[1, 2], "+", [1, 3]], [[3, 4], "-", [1, 4]], [[1, 5], "+", [2, 5]]],
  ["fraction-multi-02", [[1, 3], "+", [1, 6]], [[5, 6], "-", [1, 3]], [[2, 5], "+", [1, 10]]],
  ["fraction-multi-03", [[1, 4], "+", [1, 8]], [[7, 8], "-", [3, 8]], [[1, 2], "+", [1, 4]]],
].map(([id, ...expressions]) => ({
  id,
  kind: "multi",
  expressions: expressions.map(([left, op, right]) => fraction(left, op, right)),
  expected: fraction(expressions[0][0], expressions[0][1], expressions[0][2]),
}));

const mixed = [
  { id: "fraction-mixed-01", expression: fraction([1, 2], "+", [1, 3]), leftPos: 2, weight: 30, rightPos: 3 },
  { id: "fraction-mixed-02", expression: fraction([3, 4], "-", [1, 4]), leftPos: 4, weight: 30, rightPos: 6 },
].map((question) => ({ ...question, text: "次の問題に答えましょう。", kind: "mixed", expected: question.expression }));

const unsupported = [
  { id: "fraction-unsupported-01", text: "1と1/2 + 1/3 を計算しましょう。" },
  { id: "fraction-unsupported-02", text: "1/2 × 1/3 を計算しましょう。" },
  { id: "fraction-unsupported-03", text: "1/2 ÷ 1/3 を計算しましょう。" },
  { id: "fraction-unsupported-04", text: "1/2 + 1/3 + 1/4 を計算しましょう。" },
  { id: "fraction-unsupported-05", text: "1/13 + 1/2 を計算しましょう。" },
].map((question) => ({ ...question, kind: "unsupported", expected: { templateId: null } }));

for (const question of [...single, ...multiple, ...mixed]) {
  const { params } = question.expected;
  if (printTemplate("sansu-fraction-addsub").validateParams(params).length) {
    throw new Error(`検算を通らない式です: ${question.id}`);
  }
}

const variants = [
  { id: "normal", className: "normal" },
  { id: "dark", className: "dark" },
  { id: "tilted", className: "tilted" },
  { id: "shadow", className: "shadow" },
];
const outputDirectory = resolve("eval/print-images-fraction");
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
  for (const question of [...single, ...multiple, ...mixed, ...unsupported]) {
    const questionVariants = question.kind === "single" ? variants : [variants[0]];
    for (const variant of questionVariants) {
      const basename = `${question.id}-${variant.id}`;
      await page.setContent(makeHtml(question, variant));
      const jpeg = await page.screenshot({ type: "jpeg", quality: 84 });
      if (jpeg.byteLength > 2 * 1024 * 1024) throw new Error(`画像の大きさが上限を超えました: ${basename}`);
      await writeFile(resolve(outputDirectory, `${basename}.jpg`), jpeg);
      await writeFile(resolve(outputDirectory, `${basename}.json`), `${JSON.stringify({
        id: question.id,
        version: variant.id,
        kind: question.kind,
        expected: question.expected,
      }, null, 2)}\n`, "utf8");
    }
  }
} finally {
  await browser.close();
}
process.stdout.write(`分数の検証用画像を${single.length * variants.length + multiple.length + mixed.length + unsupported.length}枚作りました。\n`);

function fractionHtml(params, horizontal) {
  const item = (value) => horizontal
    ? `<span class="horizontal-fraction">${value.num}/${value.den}</span>`
    : `<span class="fraction"><span>${value.num}</span><span>${value.den}</span></span>`;
  return `${item(params.left)} <span class="operator">${params.op}</span> ${item(params.right)}`;
}

function makeHtml(question, variant) {
  const main = question.kind === "unsupported"
    ? question.text
    : question.kind === "single" || question.kind === "mixed"
      ? `${escapeHtml(question.text)}<div class="expression">${fractionHtml(question.expected.params, question.horizontal)}</div>`
      : question.kind === "multi"
        ? question.expressions.map((item, index) => `<div class="multi-row">${index + 1}. ${fractionHtml(item.params, false)}</div>`).join("")
        : `<div class="fraction-row">${leverDiagram(question)}<span>${fractionHtml(question.expected.params, false)}</span></div>`;
  const shadow = variant.id === "shadow" ? '<div class="shade"></div>' : "";
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1400px; height: 1000px; overflow: hidden; background: #c9c9c9; font-family: "Noto Sans JP", "Yu Gothic", sans-serif; color: #171717; }
    .paper { position: absolute; left: 120px; top: 78px; width: 1160px; height: 844px; padding: 54px 68px; background: #fff; border: 1px solid #aaa; box-shadow: 0 4px 15px #5557; }
    .dark .paper { filter: brightness(.52); }
    .tilted .paper { transform: rotate(7deg); }
    h1 { margin: 0 0 34px; font-size: 34px; border-bottom: 3px solid #333; padding-bottom: 18px; }
    .meta { font-size: 19px; margin-bottom: 38px; }
    .question { font-size: 29px; line-height: 1.8; min-height: 100px; }
    .expression { display: flex; justify-content: center; align-items: center; gap: 30px; margin: 40px; font-size: 54px; }
    .fraction { display: inline-flex; width: 66px; flex-direction: column; align-items: center; line-height: 1.05; vertical-align: middle; }
    .fraction span:first-child { width: 100%; border-bottom: 3px solid #171717; text-align: center; padding-bottom: 5px; }
    .fraction span:last-child { padding-top: 5px; }
    .horizontal-fraction { white-space: nowrap; }
    .operator { font-size: 48px; }
    .multi-row { font-size: 42px; margin: 18px 0; }
    .fraction-row { display: flex; align-items: center; gap: 36px; margin-top: 15px; font-size: 42px; }
    .diagram { width: 430px; height: 160px; }
    .line { display: inline-block; width: 290px; margin-left: 12px; border-bottom: 2px solid #333; }
    .shade { position: absolute; left: 590px; top: 0; width: 330px; height: 1000px; transform: skew(-16deg); background: rgba(0,0,0,.24); pointer-events: none; }
    </style></head><body class="${variant.className}"><main class="paper"><h1>算数　分数の計算</h1><div class="meta">5年　　名前 <span class="line"></span></div><div class="question">${main}</div><div class="answer">答え <span class="line"></span></div></main>${shadow}</body></html>`;
}

function leverDiagram(question) {
  return `<svg class="diagram" viewBox="0 0 430 160" role="img" aria-label="てこの図">
    <line x1="30" y1="65" x2="400" y2="65" stroke="#333" stroke-width="7" />
    <path d="M195 78 L235 145 L155 145 Z" fill="#dedede" stroke="#333" stroke-width="3" />
    <rect x="85" y="15" width="54" height="42" rx="6" fill="#f5f5f5" stroke="#333" stroke-width="3" />
    <text x="112" y="43" text-anchor="middle" font-size="17">${question.weight}g</text>
    <text x="325" y="115" text-anchor="middle" font-size="22">?</text>
    <text x="112" y="100" text-anchor="middle" font-size="15">${question.leftPos}</text>
    <text x="325" y="100" text-anchor="middle" font-size="15">${question.rightPos}</text>
  </svg>`;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
