import { addFractions, fractionsEqual } from "./fraction.ts";
import type { Fraction } from "./fraction.ts";
import type { Piece } from "./parts-check.ts";

export function judgeCombination(target: Fraction, placed: Piece[]): boolean {
  if (!isValidPiece(target) || !Array.isArray(placed) || placed.some((piece) => !isValidPiece(piece) || piece.num < 1 || !Number.isSafeInteger(piece.count) || piece.count < 1)) return false;
  let total: Fraction = { num: 0, den: 1 };
  try {
    for (const piece of placed) {
      total = addFractions(total, { num: piece.num * piece.count, den: piece.den });
    }
    return fractionsEqual(total, target);
  } catch {
    return false;
  }
}

function isValidPiece(value: unknown): value is Fraction {
  return typeof value === "object" && value !== null
    && Number.isSafeInteger((value as Fraction).num) && Number.isSafeInteger((value as Fraction).den)
    && (value as Fraction).num >= 0 && (value as Fraction).den >= 1;
}
