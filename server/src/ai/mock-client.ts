import { addFractions, gcd, subtractFractions } from "../check/fraction.ts";
import { parseExpression, type ParsedExpression } from "../check/expression.ts";
import type { PartsData } from "../check/parts-check.ts";
import { isSameFractionPair } from "../request-check.ts";
import type { ReflectionInput } from "../api-types.ts";
import type { AiClient, CompileLessonInput, DraftLessonPatchInput, PrintReadInput } from "./client.ts";
import { HINT_BY_PATTERN } from "../loop/hint-table.ts";
import type { NamedPattern } from "../loop/hint-table.ts";
import { STUDIO_FIXTURES } from "../studio/fixtures.ts";

export class MockAiClient implements AiClient {
  readonly loopHintDraftEnabled: boolean = false;
  readonly source = "mock" as const;
  readonly modelName = "mock";

  async createParts(expression: string, _signal: AbortSignal): Promise<PartsData> {
    return createPartsData(expression);
  }

  async createSimilarProblem(problem: string, _signal: AbortSignal): Promise<PartsData> {
    const parsed = parseExpression(problem);
    if (!parsed.ok) throw new Error("類題の元になる式を読み取れません。");
    return createPartsData(selectSimilarExpression(parsed.expression));
  }

  async createReflection(_input: ReflectionInput, _signal: AbortSignal): Promise<string> {
    return "1/6 を使うと、1/2 と 1/3 はそれぞれ何こ分になるかな？";
  }

  async readPrint(_input: PrintReadInput, _signal: AbortSignal): Promise<unknown> {
    return { problems: [
      { templateId: "rika-lever", questionText: "左の 2 の めもりに 30g。右の 3 の めもりに 何g つるすと つり合う？", params: { left: { pos: 2, g: 30 }, right: { pos: 3 } } },
      { templateId: "rika-moon", questionText: "月の 形が 日によって かわって 見えるのは なぜ？", params: {} },
      { templateId: "sansu-fraction-addsub", questionText: "1/2 + 1/3", params: { left: { num: 1, den: 2 }, op: "+", right: { num: 1, den: 3 } } },
      { templateId: "none", questionText: "分数のかけ算", unit: "sansu-6-01" },
    ], unsupportedCount: 0 };
  }

  async compileLesson(input: CompileLessonInput, _signal: AbortSignal): Promise<unknown> {
    return { ...STUDIO_FIXTURES.valid, ...(input.strategy ? { strategy: input.strategy } : {}) };
  }

  async draftLessonPatch(input: DraftLessonPatchInput, _signal: AbortSignal): Promise<unknown> {
    return { baseVersion: input.baseVersion, operations: [{ type: "setStrategy", strategy: "numeric" }] };
  }

  async draftLoopHint(input: { pattern: NamedPattern; operator: "+" | "-" }, _signal: AbortSignal): Promise<string> {
    const hint = HINT_BY_PATTERN[input.pattern];
    if (input.operator === "+") return hint;
    return hint.replace(/たす|足す|たし|足し/g, "ひく").replace(/加算/g, "ひき算");
  }
}

function selectSimilarExpression(expression: ParsedExpression): string {
  const candidates = expression.operator === "+"
    ? ["1/3 + 1/4", "1/4 + 1/5", "1/2 + 1/5"]
    : ["3/4 - 1/6", "5/6 - 1/3", "2/3 - 1/4"];
  // 元と同じ組（逆順を含む）は選ばない。候補は3つあり、同じ組になるのはそのうち高々1つ
  const different = candidates.filter((candidate) => {
    const parsed = parseExpression(candidate);
    return parsed.ok && !isSameFractionPair(parsed.expression, expression);
  });
  const differentDenominators = different.find((candidate) => {
    const parsed = parseExpression(candidate);
    return parsed.ok && (parsed.expression.left.den !== expression.left.den || parsed.expression.right.den !== expression.right.den);
  });
  return differentDenominators ?? different[0]!;
}

export function createPartsData(problem: string): PartsData {
  const parsed = parseExpression(problem);
  if (!parsed.ok) throw new Error(parsed.reason);
  const { left, right, operator } = parsed.expression;
  const answer = operator === "+" ? addFractions(left, right) : subtractFractions(left, right);
  const commonDenominator = leastCommonMultiple(left.den, right.den);
  const leftUnits = left.num * commonDenominator / left.den;
  const rightUnits = right.num * commonDenominator / right.den;
  const neededUnits = operator === "+" ? leftUnits + rightUnits : leftUnits;
  const pieces = [
    { num: left.num, den: left.den, count: 1 },
    { num: right.num, den: right.den, count: 1 },
    { num: 1, den: commonDenominator, count: neededUnits },
  ];
  return {
    problem, tool: "fraction_tiles", pieces,
    answer: { num: answer.num / gcd(answer.num, answer.den), den: answer.den / gcd(answer.num, answer.den) },
    hints: [
      `1/${commonDenominator} を ${left.num}/${left.den} に当ててみよう`,
      `1/${commonDenominator} を ${right.num}/${right.den} にも当ててみよう`,
    ],
  };
}

function leastCommonMultiple(left: number, right: number): number {
  const result = BigInt(left / gcd(left, right)) * BigInt(right);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("最小公倍数が安全な整数の範囲を超えています。");
  return Number(result);
}
