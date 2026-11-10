import test from "node:test";
import assert from "node:assert/strict";
import { checkParts, type PartsData } from "./parts-check.ts";

function example(): PartsData {
  return { problem: "1/2 + 1/3", tool: "fraction_tiles", pieces: [
    { num: 1, den: 2, count: 1 }, { num: 1, den: 3, count: 1 }, { num: 1, den: 6, count: 6 },
  ], answer: { num: 5, den: 6 }, hints: ["1/6 を1/2に当ててみよう", "1/3にも当ててみよう"] };
}

function hasCode(data: unknown, code: string): boolean {
  const result = checkParts(data);
  return !result.ok && result.errors.some((error) => error.code === code);
}

test("accepts the chapter example, and rejects incorrect answers and insufficient tiles", () => {
  assert.deepEqual(checkParts(example()), { ok: true, reduced: true });
  const wrong = example(); wrong.answer = { num: 2, den: 5 };
  assert.equal(hasCode(wrong, "answer_mismatch"), true);
  // 1/2 は 1/6 の3枚分、1/3 は2枚分。5枚あれば 5/6 に届き、4枚では届かない
  const justEnough = example(); justEnough.pieces[2]!.count = 5;
  assert.equal(checkParts(justEnough).ok, true);
  const short = example(); short.pieces[2]!.count = 4;
  assert.equal(hasCode(short, "unreachable_answer"), true);
  const noCommonUnit = example(); noCommonUnit.pieces = noCommonUnit.pieces.filter((piece) => piece.den !== 6);
  assert.equal(hasCode(noCommonUnit, "unreachable_answer"), true);
});

test("checks hint leakage and data shapes", () => {
  for (const hint of ["答えは5/6です", "答えは５／６です", "答えは6分の5です", "答えは６分の５です", "答えは５/６", "答えは 5 / 6"]) {
    const data = example(); data.hints = [hint];
    assert.equal(hasCode(data, "answer_in_hint"), true);
  }
  for (const change of [
    (data: PartsData) => { data.pieces[0]!.den = 0; },
    (data: PartsData) => { data.pieces[0]!.num = -1; },
    (data: PartsData) => { (data.pieces[0]! as any).num = 0.5; },
    (data: PartsData) => { data.pieces[0]!.count = 0; },
    (data: PartsData) => { data.pieces[0]!.num = 0; },
    (data: PartsData) => { data.tool = "area_model"; },
  ]) {
    const data = example(); change(data);
    assert.equal(checkParts(data).ok, false);
  }
});

test("enforces the tentative piece and hint limits", () => {
  const tooManyPieces = example();
  tooManyPieces.pieces.push(
    { num: 1, den: 4, count: 1 }, { num: 1, den: 5, count: 1 },
    { num: 1, den: 7, count: 1 }, { num: 1, den: 8, count: 1 },
  );
  assert.equal(checkParts(tooManyPieces).ok, false);

  const tooManyTiles = example();
  tooManyTiles.pieces[2]!.count = 101;
  assert.equal(checkParts(tooManyTiles).ok, false);

  for (const hints of [[], ["1", "2", "3", "4"]]) {
    const invalidHints = example();
    invalidHints.hints = hints;
    assert.equal(checkParts(invalidHints).ok, false);
  }
});

test("supports subtraction, improper results, and equivalent unreduced answers", () => {
  const subtract = example(); subtract.problem = "3/4 - 1/6";
  subtract.pieces = [{ num: 3, den: 4, count: 1 }, { num: 1, den: 6, count: 1 }, { num: 1, den: 12, count: 12 }];
  subtract.answer = { num: 7, den: 12 };
  assert.equal(checkParts(subtract).ok, true);

  const greaterThanOne = example(); greaterThanOne.problem = "3/4 + 2/3";
  greaterThanOne.pieces = [{ num: 3, den: 4, count: 1 }, { num: 2, den: 3, count: 1 }, { num: 1, den: 12, count: 17 }];
  greaterThanOne.answer = { num: 17, den: 12 };
  assert.equal(checkParts(greaterThanOne).ok, true);

  const unreduced = example(); unreduced.problem = "1/6 + 1/3";
  unreduced.pieces = [{ num: 1, den: 6, count: 1 }, { num: 1, den: 3, count: 1 }, { num: 1, den: 6, count: 6 }];
  unreduced.answer = { num: 3, den: 6 };
  unreduced.hints = ["同じ大きさのピースを探そう"];
  assert.deepEqual(checkParts(unreduced), { ok: true, reduced: false });

  const negative = example(); negative.problem = "1/3 - 1/2";
  negative.pieces = [{ num: 1, den: 3, count: 1 }, { num: 1, den: 2, count: 1 }, { num: 1, den: 6, count: 6 }];
  negative.answer = { num: 0, den: 1 };
  assert.equal(hasCode(negative, "negative_result"), true);
});

test("does not flag natural hints when the answer equals an operand or the unit piece", () => {
  // 1/2 - 1/3 = 1/6 は、単位のピースも 1/6。ヒントが 1/6 に触れるのは当たり前なので落とさない
  const unitAnswer = example(); unitAnswer.problem = "1/2 - 1/3";
  unitAnswer.pieces = [{ num: 1, den: 2, count: 1 }, { num: 1, den: 3, count: 1 }, { num: 1, den: 6, count: 3 }];
  unitAnswer.answer = { num: 1, den: 6 };
  unitAnswer.hints = ["1/6 を 1/2 に当ててみよう", "1/6 を 1/3 にも当ててみよう"];
  assert.deepEqual(checkParts(unitAnswer), { ok: true, reduced: true });

  // 1/2 - 1/4 = 1/4 は、答えが式の分数と同じ
  const operandAnswer = example(); operandAnswer.problem = "1/2 - 1/4";
  operandAnswer.pieces = [{ num: 1, den: 2, count: 1 }, { num: 1, den: 4, count: 1 }, { num: 1, den: 4, count: 2 }];
  operandAnswer.answer = { num: 1, den: 4 };
  operandAnswer.hints = ["1/4 を 1/2 に当ててみよう", "1/4 を 1/4 にも当ててみよう"];
  assert.equal(checkParts(operandAnswer).ok, true);

  // 数字が続く別の分数（15/6）は、答え 5/6 の漏れではない
  const longerNumber = example(); longerNumber.hints = ["15/6 より小さくなるかな"];
  assert.equal(checkParts(longerNumber).ok, true);
});

test("returns a reason when the problem expression cannot be read", () => {
  for (const problem of ["1 1/2 + 1/3", "1/2 + 1/3 + 1/4", "りんごを半分食べた"]) {
    const data = example(); data.problem = problem;
    assert.equal(hasCode(data, "invalid_problem"), true);
  }
});

test("does not exempt the hint check by adding pieces equal to the answer", () => {
  // 5/6 は 1/2 と 1/3 の共通の単位ではないので、ピースを足してもヒント検査は止まらない
  const data = example(); data.pieces.push({ num: 5, den: 6, count: 1 }); data.hints = ["答えは5/6です"];
  assert.equal(hasCode(data, "answer_in_hint"), true);
  const sameValue = example(); sameValue.problem = "1/4 + 1/4";
  sameValue.pieces = [{ num: 1, den: 4, count: 2 }, { num: 1, den: 2, count: 1 }];
  sameValue.answer = { num: 1, den: 2 }; sameValue.hints = ["答えは1/2"];
  assert.equal(hasCode(sameValue, "answer_in_hint"), true);
});

test("allows natural hints when the answer equals an operand or the common unit piece", () => {
  const unitAnswer = example(); unitAnswer.problem = "1/2 - 1/3";
  unitAnswer.pieces = [{ num: 1, den: 2, count: 1 }, { num: 1, den: 3, count: 1 }, { num: 1, den: 6, count: 3 }];
  unitAnswer.answer = { num: 1, den: 6 }; unitAnswer.hints = ["1/6 を 1/2 に当ててみよう", "1/6 を 1/3 にも当ててみよう"];
  assert.deepEqual(checkParts(unitAnswer), { ok: true, reduced: true });

  const operandAnswer = example(); operandAnswer.problem = "1/2 - 1/4";
  operandAnswer.pieces = [{ num: 1, den: 2, count: 1 }, { num: 1, den: 4, count: 2 }];
  operandAnswer.answer = { num: 1, den: 4 }; operandAnswer.hints = ["1/4 を 1/2 に当ててみよう"];
  assert.equal(checkParts(operandAnswer).ok, true);

  // 数字が続く別の分数（15/6）は、答え 5/6 の漏れではない
  const longerNumber = example(); longerNumber.hints = ["15/6 より小さくなるかな"];
  assert.equal(checkParts(longerNumber).ok, true);
});

test("detects equivalent ways of writing the answer in a hint", () => {
  for (const hint of [
    "答えは10/12です", "5⁄6になるよ", "答えは5÷6", "6ぶんの5だよ", "六分の五だね", "⅚ かな", "答えは 5 ／ 6", "六ぶんの五",
  ]) {
    const data = example(); data.hints = [hint];
    assert.equal(hasCode(data, "answer_in_hint"), true, hint);
  }
  const multiple = example(); multiple.problem = "1/6 + 1/3";
  multiple.pieces = [{ num: 1, den: 6, count: 1 }, { num: 1, den: 3, count: 1 }, { num: 1, den: 6, count: 6 }];
  multiple.answer = { num: 1, den: 2 }; multiple.hints = ["3/6 になるよ"];
  assert.equal(hasCode(multiple, "answer_in_hint"), true);

  const mixed = example(); mixed.problem = "3/4 + 2/3";
  mixed.pieces = [{ num: 3, den: 4, count: 1 }, { num: 2, den: 3, count: 1 }, { num: 1, den: 12, count: 17 }];
  mixed.answer = { num: 17, den: 12 };
  for (const hint of ["1と5/12 です", "1 5/12 だよ", "1と12分の5", "17/12 だよ"]) {
    mixed.hints = [hint];
    assert.equal(hasCode(mixed, "answer_in_hint"), true, hint);
  }
  mixed.hints = ["1より大きくなるかな", "12ぶんの17は?"];
  assert.equal(hasCode(mixed, "answer_in_hint"), true);
  mixed.hints = ["1より大きくなるかな"];
  assert.equal(checkParts(mixed).ok, true);

  const whole = example(); whole.problem = "1/2 + 1/2";
  whole.pieces = [{ num: 1, den: 2, count: 2 }, { num: 1, den: 4, count: 4 }];
  whole.answer = { num: 1, den: 1 };
  for (const hint of ["答えは1です", "答えは１", "1/2+1/2=1", "ぜんぶで1になるよ"]) {
    whole.hints = [hint];
    assert.equal(hasCode(whole, "answer_in_hint"), true, hint);
  }
  whole.hints = ["1/4 を4つ並べてみよう", "1つずつ数えよう"];
  assert.equal(checkParts(whole).ok, true);
});

test("counts reachable tiles for an unreduced expression", () => {
  const data = example(); data.problem = "2/4 + 1/3";
  data.pieces = [{ num: 2, den: 4, count: 1 }, { num: 1, den: 3, count: 1 }, { num: 1, den: 6, count: 5 }];
  assert.equal(checkParts(data).ok, true);
  data.pieces[2]!.count = 4;
  assert.equal(hasCode(data, "unreachable_answer"), true);
});

function problemData(problem: string, answer: { num: number; den: number }, hints: string[]): PartsData {
  return { problem, tool: "fraction_tiles", pieces: [{ num: 1, den: 12, count: 24 }], answer, hints };
}

test("does not treat parts of a fraction as an integer or mixed-number answer", () => {
  const cases: Array<[string, { num: number; den: number }, string]> = [
    ["1/2 + 2/4", { num: 1, den: 1 }, "2/4 は 2分の1になるね"],
    ["1/2 + 1/2", { num: 1, den: 1 }, "1/4 を2つあわせると2分の1になるね"],
    ["3/2 + 5/6", { num: 7, den: 3 }, "1/2 と 1/3 に分けて考えよう"],
    ["3/2 + 5/6", { num: 7, den: 3 }, "1/2 と 1分の3 に分けて考えよう"],
    ["1/2 + 3/2", { num: 2, den: 1 }, "1/4+1/4=2分の1 だね"],
    ["1/2 + 2/4", { num: 1, den: 1 }, "1になるまで足そう"],
    ["1/2 + 2/4", { num: 1, den: 1 }, "1を4つに分けてみよう"],
  ];
  for (const [problem, answer, hint] of cases) {
    assert.equal(hasCode(problemData(problem, answer, [hint]), "answer_in_hint"), false, hint);
  }
});

test("detects integer answers written as a statement, and \\frac and rare vulgar fractions", () => {
  const leaks: Array<[string, { num: number; den: number }, string]> = [
    ["1/2 + 2/4", { num: 1, den: 1 }, "1になります"],
    ["1/2 + 2/4", { num: 1, den: 1 }, "ぜんぶで1です"],
    ["1/2 + 2/4", { num: 1, den: 1 }, "1だよ"],
    ["1/2 + 2/4", { num: 1, den: 1 }, "ぜんぶで１になるね"],
    ["1/2 - 1/2", { num: 0, den: 1 }, "0です"],
    ["1/2 + 3/2", { num: 2, den: 1 }, "2になるよ"],
    ["3/7 + 1/7", { num: 4, den: 7 }, "答えは \\frac{4}{7} だよ"],
    ["3/7 + 4/14", { num: 5, den: 7 }, "5/7 かな"],
    ["1/14 + 1/14", { num: 1, den: 7 }, "⅐ だよ"],
    ["1/20 + 1/20", { num: 1, den: 10 }, "⅒ だよ"],
    ["3/4 + 2/3", { num: 17, den: 12 }, "ステップ2 は 1 5/12 だよ"],
  ];
  for (const [problem, answer, hint] of leaks) {
    assert.equal(hasCode(problemData(problem, answer, [hint]), "answer_in_hint"), true, hint);
  }
});

test("does not flag ordinary hints", () => {
  const ordinary = [
    "同じ大きさのピースを探そう", "1つずつ数えよう", "1枚ずつ重ねてみよう", "ステップ1 から始めよう",
    "1/4 のピースを2個使おう", "2分の1 と 4分の2 を比べてみよう", "まず分母をそろえよう", "1分だけ考えてみよう",
    "ピースを3つ並べると分かりやすいよ", "1番目のピースから置こう", "0から数えてみよう", "もう1回やってみよう",
  ];
  for (const [problem, answer] of [["1/2 + 2/4", { num: 1, den: 1 }], ["1/2 - 1/2", { num: 0, den: 1 }]] as const) {
    for (const hint of ordinary) {
      assert.equal(hasCode(problemData(problem, answer, [hint]), "answer_in_hint"), false, `${problem}: ${hint}`);
    }
  }
});
