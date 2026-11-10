// 子どもの進みを、先生の画面のために送る（仮。契約「子どもの進みの API（仮・案）」の 仮 の形）。
// 送るのは「章の id」と「終えた本線のマスの位置」だけ。答え・正誤・時間は送らない。送れなくても、学習の画面は何も変わらない。
// 番号は student-number.ts の口から取る（公開用はログインの session に替える）。
import { currentStudentNumber } from "../student-number";

const apiBase = (import.meta.env.VITE_LOOP_API_URL as string | undefined) ?? "";

/** 章ごとの終えた数（GameState の progress と同じ形の部分だけ使う） */
export type ProgressByChapter = Record<string, { done: number }>;

/** サーバが受ける、1回に送るマスの数と、位置の上限（progress-input.ts と同じ） */
export const SQUARES_PER_REQUEST = 200;
const MAX_SQUARE = 199;

/** 章ごとに、終えた数が変わったものだけ、終えた位置（0 から）を作る。位置は上限の 199 まで */
export function changedSquares(previous: ProgressByChapter, next: ProgressByChapter): { chapterId: string; squares: number[] }[] {
  const changed: { chapterId: string; squares: number[] }[] = [];
  for (const [chapterId, progress] of Object.entries(next)) {
    const done = progress.done;
    if (done <= 0 || (previous[chapterId]?.done ?? 0) === done) continue;
    const count = Math.min(done, MAX_SQUARE + 1);
    changed.push({ chapterId, squares: Array.from({ length: count }, (_, square) => square) });
  }
  return changed;
}

/** 1回分を送る。失敗は黙って false（学習の画面は止めない） */
export async function sendProgress(chapterId: string, squares: number[], number: string = currentStudentNumber()): Promise<boolean> {
  try {
    const response = await fetch(`${apiBase}/api/v1/student/progress`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-student-number": number },
      body: JSON.stringify({ chapterId, squares }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** 増えた章を送る。返さない（待たない） */
export function reportProgress(previous: ProgressByChapter, next: ProgressByChapter): void {
  for (const { chapterId, squares } of changedSquares(previous, next)) {
    for (let start = 0; start < squares.length; start += SQUARES_PER_REQUEST) {
      void sendProgress(chapterId, squares.slice(start, start + SQUARES_PER_REQUEST));
    }
  }
}
