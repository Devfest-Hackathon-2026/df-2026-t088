import type { LessonDefinition } from "../lesson/problems";

// 学習の途中の問題。盤面へ戻っても読み直しても、同じ問題から続けるために学習ごとに覚える。
// 出題表を並べ替えても別の問題へ飛ばないよう、問題の id で覚える（FR-008・ADR-004）。id が無い問題だけ番号で覚える。
// 進みと経験値には数えないので GameState には入れない。読めなくても1問目から始めるだけで、学習は止めない
const RESUME_KEY = "sugoroku-lesson-resume";

// 学習を終えた回数。数の入れ替えの種になる（D-254）。途中で読み直しただけでは増えないので、同じ問題が続く
const ATTEMPT_KEY = "sugoroku-lesson-attempt";

type ResumeValue = string | number;
type LessonResume = Record<string, ResumeValue>;

/** 記録に必要な所だけ。国語の学習（key だけで、問題に id が無い）も同じ関数で扱う */
interface ResumeTarget {
  id: string;
  planId?: string;
  problems: readonly { id?: string }[];
}

function readAll(): LessonResume {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RESUME_KEY) ?? "{}");
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value as LessonResume : {};
  } catch {
    return {};
  }
}

function writeAll(resume: LessonResume): void {
  try {
    if (Object.keys(resume).length === 0) localStorage.removeItem(RESUME_KEY);
    else localStorage.setItem(RESUME_KEY, JSON.stringify(resume));
  } catch {
    // 保存できなくても学習は続けられる。読み直すと1問目に戻るだけ
  }
}

const nameOf = (lesson: ResumeTarget): string => lesson.planId ?? lesson.id;

// 古い記録（key だけの "main-3" など）は、問題が分数の章にしか無かった時に書いたもの。
// ほかの章の同じ名前のマスで読んだり消したりしないよう、分数の章と、planId の無い学習（国語）だけが見る
const LEGACY_CHAPTER = "fraction:";
const legacyKeyOf = (lesson: ResumeTarget): string | null =>
  lesson.planId === undefined || lesson.planId.startsWith(LEGACY_CHAPTER) ? lesson.id : null;

function withoutLegacy(resume: LessonResume, lesson: ResumeTarget): LessonResume {
  const legacy = legacyKeyOf(lesson);
  if (legacy === null) return resume;
  const { [legacy]: _legacy, ...rest } = resume;
  return rest;
}

/** 記録の値から問題の番号へ。読めない・見つからない時は 0 */
function indexOf(value: unknown, problems: ResumeTarget["problems"]): number {
  if (typeof value === "string") return Math.max(0, problems.findIndex((problem) => problem.id === value));
  // 古い記録は番号。問題の数より先の番号は、問題が減った時の記録なので捨てる
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < problems.length ? value : 0;
}

// 以前の分数の章のテストは6問だった。その前に3問を足したので、古い番号の記録は学習ごとの分だけずらして読む。
// planId の記録は今の番号で書かれているのでずらさない。ずらすのは古い key の数だけ
const LEGACY_OFFSET: Record<string, number> = { "fraction:test": 3 };

/** 古い key の番号を、今の問題の番号へ直す。負の数や小数は直さず、indexOf が 0 にする */
function shiftLegacy(value: unknown, lesson: ResumeTarget): unknown {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return value;
  return value + (LEGACY_OFFSET[nameOf(lesson)] ?? 0);
}

/** 学習の名前（planId）の記録を読む。無ければ古い key の記録を読む */
export function loadResume(lesson: LessonDefinition | ResumeTarget): number;
/** 国語の学習など、key と問題の数だけで覚えるもの */
export function loadResume(key: string, problemCount: number): number;
export function loadResume(target: ResumeTarget | string, problemCount?: number): number {
  const lesson = typeof target === "string" ? keyOnly(target, problemCount ?? 0) : target;
  const all = readAll();
  const planValue = all[nameOf(lesson)];
  if (planValue !== undefined && planValue !== null) return indexOf(planValue, lesson.problems);
  const legacy = legacyKeyOf(lesson);
  if (legacy === null) return 0;
  return indexOf(shiftLegacy(all[legacy], lesson), lesson.problems);
}

/** 問題に id があれば id を、無ければ番号を書く。古い key の記録は planId の方へ移す */
export function saveResume(lesson: LessonDefinition | ResumeTarget | string, problemIndex: number): void {
  const target = typeof lesson === "string" ? keyOnly(lesson, 0) : lesson;
  writeAll({ ...withoutLegacy(readAll(), target), [nameOf(target)]: target.problems[problemIndex]?.id ?? problemIndex });
}

function readAttempts(): Record<string, number> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ATTEMPT_KEY) ?? "{}");
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, number> : {};
  } catch {
    return {};
  }
}

/** その学習を終えた回数。読めない・記録が無い時は 0（出題表のまま） */
export function loadAttempt(planId: string): number {
  const value = readAttempts()[planId];
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function bumpAttempt(planId: string): void {
  try {
    localStorage.setItem(ATTEMPT_KEY, JSON.stringify({ ...readAttempts(), [planId]: loadAttempt(planId) + 1 }));
  } catch {
    // 保存できなければ 0 回目のまま動く
  }
}

/** 学習を終えた時は、その学習の分だけ消す。planId と古い key の両方。出題表のある学習は、終えた回数を 1 増やす */
export function clearResume(lesson: LessonDefinition | ResumeTarget | string): void {
  const target = typeof lesson === "string" ? keyOnly(lesson, 0) : lesson;
  const { [nameOf(target)]: _name, ...rest } = withoutLegacy(readAll(), target);
  writeAll(rest);
  if (target.planId !== undefined) bumpAttempt(target.planId);
}

/** はじめからにする時に、全部の学習の分を消す。終えた回数も 0 に戻す */
export function clearAllResume(): void {
  writeAll({});
  try {
    localStorage.removeItem(ATTEMPT_KEY);
  } catch {
    // 消せなくても、次に学習を開くと別の数になるだけ
  }
}

function keyOnly(key: string, problemCount: number): ResumeTarget {
  return { id: key, problems: Array.from({ length: problemCount }, () => ({})) };
}
