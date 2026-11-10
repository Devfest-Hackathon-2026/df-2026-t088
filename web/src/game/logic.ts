import {
  CHAPTERS,
  findAnyChapter,
  EQUIPMENT,
  REWARD,
  XP_PER_AVATAR_LEVEL,
  XP_PER_SUBJECT_LEVEL,
} from "../data";
import type { Chapter, ChapterProgress, Equipment, GameState, GearId, Side, SubjectId } from "../data";

/** 学習を終えた時に、どこを終えたかを伝える形 */
export type LessonTarget =
  | { kind: "main"; index: number }
  | { kind: "test" }
  | { kind: "side"; sideId: string };

/* ---------- 経験値とレベル ---------- */

export function totalXp(state: GameState): number {
  return Object.values(state.xp).reduce((sum, xp) => sum + xp, 0);
}

export const subjectLevel = (xp: number): number => Math.floor(xp / XP_PER_SUBJECT_LEVEL) + 1;
export const avatarLevel = (xp: number): number => Math.floor(xp / XP_PER_AVATAR_LEVEL) + 1;

/** 次のレベルに向けて、今のレベルの中でためた経験値 */
export const xpIntoAvatarLevel = (xp: number): number => xp % XP_PER_AVATAR_LEVEL;

// 保存するのは「はずした装備」だけ。新しく手に入れた装備は、何もしなくても身につく
export function wornGear(state: GameState): GearId[] {
  const level = avatarLevel(totalXp(state));
  return EQUIPMENT.filter((item) => item.level <= level && !state.takenOff.includes(item.id)).map((item) => item.id);
}

export function nextGear(level: number): Equipment | undefined {
  return EQUIPMENT.find((item) => item.level > level);
}

export interface XpResult {
  state: GameState;
  /** アバターのレベルが上がった時だけ入る */
  levelUp: { level: number; newGear: Equipment | undefined } | null;
  /** 指定した教科のレベルが上がった時だけ入る */
  subjectLevelUp: number | null;
  /** 後方互換。算数のレベルが上がった時だけ入る */
  sansuLevelUp: number | null;
}

export function applyXp(state: GameState, amount: number, subjectId: SubjectId = "sansu"): XpResult {
  const beforeAvatar = avatarLevel(totalXp(state));
  const beforeSansu = subjectLevel(state.xp[subjectId]);
  const next: GameState = { ...state, xp: { ...state.xp, [subjectId]: state.xp[subjectId] + amount } };
  const afterAvatar = avatarLevel(totalXp(next));
  const afterSansu = subjectLevel(next.xp[subjectId]);
  const levelUp = afterAvatar > beforeAvatar
    ? { level: afterAvatar, newGear: EQUIPMENT.find((item) => item.level > beforeAvatar && item.level <= afterAvatar) }
    : null;
  const subjectLevelUp = afterSansu > beforeSansu ? afterSansu : null;
  return { state: next, levelUp, subjectLevelUp, sansuLevelUp: subjectId === "sansu" ? subjectLevelUp : null };
}

/* ---------- 章の鍵 ---------- */

export const findChapter = (chapterId: string): Chapter | undefined => findAnyChapter(chapterId);

export function progressOf(state: GameState, chapter: Chapter): ChapterProgress {
  return state.progress[chapter.id] ?? { done: 0, sides: [], test: false };
}

/** その章に問題があるか。章の開き方（FR-004）が使う */
export type HasLessons = (chapterId: string) => boolean;

/** 省くと、どの章にも問題がある扱い（問題のある章のテストが、順番のある教科の鍵になる） */
const EVERY_CHAPTER_HAS_LESSONS: HasLessons = () => true;

// 問題（学習内容）が1つも無い章は、まだ作っていない印の鍵で閉じる（D-133）。どの章にも問題が無い教科は、章が全部閉じる。
// 問題のある章のうち、順番の無い章（chapter.ordered が false）はいつも開く。順番のある章は、前の章のうち問題のある章のテストを全部クリアすると開く（FR-004）。
// 問題の無い章は1本道を止めない
export function isChapterOpen(state: GameState, chapter: Chapter, chapters: readonly Chapter[] = CHAPTERS, hasLessons: HasLessons = EVERY_CHAPTER_HAS_LESSONS): boolean {
  return hasLessons(chapter.id) && requiredChapter(state, chapter, chapters, hasLessons) === undefined;
}

/** chapter を開くためにクリアが要る章。前にあって問題があり、テスト未クリアの最初の章。無ければ undefined */
export function requiredChapter(state: GameState, chapter: Chapter, chapters: readonly Chapter[] = CHAPTERS, hasLessons: HasLessons = EVERY_CHAPTER_HAS_LESSONS): Chapter | undefined {
  if (!chapter.ordered) return undefined;
  const index = chapters.findIndex((candidate) => candidate.id === chapter.id);
  return chapters.slice(0, Math.max(index, 0)).find((previous) => hasLessons(previous.id) && !progressOf(state, previous).test);
}

/** chapter のテストをクリアした後に送る章。同じ分野の後ろ、無ければ全体の最初の未クリア。全部クリア済みなら undefined */
export function nextChapterAfter(state: GameState, chapter: Chapter, chapters: readonly Chapter[] = CHAPTERS, hasLessons: HasLessons = EVERY_CHAPTER_HAS_LESSONS): Chapter | undefined {
  const index = chapters.findIndex((candidate) => candidate.id === chapter.id);
  const later = chapters.slice(index + 1);
  const sameDomain = later.find((candidate) => (
    candidate.domain === chapter.domain && isChapterOpen(state, candidate, chapters, hasLessons) && !progressOf(state, candidate).test
  ));
  return sameDomain ?? nextOpenChapter(state, chapters, hasLessons);
}

/* ---------- 章の道 ---------- */

/** カードで最初に選ぶマス。マスが残っていれば今のマス、全部終えていれば章のテスト */
export function defaultCardTarget(chapter: Chapter, progress: ChapterProgress): LessonTarget {
  return progress.done < chapter.items.length ? { kind: "main", index: progress.done } : { kind: "test" };
}

/** まだテストをクリアしていない、開いている最初の章。無ければ undefined */
export function nextOpenChapter(state: GameState, chapters: readonly Chapter[] = CHAPTERS, hasLessons: HasLessons = EVERY_CHAPTER_HAS_LESSONS): Chapter | undefined {
  return chapters.find((chapter) => !progressOf(state, chapter).test && isChapterOpen(state, chapter, chapters, hasLessons));
}

// 閉じた章や存在しない章を開いたまま保存されていたら、開いている章へ戻す（別の学年の章も、この教科の章に無ければ同じ）。
// 全部クリア済みなら開いている最初の章へ。どの章も開いていなければ、保存の章がこの教科にある時は移さない（D-133）
export function normalizeChapter(state: GameState, chapters: readonly Chapter[] = CHAPTERS, hasLessons: HasLessons = EVERY_CHAPTER_HAS_LESSONS): GameState {
  const current = chapters.find((chapter) => chapter.id === state.chapterId);
  if (current && isChapterOpen(state, current, chapters, hasLessons)) return state;
  const fallback = nextOpenChapter(state, chapters, hasLessons)
    ?? chapters.find((chapter) => isChapterOpen(state, chapter, chapters, hasLessons))
    ?? (current ? undefined : chapters[chapters.length - 1]);
  return fallback ? { ...state, chapterId: fallback.id } : state;
}

export type CellStatus = "done" | "now" | "todo";

export function mainCellStatus(progress: ChapterProgress, index: number): CellStatus {
  if (index < progress.done) return "done";
  return index === progress.done ? "now" : "todo";
}

export const isSideOpen = (progress: ChapterProgress, side: Side): boolean => progress.done >= side.after;

/* ---------- 進みの適用 ---------- */

export interface ProgressResult {
  state: GameState;
  /** 増える経験値。寄り道の2回目などは 0 */
  amount: number;
  /** 受け付けられる学習だったか。順番を飛ばした指定などは false */
  valid: boolean;
}

function withProgress(state: GameState, chapter: Chapter, progress: ChapterProgress): GameState {
  return { ...state, progress: { ...state.progress, [chapter.id]: progress } };
}

function completeSide(state: GameState, chapter: Chapter, progress: ChapterProgress, sideId: string): ProgressResult {
  const side = chapter.sides.find((candidate) => candidate.id === sideId);
  if (!side || !isSideOpen(progress, side)) return { state, amount: 0, valid: false };
  // 寄り道の2回目は経験値を増やさない（D-21）
  if (progress.sides.includes(sideId)) return { state, amount: 0, valid: true };
  const next = { ...progress, sides: [...progress.sides, sideId] };
  return { state: withProgress(state, chapter, next), amount: REWARD[side.type], valid: true };
}

/** 学習を終えた分だけ進みを動かす。経験値はここでは足さず、増える量だけ返す */
export function applyProgress(state: GameState, target: LessonTarget, selectedChapter?: Chapter): ProgressResult {
  const chapter = selectedChapter ?? findChapter(state.chapterId);
  const none: ProgressResult = { state, amount: 0, valid: false };
  if (!chapter) return none;
  const progress = progressOf(state, chapter);
  if (target.kind === "side") return completeSide(state, chapter, progress, target.sideId);
  if (target.kind === "main") {
    // 今のマスだけがクリアできる。終えたマスの再クリアでは増やさない
    if (target.index !== progress.done || target.index >= chapter.items.length) return none;
    return { state: withProgress(state, chapter, { ...progress, done: progress.done + 1 }), amount: REWARD.main, valid: true };
  }
  if (progress.done < chapter.items.length || progress.test) return none;
  return { state: withProgress(state, chapter, { ...progress, test: true }), amount: REWARD.test, valid: true };
}

/** CSS の時間（"620ms" や "0.5s"）をミリ秒にする。読めなければ fallback */
export function parseDurationMs(value: string, fallback: number): number {
  const match = /^\s*(-?\d*\.?\d+)(ms|s)\s*$/.exec(value);
  if (!match) return fallback;
  const amount = Number(match[1]);
  return match[2] === "s" ? amount * 1000 : amount;
}
