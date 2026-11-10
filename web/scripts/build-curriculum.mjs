// 学習指導要領コード表（CSV）から、1〜6年×教科の章とマスのデータを作る（ADR-005）。開発の時だけ動かす。
// 使い方：cd web && npm run curriculum    → src/data/curriculum-items.ts を書く
// 章の並び（手で持つ順番）は src/data/curriculum.ts、5年算数と国語の漢字の章の構造は chapters.ts / kokugo.ts から読む。
// 読み（C-21）：漢字を含む語を kuromoji で `[語|よみ]` にする。誤りは reading-fixes.json（語→読み）で直す。
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "..");
export const CSV_PATH = resolve(WEB, "../research_notes/curriculum/code-table-v1.2.csv");
const OUT_PATH = resolve(WEB, "src/data/curriculum-items.ts");
const FIXES_PATH = resolve(HERE, "reading-fixes.json");

/** 1章のマスの上限（UI の D-112。章のテストを入れて10） */
export const MAX_ITEMS = 9;
const KANJI = /[一-鿿々〆]/;
/** 読みの直しで、続けて見る語の数の上限 */
const MAX_SPAN = 6;

// ---------- CSV ----------

/** 引用符付きのセル（改行・コンマ・"" を含む）を扱う CSV の読み。BOM は除く */
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** コード表の行。先頭の2行（版の見出しと列名）は除く */
export function readCodeTable(path = CSV_PATH) {
  return parseCsv(readFileSync(path, "utf8"))
    .slice(2)
    .filter((cells) => cells.length >= 4)
    .map(([subject, no, text, code]) => ({ subject, no, text, code }));
}

// ---------- コードの木 ----------
// 16桁のコードは、末尾の0を除いた部分（prefix）が長いほど深い。子の行は prefix が親の prefix で始まる行

const prefixOf = (code) => code.replace(/0+$/, "");

export function buildTree(rows) {
  const byPrefix = new Map(rows.map((row) => [prefixOf(row.code), row]));
  const parentOf = new Map();
  const children = new Map(rows.map((row) => [row.code, []]));
  for (const row of rows) {
    let prefix = prefixOf(row.code).slice(0, -1);
    while (prefix.length > 0 && !byPrefix.has(prefix)) prefix = prefix.slice(0, -1);
    const parent = byPrefix.get(prefix);
    if (!parent) continue;
    parentOf.set(row.code, parent);
    children.get(parent.code).push(row);
  }
  const byCode = new Map(rows.map((row) => [row.code, row]));
  return { byCode, parentOf, children };
}

/** 章のコードの下の末端の事項（コード表の順）。下に行が無ければ、そのコードの行そのもの */
export function leavesOf(tree, code) {
  const root = tree.byCode.get(code);
  if (!root) throw new Error(`コード表に無いコード：${code}`);
  const leaves = [];
  const walk = (row) => {
    const kids = tree.children.get(row.code);
    if (kids.length === 0) leaves.push(row);
    else kids.forEach(walk);
  };
  walk(root);
  return leaves;
}

// ---------- 本文の整形（C-20） ----------

// 頭の記号：(1) (ｱ) （ア）①。ア・Ａ・１ のように裸の記号は直後に空白がある時だけ（本文の頭の「ア」を削らない）
const MARKER = /^(?:[(（][ｱ-ﾝア-ン0-9０-９]+[)）]|[①-⑳]|(?:[ア-ン]|[A-ZＡ-Ｚ]|[0-9０-９]+)(?=[\s　]))[\s　]*/;

/** 改行と前後の空白を詰める。《よみ》はここでは残す */
export function tidy(text) {
  return text.replace(/[\s　]*\n[\s　]*/g, "").trim();
}

/** 頭の記号と、それを外した本文（《よみ》は残す）に分ける。記号は NFKC で `(ｱ)`→`(ア)`、`Ａ`→`A` */
export function headOf(raw) {
  const text = tidy(raw);
  const found = MARKER.exec(text);
  return { marker: found ? found[0].trim().normalize("NFKC") : "", rest: found ? text.slice(found[0].length) : text };
}

/** 画面に出す本文の元（記号と《よみ》と改行を除いたもの） */
export const bodyOf = (raw) => headOf(raw).rest.replace(/《[^》]*》/g, "").trim();
export const markerOf = (raw) => headOf(raw).marker;

// ---------- 読み（C-21、C-25） ----------

const toHiragana = (katakana) => katakana.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
const isHiragana = (text) => /^[ぁ-ゖー]+$/.test(text);

/**
 * 本文を `[語|よみ]` 入りの文字列にする関数を返す。本文の《よみ》は先に外してある（headOf は残すので、ruby に渡す前に除く）。
 * 読みは reading-fixes.json、kuromoji の順に引く。引けない語があれば missing に入る
 */
export function createRubyer(tokenizer, fixes) {
  const used = new Map();
  const missing = new Set();
  const ruby = (raw) => {
    const tokens = tokenizer.tokenize(raw.replace(/《[^》]*》/g, ""));
    let out = "";
    for (let i = 0; i < tokens.length; ) {
      // 続く語をつないだ形（「日清」「日，時，分」など、語ごとでは読みを誤る所）が直しの表にあれば、その読みを使う
      let span = 0;
      for (let length = Math.min(MAX_SPAN, tokens.length - i); length >= 2; length--) {
        if (tokens.slice(i, i + length).map((token) => token.surface_form).join("") in fixes) {
          span = length;
          break;
        }
      }
      const token = tokens[i];
      const surface = span > 0 ? tokens.slice(i, i + span).map((part) => part.surface_form).join("") : token.surface_form;
      i += Math.max(span, 1);
      if (!KANJI.test(surface)) {
        out += surface;
        continue;
      }
      const guess = span === 0 && token.reading && token.reading !== "*" ? toHiragana(token.reading) : "";
      const reading = fixes[surface] ?? (isHiragana(guess) ? guess : "");
      if (!reading) {
        missing.add(surface);
        out += surface;
        continue;
      }
      used.set(surface, { reading, source: surface in fixes ? "fix" : "kuromoji" });
      out += `[${surface}|${reading}]`;
    }
    return out;
  };
  return { ruby, used, missing };
}

// ---------- 章とマス ----------

/** 末端が n 個の章を、順番を保ってなるべく同じ数ずつ ceil(n/9) 個に分ける（C-11）。分けない時は [n] */
export function splitSizes(n, max = MAX_ITEMS) {
  const parts = Math.ceil(n / max);
  const base = Math.floor(n / parts);
  const extra = n % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

const DOMAIN_OF = { A: "number", B: "shape", C: "change", D: "data" };

/** 1つの末端の事項からマスを作る。base は章の記号（C-20 の source の頭） */
export function itemOf(tree, leaf, chapterRow, chapterName, base, rubyer) {
  const parent = tree.parentOf.get(leaf.code);
  // 柱書き（1つ上の行）が〔…〕（〔用語・記号〕や生活の内容のまとまり）の時と、章の行そのものの時（国語の (1) など）は、章の名前を learn にする
  const pillar = parent && parent !== chapterRow && !tidy(parent.text).startsWith("〔") ? parent : null;
  // source：章の記号（chapter.sources[i]）＋章の下から末端までの記号。作れなければコード
  const chain = [];
  for (let row = leaf; row && row !== chapterRow; row = tree.parentOf.get(row.code)) chain.unshift(markerOf(row.text));
  return {
    title: rubyer.ruby(headOf(leaf.text).rest),
    learn: pillar ? rubyer.ruby(headOf(pillar.text).rest) : chapterName,
    source: base + chain.join("") || leaf.code,
    codes: [leaf.code],
  };
}

const pad2 = (n) => String(n).padStart(2, "0");

/** 生成する章（5年算数の13章と kokugo-kanji-5 を除く全部）。出力の順は学年→教科→章 */
export function buildChapters(tree, curriculum, rubyer) {
  const chapters = [];
  for (const { grade, subjects } of curriculum) {
    for (const subject of subjects) {
      subject.chapters.forEach((chapter, index) => {
        if (chapter.chapterId) return;
        const name = rubyer.ruby(chapter.name);
        const items = [];
        chapter.codes.forEach((code, i) => {
          const chapterRow = tree.byCode.get(code);
          const baseSource = chapter.sources.length === chapter.codes.length && !tidy(chapterRow.text).startsWith("〔") ? chapter.sources[i] : "";
          for (const leaf of leavesOf(tree, code)) items.push(itemOf(tree, leaf, chapterRow, name, baseSource, rubyer));
        });
        const sizes = splitSizes(items.length);
        let from = 0;
        sizes.forEach((size, part) => {
          const suffix = sizes.length > 1 ? `（${part + 1}）` : "";
          const chapterId = `${subject.subjectId}-${grade}-${pad2(index + 1)}${sizes.length > 1 ? `-${part + 1}` : ""}`;
          const built = {
            id: chapterId,
            grade,
            subjectId: subject.subjectId,
            ordered: subject.isOrdered,
            tab: name + suffix,
            title: name + suffix,
            sources: chapter.sources,
          };
          if (subject.subjectId === "sansu") built.domain = DOMAIN_OF[chapter.sources[0][0]];
          built.items = items.slice(from, from + size);
          built.sides = [];
          from += size;
          chapters.push(built);
        });
      });
    }
  }
  return chapters;
}

/** 5年算数の13章。構造（id・マスの数・並び・寄り道・codes）は変えず、名前だけ学習指導要領の言葉にする（C-22）。国語の漢字の章は含めない（C-26） */
export function buildRenames(tree, curriculum, base, rubyer) {
  const renames = {};
  const grade5 = curriculum.find((entry) => entry.grade === 5).subjects;
  const sansu = grade5.find((subject) => subject.subjectId === "sansu").chapters;
  for (const chapter of base.chapters) {
    const entry = sansu.find((candidate) => candidate.chapterId === chapter.id);
    if (!entry) throw new Error(`CURRICULUM に chapterId ${chapter.id} が無い`);
    const name = rubyer.ruby(entry.name);
    const itemOfCode = (code) => {
      const row = tree.byCode.get(code);
      if (!row) throw new Error(`コード表に無いコード：${code}`);
      return row;
    };
    renames[chapter.id] = {
      tab: name,
      title: name,
      items: chapter.items.map((item) => {
        const row = itemOfCode(item.codes[0]);
        const parent = tree.parentOf.get(row.code);
        const usePillar = parent && !tidy(parent.text).startsWith("〔");
        return {
          title: rubyer.ruby(headOf(row.text).rest),
          learn: usePillar ? rubyer.ruby(headOf(parent.text).rest) : name,
        };
      }),
      sides: Object.fromEntries(
        chapter.sides.filter((side) => side.codes?.length).map((side) => [side.id, rubyer.ruby(headOf(itemOfCode(side.codes[0]).text).rest)]),
      ),
    };
  }
  // 国語の漢字の章は入れない。名前は kokugo.ts の「5年の漢字」を使う（C-26。(1)エ の本文は章札に出さない）
  return renames;
}

// ---------- 出力 ----------

const HEADER = `// 生成ファイル。手で直さない。
// 出典：文部科学省「小学校学習指導要領（平成29年告示）コード表 Ver 1.2」（research_notes/curriculum/code-table-v1.2.csv）を加工して作成
// 再生成：cd web && npm run curriculum
import type { Chapter } from "./types";
`;

const json = (value) => JSON.stringify(value);

function chapterSource(chapter) {
  const head = ["id", "grade", "subjectId", "ordered", "tab", "title", "sources", "domain"]
    .filter((key) => chapter[key] !== undefined)
    .map((key) => `    ${json(key)}: ${json(chapter[key])},`);
  const items = chapter.items.map((item) => `      ${json(item)},`);
  return `  {\n${head.join("\n")}\n    "items": [\n${items.join("\n")}\n    ],\n    "sides": [],\n  },`;
}

export function render(chapters, renames) {
  const renameLines = Object.entries(renames).map(([id, value]) => `  ${json(id)}: ${json(value)},`);
  return `${HEADER}
/** コード表から作った章。5年の算数の13章と国語の漢字の章は含まない（chapters.ts / kokugo.ts） */
export const GENERATED_CHAPTERS: Chapter[] = [
${chapters.map(chapterSource).join("\n")}
];

/** 5年の算数の13章の、学習指導要領の言葉の名前。マスと寄り道は chapters.ts の並びのまま */
export const RENAMED_CHAPTERS: Record<string, { tab: string; title: string; items: { title: string; learn: string }[]; sides: Record<string, string> }> = {
${renameLines.join("\n")}
};
`;
}

// ---------- 実行 ----------

/**
 * chapters.ts / kokugo.ts は、生成ファイルから名前を取り込む。生成の時はその取り込みを空の物に差し替えて読む。
 * 生成ファイルを入力にしないので、生成ファイルが無くても古くても同じ結果になる。拡張子の無い import も .ts に直す
 */
async function loadBaseData() {
  const { registerHooks } = await import("node:module");
  registerHooks({
    resolve(specifier, context, next) {
      if (!context.parentURL?.includes("/src/data/")) return next(specifier, context);
      if (/curriculum-items$/.test(specifier)) return { url: "data:text/javascript,export const RENAMED_CHAPTERS = {}", shortCircuit: true };
      if (specifier.startsWith(".") && !/\.\w+$/.test(specifier)) return next(`${specifier}.ts`, context);
      return next(specifier, context);
    },
  });
  const data = (name) => import(pathToFileURL(resolve(WEB, "src/data", name)).href);
  const [{ CURRICULUM }, { CHAPTERS }] = await Promise.all([data("curriculum.ts"), data("chapters.ts")]);
  return { CURRICULUM, chapters: CHAPTERS };
}

function buildTokenizer() {
  const kuromoji = createRequire(import.meta.url)("kuromoji");
  return new Promise((done, fail) => {
    kuromoji.builder({ dicPath: resolve(WEB, "node_modules/kuromoji/dict") }).build((error, tokenizer) => (error ? fail(error) : done(tokenizer)));
  });
}

export async function generate() {
  const rows = readCodeTable();
  const tree = buildTree(rows);
  const { CURRICULUM, chapters: base } = await loadBaseData();
  const fixes = JSON.parse(readFileSync(FIXES_PATH, "utf8"));
  const rubyer = createRubyer(await buildTokenizer(), fixes);
  const chapters = buildChapters(tree, CURRICULUM, rubyer);
  const renames = buildRenames(tree, CURRICULUM, { chapters: base }, rubyer);
  if (rubyer.missing.size > 0) {
    console.error(`読みが取れない語があります。reading-fixes.json に足してください：\n${[...rubyer.missing].join("\n")}`);
    process.exitCode = 1;
    return { chapters, renames, rubyer };
  }
  writeFileSync(OUT_PATH, render(chapters, renames));
  return { chapters, renames, rubyer };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chapters, renames } = await generate();
  const count = chapters.reduce((sum, chapter) => sum + chapter.items.length, 0);
  console.log(`章 ${chapters.length}、マス ${count}、名前を変えた章 ${Object.keys(renames).length} → ${OUT_PATH}`);
}
