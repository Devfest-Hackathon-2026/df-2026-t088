import { LIMITS } from "../limits.ts";
import { checkLoopHint } from "../loop/check-hint.ts";
import { addFractions, subtractFractions } from "../check/fraction.ts";
import { checkParts } from "../check/parts-check.ts";
import type { StudioFraction, StudioProblem } from "./lesson-ir.ts";

export type LessonIrValidation = { ok: true } | { ok: false; issues: string[] };
type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const hasOnlyKeys = (value: JsonRecord, keys: string[]): boolean => Object.keys(value).every((key) => keys.includes(key));

function readFraction(value: unknown): StudioFraction | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ["num", "den"])) return undefined;
  const { num, den } = value;
  if (typeof num !== "number" || !Number.isInteger(num) || num < 1) return undefined;
  if (typeof den !== "number" || !Number.isInteger(den) || den < 2 || den > 12 || num >= den) return undefined;
  return { num, den };
}

function tileSupplies(problem: StudioProblem): { num: number; den: number; count: number }[] {
  const den = problem.left.den / gcd(problem.left.den, problem.right.den) * problem.right.den;
  const leftUnits = problem.left.num * (den / problem.left.den);
  const rightUnits = problem.right.num * (den / problem.right.den);
  const entries = new Map<string, number>();
  const add = (num: number, denominator: number, count: number) => {
    const key = `${num}/${denominator}`;
    entries.set(key, (entries.get(key) ?? 0) + count);
  };
  add(problem.left.num, problem.left.den, 1);
  add(problem.right.num, problem.right.den, 1);
  add(1, den, problem.kind === "calculate" && problem.operator === "-" ? leftUnits : leftUnits + rightUnits + 1);
  return [...entries].map(([key, count]) => {
    const [num, denominator] = key.split("/").map(Number);
    return { num: num!, den: denominator!, count };
  });
}

function gcd(left: number, right: number): number {
  let [a, b] = [left, right];
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function readProblem(value: unknown, index: number, issues: string[]): StudioProblem | undefined {
  const prefix = `問題${index + 1}`;
  if (!isRecord(value) || !hasOnlyKeys(value, ["kind", "left", "right", "operator", "hints"])) {
    issues.push(`${prefix}の形に、知らない項目があるか必要な項目がありません。`);
    return undefined;
  }
  if (value.kind !== "calculate" && value.kind !== "common" && value.kind !== "compare") {
    issues.push(`${prefix}の種類は calculate、common、compare のいずれかにしてください。`);
    return undefined;
  }
  const left = readFraction(value.left);
  const right = readFraction(value.right);
  if (!left || !right) issues.push(`${prefix}の分数は、分子が1以上で分母が2〜12の真分数にしてください。`);
  const isCalculate = value.kind === "calculate";
  if (isCalculate ? value.operator !== "+" && value.operator !== "-" : value.operator !== undefined) {
    issues.push(`${prefix}の演算子は、calculate のときだけ + または - にしてください。`);
  }
  if (!Array.isArray(value.hints) || value.hints.length < LIMITS.minHints || value.hints.length > LIMITS.maxHints
    || !value.hints.every((hint) => typeof hint === "string")) {
    issues.push(`${prefix}のヒントは${LIMITS.minHints}〜${LIMITS.maxHints}個の文にしてください。`);
  }
  if (!left || !right || !Array.isArray(value.hints) || !value.hints.every((hint) => typeof hint === "string")) return undefined;
  const problem: StudioProblem = { kind: value.kind, left, right, ...(isCalculate ? { operator: value.operator as "+" | "-" } : {}), hints: value.hints as string[] };
  if (isCalculate && problem.operator === "-") {
    try {
      if (subtractFractions(left, right).num <= 0) issues.push(`${prefix}のひき算の答えは0より大きくしてください。`);
    } catch {
      issues.push(`${prefix}のひき算を計算できません。`);
    }
  }
  const supplies = tileSupplies(problem);
  if (supplies.length > LIMITS.maxPieceTypes || supplies.some((piece) => piece.count > LIMITS.maxPiecesPerType)) {
    issues.push(`${prefix}のタイルの種類または枚数が上限をこえています。`);
  }
  const operator = isCalculate ? problem.operator! : "+";
  const expression = `${left.num}/${left.den}${operator}${right.num}/${right.den}`;
  try {
    const answer = operator === "+" ? addFractions(left, right) : subtractFractions(left, right);
    const checked = checkParts({ problem: expression, tool: "fraction_tiles", pieces: supplies, answer, hints: ["確認用"] });
    if (!checked.ok) issues.push(...checked.errors.map((error) => `${prefix}のタイルを使えません（${error.message}）。`));
  } catch {
    issues.push(`${prefix}の分数の計算結果を扱えません。`);
  }
  for (const hint of problem.hints) {
    const checked = checkLoopHint(hint, operator, expression);
    if (!checked.ok) issues.push(`${prefix}のヒント「${hint}」は使えません（${hintReason(checked.reason)}）。`);
  }
  return problem;
}

function hintReason(reason: string): string {
  const reasons: Record<string, string> = {
    empty: "文が空です", too_long: "80字をこえています", multiple_paragraphs: "改行があります", has_digit: "数字が含まれています",
    has_link: "リンクが含まれています", leak: "答えが書かれています", wrong_operator: "演算と合わない言葉があります",
  };
  return reasons[reason] ?? "文を確認してください";
}

export function validateLessonIr(value: unknown): LessonIrValidation {
  const issues: string[] = [];
  if (!isRecord(value) || !hasOnlyKeys(value, ["schemaVersion", "objective", "strategy", "problems"])) {
    return { ok: false, issues: ["教材の形に、知らない項目があるか必要な項目がありません。"] };
  }
  if (value.schemaVersion !== 1) issues.push("教材の schemaVersion は1にしてください。");
  if (typeof value.objective !== "string" || !value.objective.trim() || value.objective.length > 60) issues.push("指導のねらいは1〜60字で書いてください。");
  if (value.strategy !== "visual" && value.strategy !== "numeric" && value.strategy !== "misconception") issues.push("戦略は visual、numeric、misconception のいずれかにしてください。");
  if (!Array.isArray(value.problems) || value.problems.length < 1 || value.problems.length > 3) {
    issues.push("問題は1〜3問にしてください。");
  } else {
    value.problems.forEach((problem, index) => readProblem(problem, index, issues));
  }
  return issues.length ? { ok: false, issues } : { ok: true };
}
