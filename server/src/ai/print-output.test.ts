import assert from "node:assert/strict";
import test from "node:test";
import { toPrintOutput } from "./gemini-client.ts";

test("Gemini の平らなてこの数を、画面と同じ params に組み立てる", () => {
  assert.deepEqual(toPrintOutput({ problems: [
    { templateId: "rika-lever", questionText: "てこ", leverLeftPos: 2, leverLeftG: 30, leverRightPos: 3 },
    { templateId: "rika-moon", questionText: "月" },
  ], unsupportedCount: 0 }), { problems: [
    { templateId: "rika-lever", questionText: "てこ", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } },
    { templateId: "rika-moon", questionText: "月", params: {} },
  ], unsupportedCount: 0 });
});

test("0 や未使用の分数演算子から params を組み立てない", () => {
  assert.deepEqual(toPrintOutput({ problems: [
    { templateId: "rika-lever", questionText: "てこ", leverLeftPos: 2, leverLeftG: 0, leverRightPos: 3 },
    { templateId: "sansu-fraction-addsub", questionText: "分数", fractionLeftNum: 1, fractionLeftDen: 2, fractionOp: "unused", fractionRightNum: 1, fractionRightDen: 3 },
  ], unsupportedCount: 0 }), { problems: [
    { templateId: "rika-lever", questionText: "てこ" },
    { templateId: "sansu-fraction-addsub", questionText: "分数" },
  ], unsupportedCount: 0 });
});

test("none の単元を残し、一覧外は other にする", () => {
  assert.deepEqual(toPrintOutput({ problems: [
    { templateId: "none", questionText: "分数", unit: "sansu-6-01" },
    { templateId: "none", questionText: "速さ", unit: "not-a-unit" },
    { templateId: "rika-moon", questionText: "月" },
  ], unsupportedCount: 1 }), { problems: [
    { templateId: "none", questionText: "分数", unit: "sansu-6-01" },
    { templateId: "none", questionText: "速さ", unit: "other" },
    { templateId: "rika-moon", questionText: "月", params: {} },
  ], unsupportedCount: 1 });
});
