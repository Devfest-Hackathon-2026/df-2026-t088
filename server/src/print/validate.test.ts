import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PRINT_TEMPLATES } from "./templates.ts";
import { PRINT_DEMAND_UNITS } from "./demand.ts";
import { validatePrintOutput } from "./validate.ts";

test("画面とサーバの型 ID が一致する", async () => {
  // 画面の型の一覧（web/src/pages/print/templates.ts）から id を読む。web の型を server から import しないため、文字で読む
  const source = await readFile(new URL("../../../web/src/pages/print/templates.ts", import.meta.url), "utf8");
  const webIds = [...source.matchAll(/\bid: "([a-z0-9-]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(webIds, PRINT_TEMPLATES.map((template) => template.id).sort());
});

test("需要単元の id はカリキュラムにある6年の算数・理科と一致する", async () => {
  const source = await readFile(new URL("../../../web/src/data/curriculum-items.ts", import.meta.url), "utf8");
  const webIds = [...source.matchAll(/"id": "((?:sansu|rika)-6-\d{2})",\s*"grade": 6,\s*"subjectId": "(?:sansu|rika)"/g)]
    .map((match) => match[1]).sort();
  // sansu-5-fraction は 6 年のカリキュラムの外にある、分数の型の範囲外を数えるための 1 件
  assert.deepEqual(PRINT_DEMAND_UNITS.map(({ id }) => id).filter((id) => id !== "sansu-5-fraction").sort(), webIds);
});

const lever = { templateId: "rika-lever", questionText: "てこの問題", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } };
const moon = { templateId: "rika-moon", questionText: "月の問題", params: {} };

test("読み取った問題から型に合わないものを落とし、6個を超えた分も数える", () => {
  const result = validatePrintOutput({ problems: [lever, { ...lever, params: { left: { pos: 2, g: 20 }, right: { pos: 3 } } }, moon, ...Array.from({ length: 5 }, () => moon)] });
  assert.equal(result.problems.length, 6);
  assert.equal(result.unsupportedCount, 2);
});

test("none の問題は単元を集計対象にし、一覧に無い値を other にする", () => {
  const result = validatePrintOutput({ problems: [
    { templateId: "none", questionText: "分数", unit: "sansu-6-01" },
    { templateId: "none", questionText: "知らない単元", unit: "not-a-unit" },
  ], unsupportedCount: 0 });
  assert.equal(result.unsupportedCount, 2);
  assert.deepEqual(result.unsupportedUnits, ["sansu-6-01", "other"]);
  assert.deepEqual(result.issues, []);
});

test("てこの答えが10の倍数でない値、範囲外の位置・重さを落とす", () => {
  for (const params of [
    { left: { pos: 2, g: 30 }, right: { pos: 4 } },
    { left: { pos: 7, g: 30 }, right: { pos: 3 } },
    { left: { pos: 2, g: 110 }, right: { pos: 3 } },
    { left: { pos: 2, g: 30 }, right: { pos: 0 } },
  ]) {
    const result = validatePrintOutput({ problems: [{ ...lever, params }] });
    assert.equal(result.problems.length, 0);
    assert.equal(result.unsupportedCount, 1);
  }
});

test("読めない応答と問題なし応答を区別する", () => {
  assert.equal(validatePrintOutput({ unreadable: true, problems: [] }).unreadable, true);
  assert.equal(validatePrintOutput({ problems: [] }).unreadable, false);
});

test("型の言葉が問題文に無いもの（型の取り違え）は、作り直しを頼まずに落とす", () => {
  const result = validatePrintOutput({ problems: [{ templateId: "rika-moon", questionText: "1/2L のジュースの 2/3 を飲みました。何 L ですか。", params: {} }], unsupportedCount: 0 });
  assert.equal(result.problems.length, 0);
  assert.equal(result.unsupportedCount, 1);
  assert.deepEqual(result.issues, []);
});
