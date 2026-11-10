// 子どもの進みの入力の検査（仮）。送るのは「章の id」と「終えた本線のマスの位置」だけ。
// 答え・正誤・時間は受けない。章の id は web の教材の id と同じ形（英小文字・数字・-）。章の一覧とは照らさない
// （server の章の写しは今 2 章、web は 5 章のため）。
import type { InputDetail } from "./admin-input.ts";

export const PROGRESS_LIMITS = { squaresPerRequest: 200, maxSquare: 199 } as const;

export type ProgressInput = { chapterId: string; squares: number[] };

const CHAPTER_ID = /^[a-z0-9-]{1,40}$/;

const isSquare = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= PROGRESS_LIMITS.maxSquare;

export function checkProgress(body: unknown): { ok: true; value: ProgressInput } | { ok: false; details: InputDetail[] } {
  const details: InputDetail[] = [];
  const record = typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const chapterId = record.chapterId;
  if (typeof chapterId !== "string" || !CHAPTER_ID.test(chapterId)) details.push({ field: "chapterId", reason: "形が違います" });
  const squares = record.squares;
  if (!Array.isArray(squares) || squares.length < 1 || squares.length > PROGRESS_LIMITS.squaresPerRequest || !squares.every(isSquare)) {
    details.push({ field: "squares", reason: "マスの位置は 0〜199 の整数で、1〜200 個" });
  }
  if (details.length > 0 || typeof chapterId !== "string" || !Array.isArray(squares)) return { ok: false, details };
  return { ok: true, value: { chapterId, squares: [...new Set(squares as number[])] } };
}
