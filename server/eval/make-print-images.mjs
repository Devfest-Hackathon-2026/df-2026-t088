import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "../../e2e/node_modules/playwright/index.mjs";

const leverProblems = [
  { leftPos: 2, weight: 30, rightPos: 3 },
  { leftPos: 3, weight: 20, rightPos: 2 },
  { leftPos: 4, weight: 30, rightPos: 6 },
  { leftPos: 5, weight: 40, rightPos: 2 },
  { leftPos: 2, weight: 90, rightPos: 3 },
  { leftPos: 6, weight: 20, rightPos: 4 },
  { leftPos: 3, weight: 80, rightPos: 6 },
  { leftPos: 4, weight: 30, rightPos: 2 },
  { leftPos: 5, weight: 20, rightPos: 1 },
  { leftPos: 3, weight: 60, rightPos: 3 },
].map((problem, index) => ({
  id: `lever-${String(index + 1).padStart(2, "0")}`,
  text: `左のおもりを支点から ${problem.leftPos} の目もりにかけました。重さは ${problem.weight} g です。右の ${problem.rightPos} の目もりに何 g のおもりをかけるとつり合いますか。`,
  expected: { templateId: "rika-lever", params: { left: { pos: problem.leftPos, g: problem.weight }, right: { pos: problem.rightPos } } },
}));

const questions = [
  ...leverProblems,
  { id: "moon-01", text: "月は日によって、見える形がちがいます。月の形が変わって見えるのはなぜでしょう。", expected: { templateId: "rika-moon", params: {} } },
  { id: "moon-02", text: "半月の次の日、月はどのように見えるでしょう。月の見え方について考えましょう。", expected: { templateId: "rika-moon", params: {} } },
  { id: "unsupported-01", text: "分速 80 m で 5 分歩きました。歩いた道のりは何 m ですか。", expected: { templateId: null } },
  { id: "unsupported-02", text: "1/2 L のジュースの 2/3 を飲みました。飲んだ量は何 L ですか。", expected: { templateId: null } },
  { id: "unsupported-03", text: "時速 4 km で 3 時間進みました。進んだ道のりは何 km ですか。", expected: { templateId: null } },
];

const variants = [
  { id: "normal", className: "normal" },
  { id: "dark", className: "dark" },
  { id: "tilted", className: "tilted" },
  { id: "shadow", className: "shadow" },
];

const outputDirectory = resolve("eval/print-images");
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
  for (const question of questions) {
    for (const variant of variants) {
      const basename = `${question.id}-${variant.id}`;
      await page.setContent(makeHtml(question, variant));
      const jpeg = await page.screenshot({ type: "jpeg", quality: 84 });
      if (jpeg.byteLength > 2 * 1024 * 1024) throw new Error(`画像の大きさが上限を超えました: ${basename}`);
      await writeFile(resolve(outputDirectory, `${basename}.jpg`), jpeg);
      await writeFile(resolve(outputDirectory, `${basename}.json`), `${JSON.stringify({
        id: question.id,
        version: variant.id,
        expected: question.expected,
      }, null, 2)}\n`, "utf8");
    }
  }
} finally {
  await browser.close();
}
process.stdout.write(`検証用画像を${questions.length * variants.length}枚作りました。\n`);

function makeHtml(question, variant) {
  const expected = question.expected;
  const diagram = expected.templateId === "rika-lever"
    ? `<svg class="diagram" viewBox="0 0 760 160" role="img" aria-label="てこの図">
        <line x1="70" y1="70" x2="690" y2="70" stroke="#333" stroke-width="8" />
        <path d="M355 82 L405 145 L305 145 Z" fill="#dedede" stroke="#333" stroke-width="3" />
        <line x1="${380 - expected.params.left.pos * 48}" y1="65" x2="${380 - expected.params.left.pos * 48}" y2="92" stroke="#333" stroke-width="3" />
        <line x1="${380 + expected.params.right.pos * 48}" y1="65" x2="${380 + expected.params.right.pos * 48}" y2="92" stroke="#333" stroke-width="3" />
        <rect x="${360 - expected.params.left.pos * 48}" y="8" width="42" height="52" rx="7" fill="#f5f5f5" stroke="#333" stroke-width="3" />
        <text x="${381 - expected.params.left.pos * 48}" y="42" text-anchor="middle" font-size="19">${expected.params.left.g}g</text>
        <text x="${380 + expected.params.right.pos * 48}" y="120" text-anchor="middle" font-size="20">?</text>
        ${Array.from({ length: 6 }, (_, index) => `<text x="${380 - (index + 1) * 48}" y="152" text-anchor="middle" font-size="14">${index + 1}</text><text x="${380 + (index + 1) * 48}" y="152" text-anchor="middle" font-size="14">${index + 1}</text>`).join("")}
      </svg>`
    : expected.templateId === "rika-moon"
      ? `<svg class="diagram" viewBox="0 0 760 160" role="img" aria-label="月の図"><circle cx="260" cy="80" r="48" fill="#f4d779" stroke="#333" stroke-width="3"/><circle cx="500" cy="80" r="48" fill="#f4d779" stroke="#333" stroke-width="3"/><path d="M500 32 A48 48 0 0 0 500 128 A30 48 0 0 1 500 32" fill="#303848"/></svg>`
      : `<svg class="diagram" viewBox="0 0 760 160" role="img" aria-label="考える図"><line x1="100" y1="120" x2="650" y2="40" stroke="#555" stroke-width="5"/><circle cx="100" cy="120" r="12" fill="#777"/><circle cx="650" cy="40" r="12" fill="#777"/></svg>`;
  const shadow = variant.id === "shadow" ? '<div class="shade"></div>' : "";
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1400px; height: 1000px; overflow: hidden; background: #c9c9c9; font-family: "Noto Sans JP", "Yu Gothic", sans-serif; color: #171717; }
    .paper { position: absolute; left: 120px; top: 78px; width: 1160px; height: 844px; padding: 54px 68px; background: #fff; border: 1px solid #aaa; box-shadow: 0 4px 15px #5557; }
    .dark .paper { filter: brightness(.52); }
    .tilted .paper { transform: rotate(7deg); }
    h1 { margin: 0 0 34px; font-size: 34px; border-bottom: 3px solid #333; padding-bottom: 18px; }
    .meta { font-size: 19px; margin-bottom: 38px; }
    .question { font-size: 29px; line-height: 1.8; min-height: 160px; }
    .diagram { width: 760px; height: 160px; display: block; margin: 16px auto 25px; }
    .answer { margin-top: 22px; font-size: 22px; }
    .line { display: inline-block; width: 290px; margin-left: 12px; border-bottom: 2px solid #333; }
    .shade { position: absolute; left: 590px; top: 0; width: 330px; height: 1000px; transform: skew(-16deg); background: rgba(0,0,0,.24); pointer-events: none; }
    </style></head><body class="${variant.className}"><main class="paper"><h1>理科・算数の問題</h1><div class="meta">6年　　名前 <span class="line"></span></div><div class="question">${escapeHtml(question.text)}</div>${diagram}<div class="answer">答え <span class="line"></span></div></main>${shadow}</body></html>`;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
