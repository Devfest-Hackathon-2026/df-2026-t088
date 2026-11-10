import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
let chromium;
try {
  ({ chromium } = await import("../../e2e/node_modules/playwright/index.mjs"));
} catch {
  ({ chromium } = await import("../../../e2e/node_modules/playwright/index.mjs"));
}

const figureOnly = [
  [2, 30, 3], [3, 20, 2], [4, 30, 6], [5, 40, 2], [2, 90, 3], [6, 20, 4],
  [3, 80, 6], [4, 30, 2], [5, 20, 1], [3, 60, 3], [1, 40, 2], [6, 30, 3],
].map(([leftPos, weight, rightPos], index) => lever(`figure-${number(index + 1)}`, "figure-only", leftPos, weight, rightPos,
  "図のように、左におもりをつるしました。右のどの目もりに何グラムのおもりをつるすと、てこはつり合いますか。", true));

const paraphrases = [
  [2, 30, 3, "支点から左へ二つ目に三十グラムのおもりがあります。右の三つ目でつり合わせるには何グラムですか。"],
  [3, 20, 2, "左うでの三番目に20グラムをかけました。右うでの二番目にかける重さを求めましょう。"],
  [4, 30, 6, "左側、支点から4目盛り離れたところに重さ30グラムのおもりを下げます。右側の6番目は何グラムなら水平でしょう。"],
  [5, 40, 2, "支点の左の五番目に40gをつるしたよ。右の二つ目なら、何グラムを用意すればいいかな。"],
  [2, 90, 3, "左は支点から二目盛りの位置に九十グラムです。右は三目盛りの位置。つり合う重さは？"],
  [6, 20, 4, "左端から数えるのではなく、支点から左へ6つの場所に20グラムをつけました。右へ4つの場所の重さを答えなさい。"],
  [3, 80, 6, "左のうでの3番目に80グラムのおもりを掛けるとき、右のうでの六番目では何グラムでつり合うでしょうか。"],
  [4, 30, 2, "左に四つ分はなれた目盛り、おもりは30グラム。右側の二つ分はなれた点に必要な重さを求めてください。"],
  [5, 20, 1, "支点から左の五つ目に20グラムをかけた。右の一番目につるすおもりは何グラムかな。"],
  [3, 60, 3, "左側は支点から三番目、重さは六十グラムです。右側も三番目なら、つり合いの重さは何グラムですか。"],
].map(([leftPos, weight, rightPos, text], index) => lever(`phrase-${number(index + 1)}`, "paraphrase", leftPos, weight, rightPos, text));

const multi = [
  [2, 30, 3, "1) 84÷7はいくつですか。\n2) 図のてこで、左に30gのおもりを支点から2目もりの場所につるしました。右の3目もりでつり合う重さは何gですか。\n3) 1/2＋1/4を計算しましょう。"],
  [3, 20, 2, "① 1mは何cmですか。\n② 左の3目盛りに20gをかけたてこがあります。右の2目盛りにつるしてつり合わせる重さを答えましょう。\n③ 63を9で割りましょう。"],
  [4, 30, 6, "次の問題に答えましょう。ア 5×8　イ 図のてこは左の4目もりに30g。右の6目もりにつるす重さは何gですか。ウ 2.4＋1.6"],
  [5, 40, 2, "1番 秒速3mで10秒進むと何mですか。\n2番 左の5目盛りに40gをつるしたてこを、右の2目盛りでつり合わせます。何gが必要ですか。\n3番 900円を3人で分けます。"],
  [2, 90, 3, "A 7×6を計算。\nB 左の2目もりに90gをつけたてこがあります。右の3目もりでは何gをつるせばつり合いますか。\nC 三角形の面積を求める公式を書こう。"],
  [6, 20, 4, "(1) 45分は何時間ですか。 (2) 左の6つ目の目もりに20gをつるしています。右の4つ目でてこを水平にするには何gですか。 (3) 2/3−1/3を計算。"],
].map(([leftPos, weight, rightPos, text], index) => lever(`multi-${number(index + 1)}`, "multi", leftPos, weight, rightPos, text));

const moon = Array.from({ length: 6 }, (_, index) => ({
  id: `moon-${number(index + 1)}`,
  category: "moon-figure",
  text: "この図の月を何といいますか。",
  expected: { templateId: "rika-moon", params: {} },
  moonPhase: index,
}));

const decoys = [
  "てこを使った道具を一つ見つけ、名前を書きましょう。",
  "月はおよそ何日で一周しますか。カレンダーで確かめましょう。",
  "理科室にあるてこの道具を、はさみ以外に二つ書きましょう。",
  "4月は30日、5月は31日です。月の日数を合わせると何日でしょう。",
  "てこを使っている遊具を見つけ、遊具の名前を記録しましょう。",
  "月曜日から金曜日まで学校に行きます。ひと月に4週間あると何日ですか。",
].map((text, index) => ({ id: `decoy-${number(index + 1)}`, category: "decoy", text, expected: { templateId: null } }));

const questions = [...figureOnly, ...paraphrases, ...multi, ...moon, ...decoys];
const outputDirectory = resolve("eval/print-images-hard");
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
  for (const question of questions) {
    const basename = `${question.id}-normal`;
    await page.setContent(makeHtml(question));
    const jpeg = await page.screenshot({ type: "jpeg", quality: 84 });
    if (jpeg.byteLength > 2 * 1024 * 1024) throw new Error(`画像の大きさが上限を超えました: ${basename}`);
    await writeFile(resolve(outputDirectory, `${basename}.jpg`), jpeg);
    await writeFile(resolve(outputDirectory, `${basename}.json`), `${JSON.stringify({
      id: question.id,
      version: "normal",
      category: question.category,
      expected: question.expected,
    }, null, 2)}\n`, "utf8");
  }
} finally {
  await browser.close();
}
process.stdout.write(`難しい検証用画像を${questions.length}枚作りました。\n`);

function lever(id, category, leftPos, weight, rightPos, text, figureOnlyMode = false) {
  return {
    id, category, text,
    expected: { templateId: "rika-lever", params: { left: { pos: leftPos, g: weight }, right: { pos: rightPos } } },
    figureOnlyMode,
  };
}

function number(value) {
  return String(value).padStart(2, "0");
}

function makeHtml(question) {
  const diagram = question.expected.templateId === "rika-lever"
    ? leverDiagram(question.expected.params, question.figureOnlyMode)
    : question.moonPhase !== undefined ? moonDiagram(question.moonPhase) : decoyDiagram(question.id);
  const unrelated = question.category === "multi" ? "別の算数の問題もあります" : "算数・理科　練習問題";
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1400px; height: 1000px; overflow: hidden; background: #c9c9c9; font-family: "Noto Sans JP", "Yu Gothic", sans-serif; color: #171717; }
    .paper { position: absolute; left: 120px; top: 78px; width: 1160px; height: 844px; padding: 54px 68px; background: #fff; border: 1px solid #aaa; box-shadow: 0 4px 15px #5557; }
    h1 { margin: 0 0 28px; font-size: 34px; border-bottom: 3px solid #333; padding-bottom: 18px; }
    .meta { font-size: 19px; margin-bottom: 30px; }
    .question { font-size: ${question.category === "multi" ? "25px" : "29px"}; line-height: 1.65; min-height: ${question.category === "multi" ? "260px" : "150px"}; white-space: pre-line; }
    .diagram { width: 760px; height: 190px; display: block; margin: 10px auto 20px; }
    .answer { margin-top: 18px; font-size: 22px; }
    .line { display: inline-block; width: 290px; margin-left: 12px; border-bottom: 2px solid #333; }
    </style></head><body><main class="paper"><h1>${unrelated}</h1><div class="meta">6年　　名前 <span class="line"></span></div><div class="question">${escapeHtml(question.text)}</div>${diagram}<div class="answer">答え <span class="line"></span></div></main></body></html>`;
}

function leverDiagram(params, figureOnlyMode) {
  const leftX = 380 - params.left.pos * 48;
  const rightX = 380 + params.right.pos * 48;
  return `<svg class="diagram" viewBox="0 0 760 190" role="img" aria-label="てこの図">
    <line x1="70" y1="72" x2="690" y2="72" stroke="#333" stroke-width="8" />
    <path d="M355 84 L405 147 L305 147 Z" fill="#dedede" stroke="#333" stroke-width="3" />
    ${Array.from({ length: 6 }, (_, index) => `<line x1="${380 - (index + 1) * 48}" y1="67" x2="${380 - (index + 1) * 48}" y2="91" stroke="#333" stroke-width="3"/><line x1="${380 + (index + 1) * 48}" y1="67" x2="${380 + (index + 1) * 48}" y2="91" stroke="#333" stroke-width="3"/><text x="${380 - (index + 1) * 48}" y="178" text-anchor="middle" font-size="17">${index + 1}</text><text x="${380 + (index + 1) * 48}" y="178" text-anchor="middle" font-size="17">${index + 1}</text>`).join("")}
    <line x1="${leftX}" y1="65" x2="${leftX}" y2="40" stroke="#333" stroke-width="3" />
    <rect x="${leftX - 36}" y="8" width="72" height="34" rx="6" fill="#f5f5f5" stroke="#333" stroke-width="3" />
    <text x="${leftX}" y="32" text-anchor="middle" font-size="19">${params.left.g}g</text>
    <line x1="${rightX}" y1="65" x2="${rightX}" y2="112" stroke="#333" stroke-width="3" />
    <path d="M${rightX - 9} 110 L${rightX + 9} 110 L${rightX} 122 Z" fill="#333" />
    <text x="${rightX}" y="145" text-anchor="middle" font-size="22">?</text>
    ${figureOnlyMode ? `<text x="44" y="24" font-size="15">支点</text>` : ""}
  </svg>`;
}

function moonDiagram(phase) {
  const offset = [-20, -10, 0, 10, 20, 0][phase];
  return `<svg class="diagram" viewBox="0 0 760 190" role="img" aria-label="月の図"><circle cx="380" cy="90" r="64" fill="#f4d779" stroke="#333" stroke-width="3"/><circle cx="${380 + offset}" cy="${90 - offset / 2}" r="63" fill="#fff"/></svg>`;
}

function decoyDiagram(id) {
  return `<svg class="diagram" viewBox="0 0 760 190" role="img" aria-label="図"><path d="M140 120 L620 55" stroke="#555" stroke-width="8"/><circle cx="140" cy="120" r="18" fill="#777"/><circle cx="620" cy="55" r="18" fill="#777"/><text x="380" y="168" text-anchor="middle" font-size="20">${id.includes("moon") ? "カレンダー" : "道具"}</text></svg>`;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
