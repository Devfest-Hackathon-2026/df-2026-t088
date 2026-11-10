import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HEADERS = ["file", "templateId", "leftPosition", "leftWeight", "rightPosition", "device", "conditions"];

export function createAnswerSidecars(csvText) {
  const [header, ...rows] = parseCsv(csvText);
  if (!header || HEADERS.some((name, index) => header[index] !== name) || header.length !== HEADERS.length) {
    throw new Error(`CSV の列は次の順にしてください: ${HEADERS.join(",")}`);
  }
  const generated = new Map();
  for (const [rowIndex, row] of rows.entries()) {
    if (row.length === 1 && !row[0]) continue;
    if (row.length !== HEADERS.length) throw new Error(`${rowIndex + 2} 行目の列数が違います。`);
    const [file, templateId, leftPosition, leftWeight, rightPosition, device, conditions] = row;
    if (!file || basename(file) !== file || extname(file).toLowerCase() !== ".jpg") throw new Error(`${rowIndex + 2} 行目の file は .jpg のファイル名にしてください。`);
    const jsonName = `${file.slice(0, -4)}.json`;
    if (generated.has(jsonName)) throw new Error(`${rowIndex + 2} 行目の file が重複しています。`);

    let expected;
    if (templateId === "rika-lever") {
      const values = [leftPosition, leftWeight, rightPosition].map(Number);
      if ([leftPosition, leftWeight, rightPosition].some((value) => !value) || values.some((value) => !Number.isInteger(value))) {
        throw new Error(`${rowIndex + 2} 行目のてこの正解の数が不正です。`);
      }
      expected = { templateId, params: { left: { pos: values[0], g: values[1] }, right: { pos: values[2] } } };
    } else if (templateId === "rika-moon") {
      expected = { templateId, params: {} };
    } else if (templateId === "none" || templateId === "unsupported") {
      expected = { templateId: null };
    } else {
      throw new Error(`${rowIndex + 2} 行目の templateId は rika-lever、rika-moon、none のいずれかにしてください。`);
    }

    generated.set(jsonName, {
      id: file.slice(0, -4),
      version: "photo",
      expected,
      ...(device ? { device } : {}),
      ...(conditions ? { conditions: conditions.split("|").map((condition) => condition.trim()).filter(Boolean) } : {}),
    });
  }
  return new Map([...generated].map(([name, value]) => [name, `${JSON.stringify(value, null, 2)}\n`]));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"' && cell.length === 0) quoted = true;
    else if (character === ",") { row.push(cell.trim()); cell = ""; }
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim()); rows.push(row); row = []; cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("CSV の引用符が閉じていません。");
  if (cell.length || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const csvPath = resolve(args[0] ?? "eval/real-photos/answers.csv");
  const outputDirectory = resolve(args[1] ?? dirname(csvPath));
  const generated = createAnswerSidecars(await readFile(csvPath, "utf8"));
  await mkdir(outputDirectory, { recursive: true });
  for (const [name, contents] of generated) await writeFile(resolve(outputDirectory, name), contents, "utf8");
  process.stdout.write(`${generated.size} 件の正解ファイルを作りました。\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "正解ファイルを作れませんでした。"}\n`);
    process.exitCode = 1;
  });
}
