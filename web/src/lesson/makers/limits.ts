// タイルの上限（PB-15・PB-21、ADR-006）。分母の範囲と、盤の大きさ
import type { Fraction } from "../fraction";
import { gameOf } from "../problems";
import type { LessonProblem } from "../problems";
import { commonUnit } from "../tiles";

/** 式の分数の分母 */
export const MIN_DEN = 2;
export const MAX_DEN = 20;
/** タイル置き場のどのタイルの分母も、ここまで */
export const MAX_PIECE_DEN = 24;
/** 盤の1の数 */
export const MAX_WHOLES = 3;
/** 1の数 × いちばん大きいタイルの分母 */
export const MAX_RULER_UNITS = 48;

/** 分母が 2〜20 の分数か。外れたら理由 */
export function denRangeReason(label: string, { den }: Fraction): string | null {
  return den >= MIN_DEN && den <= MAX_DEN ? null : `${label}の分母は ${MIN_DEN}〜${MAX_DEN} にしてください（${den}）`;
}

/** 盤が作れて、上限に収まるか。タイルを出さない問題は何も言わない */
export function tileLimitReason(problem: LessonProblem): string | null {
  if (problem.pieces.length === 0) return null;
  try {
    const game = gameOf(problem);
    commonUnit(game); // うめる単位分数のタイルが無いと例外
    const { pieces, wholes } = game;
    const biggestDen = Math.max(...pieces.map((piece) => piece.den));
    if (biggestDen > MAX_PIECE_DEN) return `タイルの分母が ${MAX_PIECE_DEN} を超えています（${biggestDen}）`;
    if (wholes > MAX_WHOLES) return `盤の1の数が ${MAX_WHOLES} を超えています（${wholes}）`;
    if (wholes * biggestDen > MAX_RULER_UNITS) return `1の数 × タイルの分母が ${MAX_RULER_UNITS} を超えています（${wholes} × ${biggestDen}）`;
    return null;
  } catch (error) {
    return `盤が作れません（${error instanceof Error ? error.message : String(error)}）`;
  }
}
