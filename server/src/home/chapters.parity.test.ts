import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LINK_CHAPTERS } from "./chapters.ts";

// 選べる章の正本は web の教材データ。server は web を import しない（ビルドの境界）。
// この試験だけが web のソースを文字として読み、server の写し（chapters.ts）と章の id・名前を比べる。
const webSource = (path: string) => readFileSync(new URL(`../../../web/src/${path}`, import.meta.url), "utf8");
const plain = (ruby: string) => ruby.replace(/\[([^|\]]+)\|[^\]]+\]/g, "$1");

// 章のテストの出題表（`{章 id}:test`）がある章 id
function webTestChapterIds(): Set<string> {
  const ids = new Set<string>();
  for (const file of ["lesson/plans/sansu-5.ts", "lesson/kokugo-lessons.ts"]) {
    for (const match of webSource(file).matchAll(/"([a-z0-9-]+):test"/g)) ids.add(match[1] ?? "");
  }
  return ids;
}

// 章の表示名：算数は RENAMED_CHAPTERS（生成物）の名前が優先、無ければ章の定義の title
function webChapterName(id: string): string | undefined {
  const renamed = new RegExp(`"${id}": \\{"tab":"[^"]*","title":"([^"]*)"`).exec(webSource("data/curriculum-items.ts"));
  if (renamed) return plain(renamed[1] ?? "");
  const base = new RegExp(`id: "${id}",[\\s\\S]*?title: "([^"]*)"`).exec(webSource("data/chapters.ts") + webSource("data/kokugo.ts"));
  return base ? plain(base[1] ?? "") : undefined;
}

test("web の出題表を読めている（章のテストが2つ以上見つかる）", () => {
  assert.ok(webTestChapterIds().size >= 2);
});

test("選べる章は、web に章のテストの出題表がある章だけ", () => {
  const tests = webTestChapterIds();
  for (const { chapterId } of LINK_CHAPTERS) assert.ok(tests.has(chapterId), `${chapterId} に章のテストの出題表が無い`);
});

test("選べる章の名前は、web の章の表示名（ふりがなを除く）と同じ", () => {
  for (const { chapterId, name } of LINK_CHAPTERS) assert.equal(name, webChapterName(chapterId), chapterId);
});
