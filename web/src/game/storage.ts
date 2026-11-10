import { ALL_CHAPTERS, LATE_SUBJECTS, SAMPLE_STATE, SUBJECTS } from "../data";
import type { Chapter, GameState } from "../data";
import { clearAllResume } from "./lesson-resume";

const STORAGE_KEY = "sugoroku-home-v2";
// 分数の途中から始めていた頃の保存。開始の状態を変えた時に、全員の進みを消すと決めた（D-67）
const OLD_STORAGE_KEY = "sugoroku-home";

function dropOldSave(): void {
  if (localStorage.getItem(OLD_STORAGE_KEY) === null) return;
  localStorage.removeItem(OLD_STORAGE_KEY);
  clearAllResume();
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

// 章の記録が無いのは「まだ始めていない」なので通す。中身が崩れていると盤面を描けない
function hasValidProgress(chapter: Chapter, value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  const { done, sides, test } = value;
  return Number.isInteger(done) && (done as number) >= 0 && (done as number) <= chapter.items.length
    && Array.isArray(sides) && typeof test === "boolean";
}

function hasValidShape(value: Record<string, unknown>): boolean {
  const { chapterId, takenOff, xp, progress } = value;
  if (typeof chapterId !== "string" || !Array.isArray(takenOff) || !isRecord(xp) || !isRecord(progress)) return false;
  // 高原の教科と生活は後から足したので、古い保存には無くてよい（D-57、D-120）
  const hasValidXp = SUBJECTS.every((subject) => typeof xp[subject.id] === "number"
    || (xp[subject.id] === undefined && LATE_SUBJECTS.includes(subject.id)));
  // 全学年の章を調べる。進みの無い章は未着手とみなす
  return hasValidXp && ALL_CHAPTERS.every((chapter) => hasValidProgress(chapter, progress[chapter.id]));
}

/** 保存された文字列を状態にする。壊れていたら null（呼んだ側が見本から始める） */
export function parseState(raw: string): GameState | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || !hasValidShape(value)) return null;
  // 後から足した値は、古い保存には無いので見本の値で補う。盤面を開いたことのある人には最初の説明を出さない
  const base = structuredClone(SAMPLE_STATE);
  return { ...base, takenOff: [], introSeen: value.sansuSelected === true, ...value, xp: { ...base.xp, ...(value.xp as object) } } as GameState;
}

// 読めなくても画面は止めない。見本から始めれば動き、保存できない時は saveState の結果で伝わる
export function loadState(): GameState {
  try {
    dropOldSave();
    const raw = localStorage.getItem(STORAGE_KEY);
    return (raw ? parseState(raw) : null) ?? structuredClone(SAMPLE_STATE);
  } catch {
    return structuredClone(SAMPLE_STATE);
  }
}

export interface SaveResult {
  ok: boolean;
  /** CP-211 を出すべきか。失敗が続いても最初の1回だけ true */
  shouldNotify: boolean;
}

export function saveState(state: GameState, alreadyNotified: boolean): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true, shouldNotify: false };
  } catch {
    return { ok: false, shouldNotify: !alreadyNotified };
  }
}
