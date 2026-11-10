import { addFractions, fractionsEqual, reduceFraction, subtractFractions } from "./fraction.ts";
import type { Fraction } from "./fraction.ts";
import { parseExpression } from "./expression.ts";
import { LIMITS } from "../limits.ts";
import { hintLeaksAnswer } from "./hint-leak.ts";

export type Piece = { num: number; den: number; count: number };
export type PartsData = { problem: string; tool: string; pieces: Piece[]; answer: Fraction; hints: string[] };
export type CheckError = { code: string; message: string };
export type PartsCheckResult = { ok: true; reduced: boolean } | { ok: false; errors: CheckError[] };

export function checkParts(data: unknown): PartsCheckResult {
  const errors: CheckError[] = [];
  if (!isPartsData(data, errors)) return { ok: false, errors };
  const parsed = parseExpression(data.problem);
  if (!parsed.ok) {
    errors.push({ code: "invalid_problem", message: parsed.reason });
    return { ok: false, errors };
  }
  let computed: Fraction;
  try {
    computed = parsed.expression.operator === "+"
      ? addFractions(parsed.expression.left, parsed.expression.right)
      : subtractFractions(parsed.expression.left, parsed.expression.right);
  } catch {
    errors.push({ code: "calculation_overflow", message: "式の計算結果が安全な整数の範囲を超えています。" });
    return { ok: false, errors };
  }
  // 小学5年の範囲に負の数は無い。引かれる数より大きい数を引く式は部品にしない
  if (computed.num < 0) {
    errors.push({ code: "negative_result", message: "ひき算の結果が0より小さくなります。小学5年の範囲の外です。" });
    return { ok: false, errors };
  }
  const normalizedAnswer = reduceFraction(data.answer);
  const reduced = data.answer.num === normalizedAnswer.num && data.answer.den === normalizedAnswer.den;
  if (!fractionsEqual(computed, data.answer)) errors.push({ code: "answer_mismatch", message: "式の計算結果とanswerの値が一致しません。" });
  checkTileReachability(parsed.expression.left, parsed.expression.right, parsed.expression.operator, data.pieces, errors);
  if (!isNaturalHintTarget(parsed.expression.left, parsed.expression.right, computed, data.pieces) && hintLeaksAnswer(data.hints, computed, data.answer)) errors.push({ code: "answer_in_hint", message: "ヒントに答えと一致する表記が含まれています。" });
  return errors.length ? { ok: false, errors } : { ok: true, reduced };
}

function isPartsData(value: unknown, errors: CheckError[]): value is PartsData {
  if (!isRecord(value)) return addError(errors, "invalid_data", "データはオブジェクトで指定してください。");
  if (typeof value.problem !== "string") addError(errors, "invalid_problem", "problemは文字列で指定してください。");
  if (value.tool !== "fraction_tiles") addError(errors, "invalid_tool", "toolはfraction_tilesを指定してください。");
  if (!Array.isArray(value.pieces) || value.pieces.length > LIMITS.maxPieceTypes || value.pieces.some((piece) => !isPiece(piece))) addError(errors, "invalid_pieces", "piecesは種類数と枚数の上限内で指定してください。");
  if (!isFraction(value.answer) || value.answer.num < 0 || value.answer.den < 1) addError(errors, "invalid_answer", "answerは分子0以上、分母1以上の整数で指定してください。");
  if (!Array.isArray(value.hints) || value.hints.length < LIMITS.minHints || value.hints.length > LIMITS.maxHints || value.hints.some((hint) => typeof hint !== "string")) addError(errors, "invalid_hints", "hintsは1〜3個の文字列で指定してください。");
  return errors.length === 0;
}

function isPiece(value: unknown): value is Piece {
  // 分子が0のピースは画面に置いても長さが無いので、ピースとして認めない（docs/product/education-api-contract.md の pieces[].num は1以上）
  return isRecord(value) && Number.isSafeInteger(value.num) && Number.isSafeInteger(value.den)
    && Number(value.num) >= 1 && Number(value.den) >= 1
    && typeof value.count === "number" && Number.isSafeInteger(value.count)
    && value.count >= 1 && value.count <= LIMITS.maxPiecesPerType;
}

function isFraction(value: unknown): value is Fraction {
  return isRecord(value) && Number.isSafeInteger(value.num) && Number.isSafeInteger(value.den);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addError(errors: CheckError[], code: string, message: string): false {
  errors.push({ code, message });
  return false;
}

function checkTileReachability(left: Fraction, right: Fraction, operator: "+" | "-", pieces: Piece[], errors: CheckError[]): void {
  if (!pieces.some((piece) => fractionsEqual(piece, left) && piece.count >= 1) || !pieces.some((piece) => fractionsEqual(piece, right) && piece.count >= 1)) {
    errors.push({ code: "missing_source_piece", message: "式に含まれる分数のピースがpiecesにありません。" });
  }
  // 11章の流れ（1/6 を 1/2 と 1/3 の両方に当てて数える）では、たし算は2つの分数を同時に敷きつめるので合計の枚数が要る。
  // ひき算は引かれる数を敷きつめてから取り除くので、引かれる数の枚数があれば足りる
  // 2/4 のような約分前の分数でも数えられるよう、約分してから割り切りを見る
  const leftReduced = reduceFraction(left);
  const rightReduced = reduceFraction(right);
  const commonUnits = pieces.filter((piece) => piece.num === 1 && piece.den % leftReduced.den === 0 && piece.den % rightReduced.den === 0);
  const enough = commonUnits.some((piece) => {
    const leftCount = BigInt(leftReduced.num) * BigInt(piece.den) / BigInt(leftReduced.den);
    const rightCount = BigInt(rightReduced.num) * BigInt(piece.den) / BigInt(rightReduced.den);
    const required = operator === "+" ? leftCount + rightCount : leftCount;
    return BigInt(piece.count) >= required;
  });
  if (!enough) errors.push({ code: "unreachable_answer", message: "共通の単位分数ピースの種類または枚数が不足しています。" });
}

// 答えが式の分数や、左右の分数を整数枚で作れる共通の単位ピースと同じ値のとき（例 1/2 - 1/3 = 1/6 で、ピースも 1/6）は、
// ヒントがその分数に触れるのは当たり前で、文字では答えの漏れと見分けられない。
// 免除はこの場合に絞る。piecesのほかのピースを材料にすると、ピースを足すだけでヒント検査を止められてしまう
function isNaturalHintTarget(left: Fraction, right: Fraction, computed: Fraction, pieces: Piece[]): boolean {
  if (fractionsEqual(left, computed) || fractionsEqual(right, computed)) return true;
  return pieces.some((piece) => fractionsEqual(piece, computed) && makesWholeNumberOf(piece, left) && makesWholeNumberOf(piece, right));
}

function makesWholeNumberOf(unit: Fraction, target: Fraction): boolean {
  return (BigInt(target.num) * BigInt(unit.den)) % (BigInt(target.den) * BigInt(unit.num)) === 0n;
}
