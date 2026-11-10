import { describe, expect, it } from "vitest";

// @types/node が無いので、fs は文字列をつないで読み込む（loading-boot.test.ts と同じ。vitest は web/ で動かす）
const { readFileSync } = (await import(/* @vite-ignore */ "node:" + "fs")) as { readFileSync: (path: string, encoding: "utf8") => string };

// 先生の画面の文言は、docs/design/ui/08_copy.md（正本）と teacher/copy.ts で同じ文でなければならない（D-T05）。
// 08 の行は「| CP-xxx | 場所 | 種類 | 文言 |」。文言に ruby の記法（[漢字|かな]）が無い行だけを比べる。
const DOC = "../docs/design/ui/08_copy.md";
const SOURCE = "src/teacher/copy.ts";

function teacherRows(): { id: string; text: string }[] {
  const lines = readFileSync(DOC, "utf8").split("\n");
  const rows: { id: string; text: string }[] = [];
  for (const line of lines) {
    // 先生の画面は CP-931〜CP-989（提出の状況と名簿の CP-970〜989 を含む）と、管理の画面 CP-1001〜CP-1099（#196、課題・時間割）、学級のようす CP-1089〜CP-1115（#235）、単元 CP-1116〜CP-1122（#255）。
    // 子どもの画面（CP-9xx の前の番号）と立て直しの画面（CP-921〜923）、見本の名簿（CP-990）と CP-991〜999（子どものアカウント）は、ここでは比べない。
    // {時刻} などの差し込みのある行は、この試験では比べない
    const match = /^\| (CP-(?:9(?:3[1-9]|[4-8]\d)|10\d\d|110\d|111\d|112[0-2]|140[1-9]|141[0-3])) \|/.exec(line);
    if (!match) continue;
    if (line.includes("[")) continue; // ruby の記法は、この試験では比べない
    if (line.includes("{")) continue; // 差し込みのある文は関数にしてあるので、この試験では比べない
    const cells = line.split("|").map((cell) => cell.trim()).filter((cell) => cell !== "");
    const text = cells[cells.length - 1] ?? "";
    rows.push({ id: match[1] ?? "", text });
  }
  return rows;
}

describe("先生の画面の文言（08_copy.md と teacher/copy.ts）", () => {
  it("08_copy.md の先生の画面の行が見つかる", () => {
    expect(teacherRows().length).toBeGreaterThanOrEqual(30);
  });

  it("08_copy.md の各文言が、teacher/copy.ts に同じ文で書かれている", () => {
    const source = readFileSync(SOURCE, "utf8");
    const missing = teacherRows().filter((row) => !source.includes(row.text)).map((row) => `${row.id} ${row.text}`);
    expect(missing).toEqual([]);
  });
});
