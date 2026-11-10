// 輪の最後。承認された直し方を API から読み、その型で間違えた子の、今の問題のヒントを入れ替える。
// デモの設定のとき（stumble-reporter.ts が型を返したとき）だけ動く。サーバーから来た文は子どもの画面に出るので、必ず検査する。
import { currentProblem } from "./session";
import type { LessonSession } from "./session";
import type { RecordTarget } from "./stumble-reporter";

export type ApprovedHint = { replacesHintIndex: number; hint: string };

const apiBase = (import.meta.env.VITE_LOOP_API_URL as string | undefined) ?? "";
// 子どもの画面に収まる長さ（仮）。数字を含む文は、答えを漏らすおそれがあるので出さない。
// 半角の数字だけでなく、全角と漢数字も弾く。リンクも出さない（出どころは固定の表だが、サーバーが入れ替わっても、子どもの画面は守る）
const MAX_HINT_LENGTH = 80;
const HAS_NUMBER = /[\d０-９〇一二三四五六七八九十百千万]/;
const HAS_LINK = /https?:|:\/\/|www\./i;
const MAX_HINT_INDEX = 2;

function readItem(value: unknown): ApprovedHint | null {
  if (typeof value !== "object" || value === null) return null;
  const { replacesHintIndex, hint } = value as { replacesHintIndex?: unknown; hint?: unknown };
  if (typeof replacesHintIndex !== "number" || !Number.isInteger(replacesHintIndex)) return null;
  if (replacesHintIndex < 0 || replacesHintIndex > MAX_HINT_INDEX || typeof hint !== "string") return null;
  const text = hint.trim();
  if (!text || text.length > MAX_HINT_LENGTH || HAS_NUMBER.test(text) || HAS_LINK.test(text)) return null;
  return { replacesHintIndex, hint: text };
}

/** 承認された直し方を読む。失敗や形の違う返事は、空にする（子どもの画面を止めない） */
export async function loadApprovedHints(target: RecordTarget): Promise<ApprovedHint[]> {
  // 分類できなかった間違いには、直し方の表が無い
  if (target.pattern === "unclassified") return [];
  try {
    const query = new URLSearchParams({ lessonKey: target.lessonKey, problem: target.problem, pattern: target.pattern });
    // 配られた説明から開いたときは、その説明の学級で承認された分を読む
    if (target.handoutId) query.set("handoutId", target.handoutId);
    const response = await fetch(`${apiBase}/api/v1/approved-hints?${query.toString()}`);
    if (!response.ok) return [];
    const body: unknown = await response.json();
    const items = (body as { items?: unknown } | null)?.items;
    return Array.isArray(items) ? items.flatMap((item) => readItem(item) ?? []) : [];
  } catch {
    return [];
  }
}

/**
 * 今の問題のヒントを入れ替える。もう別の問題に進んだとき、ヒントを 1 つでも見たあと
 * （見ている途中で文を変えない）は、何もしない。学習データの置き換えだけで、session の動きは変えない
 */
export function applyApprovedHints(session: LessonSession, problemIndex: number, hints: ApprovedHint[]): LessonSession {
  if (session.problemIndex !== problemIndex || session.shownHints > 0) return session;
  const replaced = [...currentProblem(session).hints];
  let isChanged = false;
  for (const { replacesHintIndex, hint } of hints) {
    if (replacesHintIndex >= replaced.length) continue;
    replaced[replacesHintIndex] = hint;
    isChanged = true;
  }
  if (!isChanged) return session;
  const problems = session.lesson.problems.map((problem, index) => (index === problemIndex ? { ...problem, hints: replaced } : problem));
  return { ...session, lesson: { ...session.lesson, problems } };
}
