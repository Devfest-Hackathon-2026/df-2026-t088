import type { Fraction } from "./fraction.ts";

export type ParsedExpression = { left: Fraction; operator: "+" | "-"; right: Fraction };
export type ExpressionResult = { ok: true; expression: ParsedExpression } | { ok: false; reason: string };

export function parseExpression(input: unknown): ExpressionResult {
  if (typeof input !== "string") return { ok: false, reason: "式は文字列で指定してください。" };
  const normalized = normalizeExpression(input);
  if (/[()]/.test(normalized)) return { ok: false, reason: "かっこを含む式には対応していません。" };
  const fraction = "(\\d+\\s*\\/\\s*\\d+)";
  const match = new RegExp(`^\\s*${fraction}\\s*([+\\-])\\s*${fraction}\\s*$`).exec(normalized);
  if (!match) return { ok: false, reason: explainInvalidExpression(normalized) };
  const [leftText, operator, rightText] = [match[1], match[2], match[3]];
  if (!leftText || !operator || !rightText) return { ok: false, reason: "分数の計算式として読み取れません。" };
  const left = parseFractionText(leftText);
  const right = parseFractionText(rightText);
  if (!left || !right) return { ok: false, reason: "分子と分母は安全な整数で入力してください。" };
  if (left.den === 0 || right.den === 0) return { ok: false, reason: "分母は1以上で入力してください。" };
  return { ok: true, expression: { left, operator: operator as "+" | "-", right } };
}

function normalizeExpression(input: string): string {
  return input.replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xFF10))
    .replace(/／/g, "/").replace(/＋/g, "+").replace(/[－−]/g, "-");
}

function parseFractionText(input: string): Fraction | undefined {
  const [numeratorText, denominatorText] = input.split("/").map((part) => part.trim());
  const num = Number(numeratorText);
  const den = Number(denominatorText);
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den)) return undefined;
  return { num, den };
}

function explainInvalidExpression(input: string): string {
  if (/\d+\s+\d+\s*\/\s*\d+/.test(input)) return "帯分数には対応していません。";
  if ((input.match(/[+\-]/g) ?? []).length > 1) return "2つの分数をつなぐ演算子は1つだけ指定してください。";
  if (/[^\d\s/+\-]/.test(input)) return "分数の計算式として読み取れません。文章題には対応していません。";
  return "分子/分母の分数2つを、+ または - でつないでください。";
}
