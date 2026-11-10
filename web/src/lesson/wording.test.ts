import { describe, expect, it } from "vitest";
import { fractionsEqual } from "./fraction";
import type { NumberAnswer, NumberProblem, NumberTopic } from "./number-problem";
import { calculateProblem, compareProblem, divideProblem, equivalentProblem, estimateProblem, gameOf, reduceProblem } from "./problems";
import type { LessonNotice } from "./session";
import type { TileGame } from "./tiles";
import {
  afterParts, choiceParts, compareExpectedParts, LESSON_COPY, expressionName, fractionName, guideParts, MESSAGES, mixedName, noticeParts, NUMBER_COPY,
  numberAfterParts, numberAnswerLabel, numberChoices, numberExpressionParts, numberTaskParts, remainingLabel, rulerTileName, ruleText, trayTileName,
} from "./wording";
import type { InlinePart } from "./wording";
import { plainText } from "../ruby-text";

const f = (num: number, den: number) => ({ num, den });

const games: TileGame[] = [
  calculateProblem(f(1, 2), "+", f(1, 3)), calculateProblem(f(1, 2), "+", f(3, 4)), calculateProblem(f(5, 6), "-", f(1, 3)),
].map(gameOf);
const [add, overOne, subtract] = games as [TileGame, TileGame, TileGame];

// 学年の外（漢字のまま）の文にそろえて比べる。`[語|よみ]` は語になる
const textOf = (parts: InlinePart[]): string =>
  plainText(parts.map((part) => (typeof part === "string" ? part : `${part.num}/${part.den}`)).join(""));

describe("案内", () => {
  it("たし算の案内は置くタイルだけを言い、うめるタイルは言わない", () => {
    expect(textOf(guideParts(add))).toBe(plainText("ものさしに 1/2 と 1/3 のタイルを置きましょう"));
  });

  it("ひき算の案内は、置くタイルと取るタイルだけを言う", () => {
    expect(textOf(guideParts(subtract))).toBe(plainText("ものさしに 5/6 のタイルを置いて、1/3 のタイルを上に[重|かさ]ねて取りましょう"));
  });

  it("帯分数の式は、案内でも帯分数とタイルの名前を並べて、はじめから結びつける", () => {
    const parts = guideParts(gameOf(calculateProblem(f(5, 4), "+", f(1, 2), true)));
    expect(parts[1]).toEqual({ num: 5, den: 4, mixed: true });
    expect(textOf(parts)).toBe(plainText("ものさしに 5/4（5/4） と 1/2 のタイルを置きましょう"));
    const subtractMixed = guideParts(gameOf(calculateProblem(f(5, 3), "-", f(1, 2), true)));
    expect(subtractMixed[1]).toEqual({ num: 5, den: 3, mixed: true });
  });

  it("約分の案内は、うめるタイルの大きさを言わない", () => {
    expect(textOf(guideParts(gameOf(reduceProblem(f(4, 6), f(1, 2)))))).toBe(plainText("ものさしに 4/6 のタイルを置いて、もっと大きいタイルでうめてみましょう"));
  });

  it("ヒントは案内のくり返しにせず、うめるタイルは2つ目より後で開く", () => {
    const { hints } = calculateProblem(f(1, 2), "+", f(1, 3));
    expect(hints[0]).not.toContain("1/6");
    expect(hints.slice(1).map(plainText)).toEqual(["1/6 を 1/2 に当ててみましょう", "1/6 を 1/3 に当ててみましょう"]);
    expect(calculateProblem(f(1, 6), "+", f(1, 2)).hints.slice(1).map(plainText)).toEqual(["1/6 を 1/2 に当ててみましょう"]);
  });

  it("案内に出る分数は、どれもタイル置き場にある", () => {
    for (const game of games) {
      const fractions = guideParts(game).filter((part) => typeof part !== "string");
      for (const fraction of fractions) expect(game.pieces.some((piece) => fractionsEqual(piece, fraction))).toBe(true);
    }
  });

  it("タイルを動かせないときの案内も、分数を名前で言う", () => {
    expect(textOf(noticeParts("take_on_left", subtract))).toBe(plainText("1/3 のタイルは、うめたタイルの上に重ねましょう"));
    expect(textOf(noticeParts("fill_first", subtract))).toBe(plainText("先に、1/6 のタイルでうめてみましょう"));
    expect(textOf(noticeParts("mixed_unit", subtract))).toBe(plainText("1/6 のタイルで、うめてみましょう"));
    expect(textOf(noticeParts("loose_unit", add))).toBe(plainText("1/6 のタイルは、ほかのタイルの上に重ねてみましょう"));
    expect(textOf(noticeParts("place_first", add))).toBe(plainText("先に、1/2 と 1/3 のタイルを、ものさしに置きましょう"));
    expect(textOf(noticeParts("place_first", subtract))).toBe(plainText("先に、5/6 のタイルを、ものさしに置きましょう"));
    const others: LessonNotice[] = ["none_left", "ruler_full", "already_full", "already_taken", "no_more_hints", "no_fit", "tiles_next"];
    for (const notice of others) expect(textOf(noticeParts(notice, overOne))).not.toBe("");
  });
});

describe("正解の後の一言", () => {
  const problem = calculateProblem(f(1, 6), "+", f(1, 2));

  it("約分できる答えには、約分した形を見せる", () => {
    expect(textOf(afterParts(problem, gameOf(problem), "4/6"))).toBe(plainText("4/6 は[約分|やくぶん]すると 2/3 です。"));
    expect(afterParts(problem, gameOf(problem), "2/3")).toEqual([]);
  });

  it("1を超える答えには、帯分数への言い換えを見せる", () => {
    const over = calculateProblem(f(1, 2), "+", f(3, 4));
    expect(textOf(afterParts(over, gameOf(over), "5/4"))).toBe(plainText("5/4 は 5/4 とも書けます"));
    expect(afterParts(over, gameOf(over), "5/4").at(-2)).toEqual({ num: 5, den: 4, mixed: true });
  });

  it("くらべる問題は分母をそろえた形を、見積もりは計算の結果を見せる", () => {
    const compare = compareProblem(f(1, 2), f(2, 5));
    expect(textOf(afterParts(compare, gameOf(compare), ""))).toBe(plainText("分母をそろえると 5/10 と 4/10 です"));
    const estimate = estimateProblem(f(3, 4), "+", f(1, 2), f(1, 1));
    expect(textOf(afterParts(estimate, gameOf(estimate), ""))).toBe(plainText("計算すると 5/4 です"));
    // 式の答えは帯分数で見せるので、文も同じ形にする
    expect(afterParts(estimate, gameOf(estimate), "").at(1)).toEqual({ num: 5, den: 4, mixed: true });
  });
});

describe("選択肢", () => {
  it("くらべる問題は3つ、見積もりは2つ", () => {
    expect(choiceParts(compareProblem(f(1, 2), f(2, 5))).map(({ choice }) => choice)).toEqual(["left", "right", "same"]);
    expect(choiceParts(estimateProblem(f(3, 4), "+", f(1, 2), f(1, 1))).map(({ parts }) => textOf(parts))).toEqual(["1/1 より大きい", "1/1 より小さい"]);
  });
});

describe("読み上げの名前", () => {
  it("分数は分母から読む", () => {
    expect(plainText(fractionName({ num: 1, den: 2 }))).toBe("2分の1");
    expect(plainText(expressionName(subtract.problem))).toBe("6分の5 ひく 3分の1");
    expect(plainText(mixedName({ num: 5, den: 4 }))).toBe("1と4分の1");
    expect(plainText(mixedName({ num: 3, den: 4 }))).toBe("4分の3");
    expect(plainText(fractionName({ num: 1, den: 1 }))).toBe("1");
  });

  it("タイルの名前に残りの枚数と重ねた枚数を入れる", () => {
    expect(remainingLabel(0)).toBe("のこり 0");
    expect(plainText(trayTileName({ num: 1, den: 6 }, 5))).toBe("1/6、6分の1のタイル。のこり 5");
    const tile = { id: 1, key: "5/6", coverKey: "1/6", coverCount: 5, takenKey: "1/3" };
    expect(plainText(rulerTileName(subtract, tile))).toBe("5/6、6分の5のタイル。6分の1を 5 まい重ねています。3分の1を取りました");
  });
});

// CP-466〜CP-474（docs/design/ui/08_copy.md）。文はそのまま、{} の所にだけ値が入る
describe("わり算と分数・同じ大きさの分数の文", () => {
  const divide = divideProblem(3, 4);
  const whole = divideProblem(6, 3);
  const equivalent = equivalentProblem(f(1, 2), 4);

  it("CP-466 問題の文", () => {
    expect(plainText(LESSON_COPY.divideTask(3, 4))).toBe(plainText("3÷4 の商を、分数で表しましょう"));
  });

  it("CP-467 タイルの案内", () => {
    expect(textOf(guideParts(gameOf(divide)))).toBe(plainText("ものさしに 1/4 のタイルを 3まい置きましょう"));
  });

  it("CP-468 正解の後。わり切れない時は続けない", () => {
    expect(textOf(afterParts(divide, gameOf(divide), "3/4"))).toBe(plainText("3÷4 の商は、1/4 の 3こ分で 3/4 です"));
  });

  it("CP-468・CP-469 わり切れる時は、整数でも書けると続ける。分数は約分しない", () => {
    expect(textOf(afterParts(whole, gameOf(whole), "2"))).toBe(plainText("6÷3 の商は、1/3 の 6こ分で 6/3 です。6/3 は 2 とも書けます"));
  });

  it("CP-470 問題の文", () => {
    expect(plainText(LESSON_COPY.equivalentTask)).toBe(plainText("□ に入る数を入れましょう"));
  });

  it("CP-471 タイルの案内", () => {
    expect(textOf(guideParts(gameOf(equivalent)))).toBe(plainText("ものさしに 1/2 のタイルを置いて、1/4 のタイルでうめてみましょう"));
  });

  it("CP-472 かける・CP-473 わる", () => {
    expect(textOf(afterParts(equivalent, gameOf(equivalent), "2"))).toBe(plainText("分母と分子に同じ数 2 をかけると、同じ大きさの分数になります"));
    const down = equivalentProblem(f(4, 6), 3);
    expect(textOf(afterParts(down, gameOf(down), "2"))).toBe(plainText("分母と分子を同じ数 2 でわると、同じ大きさの分数になります"));
  });

  it("CP-474 答えのラベル", () => {
    expect(plainText(LESSON_COPY.equivalentLabel)).toBe(plainText("□ に入る数"));
  });

  it("図でくらべる時の名前は答えを書かない", () => {
    expect(textOf(compareExpectedParts(divide, gameOf(divide)))).toBe("3÷4");
    expect(compareExpectedParts(equivalent, gameOf(equivalent))).toEqual([f(1, 2)]);
  });
});

// CP-601〜CP-658（docs/design/ui/08_copy-number.md）。表を読んで、文が一字も違わないことを確かめる。
// 表の {} の所だけに値が入る。ふりがなは外して比べる
// @types/node が無いので、fs は文字列をつないで読み込む（vitest は web/ で動かす）
const { existsSync, readFileSync } = (await import(/* @vite-ignore */ "node:" + "fs")) as { existsSync: (path: string) => boolean; readFileSync: (path: string, encoding: "utf8") => string };
// 表は開発用の repo にだけあり、提出用のコピーには入らない（#152）。無いときは、表と照らし合わせる試験だけを飛ばす
const COPY_TABLE_PATH = "../docs/design/ui/08_copy-number.md";
const HAS_COPY_TABLE = existsSync(COPY_TABLE_PATH);
const itWithCopyTable = it.skipIf(!HAS_COPY_TABLE);
const copyTable = HAS_COPY_TABLE ? readFileSync(COPY_TABLE_PATH, "utf8") : "";
const COPY_ROWS = new Map<string, string>(
  [...copyTable.matchAll(/^\| (CP-\d+) \| [^|]* \| [^|]* \| (.+) \|$/gm)].map((match) => [match[1] as string, match[2] as string]),
);

const filled = (id: string, values: readonly (string | number)[]): string => {
  const template = COPY_ROWS.get(id);
  if (template === undefined) throw new Error(`${id} が表に無い`);
  const rest = [...values];
  const text = template.replace(/\{[^}]*\}/g, () => String(rest.shift()));
  if (rest.length > 0) throw new Error(`${id} の値が余っている`);
  return text;
};

const np = (topic: NumberTopic, answer: NumberAnswer = { type: "integer", value: 0 }): NumberProblem => ({ kind: "number", pieces: [], hints: [], topic, answer });
const taskText = (topic: NumberTopic): string => textOf(numberTaskParts(np(topic)));
const afterText = (topic: NumberTopic): string => textOf(numberAfterParts(np(topic)));
const choiceTexts = (topic: NumberTopic, answer: NumberAnswer): string => numberChoices(np(topic, answer)).map(({ text }) => plainText(text)).join("、");
const yesNo: NumberAnswer = { type: "choice", options: ["yes", "no"], correct: "yes" };
const evenOdd: NumberAnswer = { type: "choice", options: ["even", "odd"], correct: "even" };
const aboveBelow: NumberAnswer = { type: "choice", options: ["above", "below"], correct: "above" };

const rule = { form: "add", a: 2, b: 0 } as const;
const table = [{ x: "1", y: "3" }, { x: "2", y: null }];

describe("数の問題の文（CP-601〜CP-658）", () => {
  itWithCopyTable("表の行を、ちゃんと読めている", () => {
    expect(COPY_ROWS.size).toBe(58);
    expect(COPY_ROWS.get("CP-601")).toBe("こたえ（れい: 0.5）");
  });

  itWithCopyTable("CP-601〜CP-611 欄と、読めない・足りない時の文", () => {
    const cases: [string, string, (string | number)[]][] = [
      ["CP-601", NUMBER_COPY.labelDecimal, []],
      ["CP-602", NUMBER_COPY.labelInteger, []],
      ["CP-603", MESSAGES.invalidDecimal, []],
      ["CP-604", MESSAGES.invalidInteger, []],
      ["CP-605", NUMBER_COPY.cardsName, []],
      ["CP-606", MESSAGES.multiEmpty, []],
      ["CP-607", MESSAGES.multiMissing, []],
      ["CP-608", MESSAGES.multiExtra, []],
      ["CP-609", [NUMBER_COPY.quotientLabel, NUMBER_COPY.remainderLabel].map(plainText).join("、"), []],
      ["CP-610", NUMBER_COPY.remainderTask, []],
      ["CP-611", MESSAGES.remainderEmpty, []],
    ];
    for (const [id, actual, values] of cases) expect(plainText(actual), id).toBe(plainText(filled(id, values)));
  });

  itWithCopyTable("CP-612〜CP-620 分数と小数", () => {
    const cases: [string, string, (string | number)[]][] = [
      ["CP-612", taskText({ t: "fractionToDecimal", value: f(1, 4), decimal: "0.25" }), ["1/4"]],
      ["CP-613", afterText({ t: "fractionToDecimal", value: f(1, 4), decimal: "0.25" }), ["1/4", 1, 4, "0.25"]],
      ["CP-614", taskText({ t: "decimalToFraction", decimal: "0.25", unit: f(1, 100), count: 25, value: f(25, 100) }), ["0.25"]],
      ["CP-615", afterText({ t: "decimalToFraction", decimal: "0.25", unit: f(1, 100), count: 25, value: f(25, 100) }), ["0.25", "1/100", 25, "25/100"]],
      ["CP-616", afterText({ t: "intToFraction", n: 2, den: 3, count: 6 }), [2, "1/3", 6]],
      ["CP-617", taskText({ t: "terminates", value: f(1, 3), decimal: "0.333", terminates: false }), ["1/3"]],
      ["CP-618", choiceTexts({ t: "terminates", value: f(1, 3), decimal: "0.333", terminates: false }, yesNo), []],
      ["CP-619", afterText({ t: "terminates", value: f(1, 4), decimal: "0.25", terminates: true }), [1, 4, "0.25"]],
      ["CP-620", afterText({ t: "terminates", value: f(1, 3), decimal: "0.333", terminates: false }), [1, 3, "0.333"]],
    ];
    for (const [id, actual, values] of cases) expect(actual, id).toBe(plainText(filled(id, values)));
  });

  itWithCopyTable("CP-621〜CP-636 整数", () => {
    const divisors: NumberTopic = { t: "divisors", n: 12, list: [1, 2, 3, 4, 6, 12] };
    const multiples: NumberTopic = { t: "multiples", k: 3, upTo: 20, list: [3, 6, 9, 12, 15, 18] };
    const common: NumberTopic = { t: "commonDivisors", a: 8, b: 12, list: [1, 2, 4] };
    const gcd: NumberTopic = { t: "gcd", a: 8, b: 12, list: [1, 2, 4], answer: 4 };
    const multiple: NumberTopic = { t: "commonMultiple", a: 4, b: 6, nth: 3, list: [12, 24, 36] };
    const lcm: NumberTopic = { t: "lcm", a: 4, b: 6, answer: 12 };
    const cases: [string, string, (string | number)[]][] = [
      ["CP-621", taskText({ t: "parity", n: 7, even: false }), [7]],
      ["CP-622", choiceTexts({ t: "parity", n: 7, even: false }, evenOdd), []],
      ["CP-623", afterText({ t: "parity", n: 8, even: true }), [8]],
      ["CP-624", afterText({ t: "parity", n: 7, even: false }), [7]],
      ["CP-625", taskText(divisors), [12]],
      ["CP-626", taskText(multiples), [20, 3]],
      ["CP-627", taskText(common), [8, 12]],
      ["CP-628", taskText(gcd), [8, 12]],
      ["CP-629", taskText(multiple), [4, 6, 3]],
      ["CP-630", taskText(lcm), [4, 6]],
      ["CP-631", afterText(divisors), [12, "1, 2, 3, 4, 6, 12"]],
      ["CP-632", afterText(multiples), [20, 3, "3, 6, 9, 12, 15, 18"]],
      ["CP-633", afterText(common), [8, 12, "1, 2, 4"]],
      ["CP-634", afterText(gcd), [8, 12, "1, 2, 4", 4]],
      ["CP-635", afterText(multiple), [4, 6, "12, 24, 36"]],
      ["CP-636", afterText(lcm), [4, 6, 12]],
    ];
    for (const [id, actual, values] of cases) expect(actual, id).toBe(plainText(filled(id, values)));
  });

  itWithCopyTable("CP-637〜CP-650 小数のかけ算とわり算", () => {
    const up = { t: "shift", x: "3.5", direction: "up", power: 10, places: 1, answer: "35" } as const;
    const down = { t: "shift", x: "24.85", direction: "down", power: 100, places: 2, answer: "0.2485" } as const;
    const productBig = { t: "compareProduct", a: "80", b: "1.2", bigger: true } as const;
    const productSmall = { t: "compareProduct", a: "80", b: "0.8", bigger: false } as const;
    const quotientBig = { t: "compareQuotient", a: "80", b: "0.8", bigger: true } as const;
    const quotientSmall = { t: "compareQuotient", a: "80", b: "1.2", bigger: false } as const;
    const cases: [string, string, (string | number)[]][] = [
      ["CP-637", taskText(up), ["3.5", 10]],
      ["CP-638", taskText(down), ["24.85", "1/100"]],
      ["CP-639", afterText(up), [10, 1]],
      ["CP-640", afterText(down), ["1/100", 2]],
      ["CP-641", taskText(productBig), [80, "1.2", 80]],
      ["CP-642", afterText(productBig), []],
      ["CP-643", afterText(productSmall), []],
      ["CP-644", afterText({ t: "multiply", a: "12", b: "4.3", intA: 12, intB: 43, intProduct: 516, places: 1, answer: "51.6" }), [12, 43, 516, 1]],
      ["CP-645", taskText(quotientBig), [80, "0.8", 80]],
      ["CP-646", afterText(quotientBig), []],
      ["CP-647", afterText(quotientSmall), []],
      ["CP-648", afterText({ t: "divide", a: "7.2", b: "2.4", factor: 10, intA: 72, intB: 24, answer: "3" }), [10, 72, 24]],
      ["CP-649", afterText({ t: "divideRemainder", a: "7.5", b: "2.3", quotient: 3, remainder: "0.6" }), ["2.3", 3, "0.6", "7.5"]],
      ["CP-650", afterText({ t: "distributive", a: 30, b: 2, c: "0.5" }), [30, 2, "0.5", 30, 2, 30, "0.5"]],
    ];
    for (const [id, actual, values] of cases) expect(actual, id).toBe(plainText(filled(id, values)));
  });

  it("積と商の大きさの選択肢は、見積もりと同じ形（表に無いので借りる）", () => {
    expect(choiceTexts({ t: "compareProduct", a: "80", b: "0.8", bigger: false }, aboveBelow)).toBe("80 より大きい、80 より小さい");
  });

  itWithCopyTable("CP-651〜CP-658 □ と △ の式", () => {
    const cases: [string, string, (string | number)[]][] = [
      ["CP-651", taskText({ t: "pickRule", rule, table }), []],
      ["CP-652", plainText(NUMBER_COPY.tableName), []],
      ["CP-653", afterText({ t: "pickRule", rule, table }), [2]],
      ["CP-654", afterText({ t: "pickRule", rule: { form: "mul", a: 3, b: 0 }, table }), [3]],
      ["CP-655", afterText({ t: "pickRule", rule: { form: "mulAdd", a: 2, b: 1 }, table }), [2, 1]],
      ["CP-656", taskText({ t: "tableBlank", rule, table, x: "2", answer: "4" }), []],
      ["CP-657", taskText({ t: "evaluate", rule, x: "3", answer: "5" }), ["3"]],
      ["CP-658", afterText({ t: "tableBlank", rule, table, x: "2", answer: "4" }), ["□ = 2 + △", 2, 4]],
      ["CP-658", afterText({ t: "evaluate", rule: { form: "mul", a: 3, b: 0 }, x: "2", answer: "6" }), ["□ = 3 × △", 2, 6]],
    ];
    for (const [id, actual, values] of cases) expect(actual, id).toBe(plainText(filled(id, values)));
  });

  it("式をえらぶ選択肢は式の形で、押す順は問題の選択肢のまま", () => {
    const answer: NumberAnswer = { type: "choice", options: ["add:2:0", "mul:2:0", "mulAdd:2:1"], correct: "add:2:0" };
    expect(choiceTexts({ t: "pickRule", rule, table }, answer)).toBe("□ = 2 + △、□ = 2 × △、□ = 2 × △ + 1");
    expect(ruleText({ form: "mulAdd", a: 2, b: 1 })).toBe("□ = 2 × △ + 1");
  });

  it("答えの欄のラベル：小数 CP-601、整数 CP-602、分数 CP-403、分子だけ CP-474", () => {
    const label = (answer: NumberAnswer) => plainText(numberAnswerLabel(np({ t: "lcm", a: 4, b: 6, answer: 12 }, answer)));
    expect(label({ type: "decimal", value: "0.5" })).toBe("こたえ（れい: 0.5）");
    expect(label({ type: "integer", value: 12 })).toBe("こたえ（れい: 12）");
    expect(label({ type: "fraction", value: f(1, 2) })).toBe("こたえ（れい: 1/2）");
    expect(label({ type: "numerator", value: 6 })).toBe("□ に入る数");
  });

  it("式の「?」は、正解の後に答えの数になる。式を見せない問題は空", () => {
    const multiply = np({ t: "multiply", a: "12", b: "4.3", intA: 12, intB: 43, intProduct: 516, places: 1, answer: "51.6" });
    expect(textOf(numberExpressionParts(multiply, false))).toBe("12 × 4.3 = ?");
    expect(textOf(numberExpressionParts(multiply, true))).toBe("12 × 4.3 = 51.6");
    expect(textOf(numberExpressionParts(np({ t: "fractionToDecimal", value: f(1, 4), decimal: "0.25" }), false))).toBe("1/4 = ?");
    expect(textOf(numberExpressionParts(np({ t: "distributive", a: 30, b: 2, c: "0.5" }), false))).toBe("30 × 2.5 = 30 × 2 + 30 × □");
    expect(numberExpressionParts(np({ t: "parity", n: 7, even: false }), false)).toEqual([]);
  });
});
