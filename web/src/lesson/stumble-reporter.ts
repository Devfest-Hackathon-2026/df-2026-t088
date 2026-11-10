// 子どもの間違いを、デモの時だけ API に送る。既定は送らない（ビルドの設定 VITE_LOOP_SEND=on のときだけ）。
// 公開した URL では設定しないので、本物の子どもの記録は送らない。送れなくても、学習の画面は何も変わらない。
import { classifyWrongAnswer } from "./error-pattern";
import type { ErrorPattern } from "./error-pattern";
import type { Fraction } from "./fraction";
import { currentProblem } from "./session";
import type { LessonSession } from "./session";
import { classifyLeverWrongAnswer } from "../pages/print/templates";
import { FRACTION_CHAPTER_ID, FRACTION_LESSON_KEY } from "../pages/print/fraction-addsub";
import type { LeverParams } from "../pages/print/types";

const apiBase = (import.meta.env.VITE_LOOP_API_URL as string | undefined) ?? "";
const isSendOn = (): boolean => import.meta.env.VITE_LOOP_SEND === "on";

/** 送った記録の宛先。承認されたヒントを読みに行くのにも使う */
export interface RecordTarget {
  lessonKey: string;
  problem: string;
  problemIndex: number;
  pattern: ErrorPattern;
  /** 配られた説明から開いたときだけ。サーバーが説明の id から学級を引く（学級の id は子どもからは送らない） */
  handoutId?: string;
}

const fractionText = ({ num, den }: Fraction): string => `${num}/${den}`;

/**
 * 型を付けて残してよい間違いか。次のすべてを満たす 1 回目の間違いだけ。
 * 計算の問題で、タイルを先に開く学習ではなく、ヒントもタイルも使っておらず、同じ問題で前に間違えていない。
 * それ以外は、型が決められない（ヒントやタイルの後の答えは、考え方が変わっている）ので、残さない。
 */
export function isRecordableWrong(before: LessonSession, after: LessonSession): boolean {
  if (after.message !== "wrongToTiles" && after.message !== "wrongToHints") return false;
  if (currentProblem(before).kind !== "calculate" || before.lesson.isTilesFirst) return false;
  return before.view === "answer" && before.shownHints === 0 && before.rejectedAnswer === null;
}

/** 送ったときだけ、その宛先を返す（送らなかったときは null） */
export function reportIfRecordable(before: LessonSession, after: LessonSession): RecordTarget | null {
  if (!isSendOn() || !isRecordableWrong(before, after)) return null;
  const problem = currentProblem(before);
  if (problem.kind !== "calculate") return null;
  const target: RecordTarget = {
    lessonKey: before.lesson.id,
    problem: `${fractionText(problem.left)}${problem.operator}${fractionText(problem.right)}`,
    problemIndex: before.problemIndex,
    pattern: classifyWrongAnswer(problem, before.answerText),
  };
  // どの章の学習か。planId は「章の id:学習の名前」（plan.ts）。先生の画面が単元（章＋何マス目）で並べるのに使う（#255）
  // planId が無い学習（出題表から組み立てていない学習）は、章が分からないので送らない（章の分からない記録は作らない）
  const planId = before.lesson.planId ?? "";
  const chapterId = planId.includes(":") ? planId.slice(0, planId.indexOf(":")) : "";
  if (!chapterId) return target;
  const body = {
    chapterId,
    lessonKey: target.lessonKey,
    problem: target.problem,
    hintsShown: 0,
    pattern: target.pattern,
    source: "demo",
    occurredAt: new Date().toISOString(),
  };
  try {
    fetch(`${apiBase}/api/v1/stumbles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // 送れなくても、子どもの画面は止めない
  }
  return target;
}

/** プリントのてこの最初の予想違いを、数字だけの問題キーで学びの輪へ送る */
export function reportPrintLeverWrong(params: LeverParams, guess: number, handoutId?: string): RecordTarget | null {
  if (!isSendOn() || guess === params.left.g * params.left.pos / params.right.pos) return null;
  const target: RecordTarget = {
    lessonKey: "print:rika-lever",
    problem: `左${params.left.pos}-${params.left.g}g-右${params.right.pos}`,
    problemIndex: 0,
    pattern: classifyLeverWrongAnswer(params, guess),
    ...(handoutId ? { handoutId } : {}),
  };
  const body = {
    chapterId: "rika",
    ...(handoutId ? { handoutId } : {}),
    lessonKey: target.lessonKey,
    problem: target.problem,
    hintsShown: 0,
    pattern: target.pattern,
    source: "demo",
    occurredAt: new Date().toISOString(),
  };
  try {
    fetch(`${apiBase}/api/v1/stumbles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // 送れなくても、子どもの画面は止めない
  }
  return target;
}

/** 配られた分数のたし算・ひき算の、最初の間違いを学びの輪へ送る。条件（1 回目・ヒントやタイルの前）は章の学習と同じ */
export function reportPrintFractionWrong(before: LessonSession, after: LessonSession, handoutId: string): RecordTarget | null {
  if (!isSendOn() || !isRecordableWrong(before, after)) return null;
  const problem = currentProblem(before);
  if (problem.kind !== "calculate") return null;
  const target: RecordTarget = {
    lessonKey: FRACTION_LESSON_KEY,
    problem: `${fractionText(problem.left)} ${problem.operator} ${fractionText(problem.right)}`,
    problemIndex: before.problemIndex,
    pattern: classifyWrongAnswer(problem, before.answerText),
    handoutId,
  };
  const body = {
    chapterId: FRACTION_CHAPTER_ID,
    handoutId,
    lessonKey: target.lessonKey,
    problem: target.problem,
    hintsShown: 0,
    pattern: target.pattern,
    source: "demo",
    occurredAt: new Date().toISOString(),
  };
  try {
    fetch(`${apiBase}/api/v1/stumbles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // 送れなくても、子どもの画面は止めない
  }
  return target;
}
