// □と△の式の章の問題の関数（3つ）。式は form（add：□＝a＋△、mul：□＝a×△、mulAdd：□＝a×△＋b）と a・b で表す。
// 範囲の正本は docs/design/problems/08_database/README.md の TBL-001。計算は 10 の累乗を分母にした分数で行う
import type { Fraction } from "../fraction";
import type { DecimalText, ExpressionForm, ExpressionRule, NumberProblem, TableColumn } from "../number-problem";
import { decimalPlaces, formatDecimal, isCanonicalDecimal } from "./decimal-text";
import { fractionOf } from "./decimal";
import { defineNumberMaker, fail, leakReason, parseCount, parseWhole, succeed } from "./number-common";
import type { Parsed } from "./number-common";
import type { ProblemMaker } from "./types";

const FORMS: readonly ExpressionForm[] = ["add", "mul", "mulAdd"];
const isForm = (value: unknown): value is ExpressionForm => FORMS.includes(value as ExpressionForm);

/* ---------- 式を読む ---------- */

function parseRule(form: unknown, a: unknown, b: unknown): Parsed<ExpressionRule> {
  if (!isForm(form)) return fail("form は add・mul・mulAdd のどれかにしてください");
  const parsedA = parseWhole(a, "a", 1, 9);
  if (!parsedA.ok) return parsedA;
  if (form !== "mulAdd") return b === 0 ? succeed({ form, a: parsedA.value, b: 0 }) : fail(`${form} の b は 0 にしてください`);
  const parsedB = parseWhole(b, "b", 1, 9);
  return parsedB.ok ? succeed({ form, a: parsedA.value, b: parsedB.value }) : parsedB;
}

/** □ ＝ p×△ ＋ q の p と q */
function lineOf({ form, a, b }: ExpressionRule): { p: number; q: number } {
  if (form === "add") return { p: 1, q: a };
  return { p: a, q: form === "mul" ? 0 : b };
}

/** 式に △ の値（分数）を入れた □。10 の累乗を分母にした分数のまま計算する */
function yAt(rule: ExpressionRule, x: Fraction): DecimalText {
  const { p, q } = lineOf(rule);
  const text = formatDecimal({ num: p * x.num + q * x.den, den: x.den });
  if (text === null) throw new RangeError("小数で書けません");
  return text;
}

const yOfInt = (rule: ExpressionRule, x: number): DecimalText => yAt(rule, { num: x, den: 1 });

const ruleId = ({ form, a, b }: ExpressionRule): string => `${form}:${a}:${b}`;

function ruleOfId(id: string): ExpressionRule | null {
  const [form, a, b, ...rest] = id.split(":");
  if (rest.length > 0 || !isForm(form)) return null;
  const parsed = parseRule(form, Number(a), Number(b));
  return parsed.ok && ruleId(parsed.value) === id ? parsed.value : null;
}

const ruleArgs = ({ form, a, b }: ExpressionRule) => [form, a, b];

/* ---------- expression.pickRule ---------- */

const PICK_XS = [1, 2, 3, 4] as const;
const FORM_INDEX: Record<ExpressionForm, number> = { add: 0, mul: 1, mulAdd: 2 };

/** △ が 1〜4 のどの列でも、2つの式の □ が同じにならないか（同じになる列があると、表だけでは正解が決まらない） */
const differsEverywhere = (left: ExpressionRule, right: ExpressionRule): boolean =>
  PICK_XS.every((x) => yOfInt(left, x) !== yOfInt(right, x));

const neighbor = (n: number): number => (n < 9 ? n + 1 : n - 1);

/** ありそうなまちがいの式。足し算とかけ算のとりちがえ、数のずれ、a と b の入れちがえ */
function plausibleWrongRules({ form, a, b }: ExpressionRule): ExpressionRule[] {
  const make = (wrongForm: ExpressionForm, wrongA: number, wrongB: number): ExpressionRule => ({ form: wrongForm, a: wrongA, b: wrongB });
  if (form === "add") return [make("mul", a, 0), make("add", neighbor(a), 0), make("mul", neighbor(a), 0)];
  if (form === "mul") return [make("add", a, 0), make("mul", neighbor(a), 0), make("mulAdd", a, 1)];
  return [make("mulAdd", b, a), make("mul", a, 0), make("add", b, 0), make("mulAdd", a, neighbor(b)), make("add", a, 0)];
}

/** 決まった順に全部の式を並べたもの。ありそうな式が足りない時の補い */
const ALL_RULES: readonly ExpressionRule[] = (() => {
  const rules: ExpressionRule[] = [];
  for (let a = 1; a <= 9; a += 1) {
    rules.push({ form: "add", a, b: 0 }, { form: "mul", a, b: 0 });
    for (let b = 1; b <= 9; b += 1) rules.push({ form: "mulAdd", a, b });
  }
  return rules;
})();

/** まちがいの式 2 つ。表の 4 列のどこでも正解と □ が同じにならないものを、ありそうな順から選ぶ */
function wrongRules(rule: ExpressionRule): ExpressionRule[] {
  const picked: ExpressionRule[] = [];
  for (const candidate of [...plausibleWrongRules(rule), ...ALL_RULES]) {
    if (picked.length === 2) break;
    if (ruleId(candidate) === ruleId(rule) || picked.some((other) => ruleId(other) === ruleId(candidate))) continue;
    if (differsEverywhere(rule, candidate)) picked.push(candidate);
  }
  return picked;
}

/** 正解を入れる位置は乱数でなく、式から決める（0〜2 番目） */
const correctPosition = ({ form, a, b }: ExpressionRule): number => (a * 2 + b + FORM_INDEX[form]) % 3;

function pickOptions(rule: ExpressionRule): string[] {
  const options = wrongRules(rule).map(ruleId);
  options.splice(correctPosition(rule), 0, ruleId(rule));
  return options;
}

function tableOf(rule: ExpressionRule, xs: readonly number[], blank?: number): TableColumn[] {
  return xs.map((x) => ({ x: String(x), y: x === blank ? null : yOfInt(rule, x) }));
}

function makePickRule(rule: ExpressionRule): NumberProblem {
  return {
    kind: "number",
    pieces: [],
    hints: [
      "[表|ひょう]の △ が[一|ひと]つふえると、□ がいくつふえるか[見|み]てみましょう",
      "[式|しき]の △ に[表|ひょう]の[数|かず]を[入|い]れて、□ と[合|あ]うか[調|しら]べましょう",
      "ぜんぶの[列|れつ]で[合|あ]う[式|しき]が、[答|こた]えです",
    ],
    topic: { t: "pickRule", rule, table: tableOf(rule, PICK_XS) },
    answer: { type: "choice", options: pickOptions(rule), correct: ruleId(rule) },
  };
}

function verifyPickRule({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "pickRule") return "pickRule の問題ではありません";
  const rule = parseRule(topic.rule.form, topic.rule.a, topic.rule.b);
  if (!rule.ok) return rule.reason;
  const expectedTable = tableOf(rule.value, PICK_XS);
  if (JSON.stringify(topic.table) !== JSON.stringify(expectedTable)) return "表が式（△＝1〜4）と合いません";
  if (answer.type !== "choice") return "答えは選択肢にしてください";
  if (answer.correct !== ruleId(rule.value)) return `正解は ${ruleId(rule.value)} のはずです`;
  if (answer.options.length !== 3 || new Set(answer.options).size !== 3) return "選択肢は重ならない 3 つにしてください";
  if (!answer.options.includes(answer.correct)) return "選択肢に正解が入っていません";
  for (const id of answer.options.filter((option) => option !== answer.correct)) {
    const wrong = ruleOfId(id);
    if (!wrong) return `選択肢 ${id} は式の id ではありません`;
    // 4 列のどれでも正解と同じ □ にならないこと。表と合ってしまう式を混ぜない
    const clash = topic.table.find((column) => column.y === yAt(wrong, fractionOf(column.x)));
    if (clash) return `まちがいの式 ${id} が、△＝${clash.x} の列で正解と同じ □ になります`;
  }
  const numbers = [String(rule.value.a), ...(rule.value.b > 0 ? [String(rule.value.b)] : [])];
  return leakReason(hints, numbers);
}

export const EXPRESSION_PICK_RULE = defineNumberMaker<ExpressionRule>({
  name: "expression.pickRule",
  parse: (args) => {
    const count = parseCount(args, 3);
    return count ? fail(count) : parseRule(args[0], args[1], args[2]);
  },
  toArgs: ruleArgs,
  make: makePickRule,
  verify: verifyPickRule,
});

/* ---------- expression.tableBlank ---------- */

interface TableBlankSpec { rule: ExpressionRule; x: number }

/** x を含む連続した 4 列。x の 1 つ前から始める（x が 1 なら 1 から、10 に近ければ 7 から） */
const windowStart = (x: number): number => Math.min(Math.max(x - 1, 1), 7);
const windowXs = (x: number): number[] => [0, 1, 2, 3].map((step) => windowStart(x) + step);

function makeTableBlank({ rule, x }: TableBlankSpec): NumberProblem {
  const answer = yOfInt(rule, x);
  return {
    kind: "number",
    pieces: [],
    hints: [
      "[表|ひょう]のほかの[列|れつ]を[見|み]て、△ と □ のきまりを[見|み]つけましょう",
      "△ が[一|ひと]つふえると □ がいくつふえるか、[調|しら]べましょう",
      "[見|み]つけたきまりを、□ をもとめたい[列|れつ]の △ にあてはめて[計算|けいさん]しましょう",
    ],
    topic: { t: "tableBlank", rule, table: tableOf(rule, windowXs(x), x), x: String(x), answer },
    answer: { type: "decimal", value: answer },
  };
}

function verifyTableBlank({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "tableBlank") return "tableBlank の問題ではありません";
  const rule = parseRule(topic.rule.form, topic.rule.a, topic.rule.b);
  if (!rule.ok) return rule.reason;
  const x = Number(topic.x);
  if (!isCanonicalDecimal(topic.x) || !Number.isInteger(x) || x < 1 || x > 10) return "x は 1〜10 の整数にしてください";
  const expectedTable = tableOf(rule.value, windowXs(x), x);
  if (JSON.stringify(topic.table) !== JSON.stringify(expectedTable)) return "表が式と合いません（4 列で、x の列の □ だけが空欄）";
  const expected = yOfInt(rule.value, x);
  if (topic.answer !== expected || answer.type !== "decimal" || answer.value !== expected) return `答えは ${expected} のはずです`;
  return leakReason(hints, [expected]);
}

export const EXPRESSION_TABLE_BLANK = defineNumberMaker<TableBlankSpec>({
  name: "expression.tableBlank",
  parse: (args) => {
    const count = parseCount(args, 4);
    if (count) return fail(count);
    const rule = parseRule(args[0], args[1], args[2]);
    const x = parseWhole(args[3], "x", 1, 10);
    if (!rule.ok) return rule;
    if (!x.ok) return x;
    return succeed({ rule: rule.value, x: x.value });
  },
  toArgs: ({ rule, x }) => [...ruleArgs(rule), x],
  make: makeTableBlank,
  verify: verifyTableBlank,
});

/* ---------- expression.evaluate ---------- */

interface EvaluateSpec { rule: ExpressionRule; x: DecimalText }

/** 1〜10 の整数、または 0.5〜9.5 の 0.5 きざみの小数。整数の数も文字にそろえる */
function parseEvaluateX(arg: unknown): Parsed<DecimalText> {
  const reason = "x は 1〜10 の整数、または 0.5〜9.5 の 0.5 きざみの小数にしてください";
  const text = typeof arg === "number" && Number.isSafeInteger(arg) ? String(arg) : arg;
  if (typeof text !== "string" || !isCanonicalDecimal(text)) return fail(reason);
  return isEvaluateX(text) ? succeed(text) : fail(`${reason}（${text}）`);
}

function isEvaluateX(text: DecimalText): boolean {
  const { num, den } = fractionOf(text);
  const doubled = (num * 2) / den; // 0.5 きざみなら整数
  return decimalPlaces(text) <= 1 && Number.isInteger(doubled) && doubled >= 1 && doubled <= 20;
}

function makeEvaluate({ rule, x }: EvaluateSpec): NumberProblem {
  const answer = yAt(rule, fractionOf(x));
  const middle: Record<ExpressionForm, string> = {
    add: "たし[算|ざん]で[求|もと]めます",
    mul: "かけ[算|ざん]で[求|もと]めます",
    mulAdd: "かけ[算|ざん]を[先|さき]に[計算|けいさん]して、あとでたします",
  };
  return {
    kind: "number",
    pieces: [],
    hints: [
      "[式|しき]の △ に、[問題|もんだい]の[数|かず]を[入|い]れて[計算|けいさん]します",
      middle[rule.form],
      decimalPlaces(x) > 0 ? "[小数|しょうすう]の[計算|けいさん]では、[小数点|しょうすうてん]の[位置|いち]に[気|き]をつけましょう" : "[計算|けいさん]の[順|じゅん]じょに[気|き]をつけましょう",
    ],
    topic: { t: "evaluate", rule, x, answer },
    answer: { type: "decimal", value: answer },
  };
}

function verifyEvaluate({ topic, answer, hints }: NumberProblem): string | null {
  if (topic.t !== "evaluate") return "evaluate の問題ではありません";
  const rule = parseRule(topic.rule.form, topic.rule.a, topic.rule.b);
  if (!rule.ok) return rule.reason;
  if (!isCanonicalDecimal(topic.x) || !isEvaluateX(topic.x)) return "x は 1〜10 の整数、または 0.5〜9.5 の 0.5 きざみの小数にしてください";
  const expected = yAt(rule.value, fractionOf(topic.x));
  if (topic.answer !== expected || answer.type !== "decimal" || answer.value !== expected) return `答えは ${expected} のはずです`;
  return leakReason(hints, [expected]);
}

export const EXPRESSION_EVALUATE = defineNumberMaker<EvaluateSpec>({
  name: "expression.evaluate",
  parse: (args) => {
    const count = parseCount(args, 4);
    if (count) return fail(count);
    const rule = parseRule(args[0], args[1], args[2]);
    const x = parseEvaluateX(args[3]);
    if (!rule.ok) return rule;
    if (!x.ok) return x;
    return succeed({ rule: rule.value, x: x.value });
  },
  toArgs: ({ rule, x }) => [...ruleArgs(rule), x],
  make: makeEvaluate,
  verify: verifyEvaluate,
});

/** □と△の式の章の3つ。makers/index.ts への登録は別 */
export const EXPRESSION_MAKERS: readonly ProblemMaker[] = [EXPRESSION_PICK_RULE, EXPRESSION_TABLE_BLANK, EXPRESSION_EVALUATE];
