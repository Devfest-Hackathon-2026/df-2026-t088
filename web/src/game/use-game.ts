import { findUpperMath, hasUpperMath } from "../lesson/upper-math";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COPY } from "../copy";
import { EQUIPMENT, SAMPLE_STATE, SUBJECTS, XP_PER_AVATAR_LEVEL, chaptersOf } from "../data";
import type { Chapter, Equipment, GameState, GearId, SubjectId } from "../data";
import { DEFAULT_GRADE, useGrade } from "../grade";
import { findLesson, hasLessons as hasFractionLessons } from "../lesson/fraction-lessons";
import { startLesson as startLessonViaGateway } from "./lesson-gateway";
import { chapterPath, pushRoute } from "../routing";
import { clearAllResume } from "./lesson-resume";
import { reportProgress, type ProgressByChapter } from "./progress-sync";
import {
  applyProgress,
  applyXp,
  avatarLevel,
  isChapterOpen,
  nextGear,
  nextChapterAfter,
  nextOpenChapter,
  normalizeChapter,
  parseDurationMs,
  progressOf,
  requiredChapter,
  subjectLevel,
  totalXp,
  wornGear,
  xpIntoAvatarLevel,
} from "./logic";
import type { HasLessons, LessonTarget } from "./logic";
import { loadState, saveState } from "./storage";

const hasLessons = (chapterId: string) => hasFractionLessons(chapterId) || hasUpperMath(chapterId);

export interface ToastMessage {
  /** 同じ文でも出し直せるように、出すたびに変える */
  id: number;
  text: string;
}

export interface LevelUpInfo {
  level: number;
  newGear: Equipment | undefined;
}

declare global {
  interface Window {
    /** 開発時だけ。歩く動きとレベルアップの確認に使う */
    __sugorokuDev?: { completeLesson: (target: LessonTarget) => Promise<void> };
  }
}

const FALLBACK_WALK_MS = 620;
const FALLBACK_TOAST_MS = 4000;

const reducesMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function readTokenMs(name: string, fallback: number): number {
  return parseDurationMs(getComputedStyle(document.documentElement).getPropertyValue(name), fallback);
}

// 動きを減らす設定の人には待たずに結果だけを出す
const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => { setTimeout(resolve, reducesMotion() ? 0 : ms); });

/** 算数の章を、今の学年のものにして動かす。学年が無い所（Provider の外）は初めの学年（DEFAULT_GRADE。6年） */
export function useGame() {
  const grade = useGrade() ?? DEFAULT_GRADE;
  // 同じ学年なら同じ配列。問題がある章は、5年算数の出題表（plans/sansu-5.ts）がある分数・整数・小数・□と△の式（hasLessons は章 id で引く）
  const chapters = chaptersOf(grade, "sansu");
  const [state, setState] = useState<GameState>(() => normalizeChapter(loadState(), chapters, hasLessons));
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [levelUp, setLevelUp] = useState<LevelUpInfo | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [walkingTo, setWalkingTo] = useState<LessonTarget | null>(null);
  // 進みを画面に反映するまで（寄り道へ歩く間）だけ、学習へ入れない。反映した後に歩く間は入れる（#370）
  const [isEntryLocked, setIsEntryLocked] = useState(false);
  const entryLockedRef = useRef(false);

  // 歩く間に await をまたぐので、最新の値は ref からも読む
  const stateRef = useRef(state);
  const busyRef = useRef(false);
  const toastId = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saveFailureNotified = useRef(false);
  // 経験値は歩いた後で画面に出す。まだ出していない分を持ち、保存にだけ先に足す
  const unshownXp = useRef(0);
  // 歩いている間のクリア。画面の進みは歩いてから進むが、保存にはいつでも進みを含める
  const walkingTarget = useRef<{ target: LessonTarget; chapter?: Chapter; subjectId: SubjectId } | null>(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = useCallback((text: string) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), readTokenMs("--toast-duration", FALLBACK_TOAST_MS));
  }, []);

  // 先生へ送った進みの最後の形（増えた章だけを送るための控え）
  const reportedProgress = useRef<ProgressByChapter>({});
  // 保存に失敗しても画面は止めず、CP-211 を最初の1回だけ出す
  const persist = useCallback((next: GameState) => {
    // 増えた章の進みを先生の画面へ送る（仮・失敗は黙る）。送った分を覚えて、同じものは送り直さない
    reportProgress(reportedProgress.current, next.progress as ProgressByChapter);
    reportedProgress.current = next.progress as ProgressByChapter;
    const result = saveState(next, saveFailureNotified.current);
    if (result.shouldNotify) {
      saveFailureNotified.current = true;
      showToast(COPY.CP_211);
    }
  }, [showToast]);

  const commit = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
    // 歩く間のどの時刻の保存でも、進みと経験値をそろえて書く（終えた進みを足し直しても増えない）
    const walking = walkingTarget.current;
    const saved = walking ? applyProgress(next, walking.target, walking.chapter).state : next;
    persist(applyXp(saved, unshownXp.current, walking?.subjectId ?? "sansu").state);
  }, [persist]);

  const giveXp = useCallback((amount: number, subjectId: SubjectId = "sansu") => {
    const result = applyXp(stateRef.current, amount, subjectId);
    commit(result.state);
    if (result.levelUp) setLevelUp(result.levelUp);
    else {
      const subject = SUBJECTS.find((candidate) => candidate.id === subjectId)?.name ?? "";
      showToast(result.subjectLevelUp ? COPY.CP_213(amount, result.subjectLevelUp, subject) : COPY.CP_212(amount));
    }
  }, [commit, showToast]);

  // 歩く → 経験値 → トーストかレベルアップ。歩く間は isBusy。
  // 動きは順に見せるが、保存は歩く前に進みと経験値を一度に書く。歩く途中で読み直しても経験値が消えない
  const completeLesson = useCallback(async (target: LessonTarget, chapter?: Chapter, subjectId: SubjectId = "sansu") => {
    if (busyRef.current) return;
    const { state: progressed, amount, valid } = applyProgress(stateRef.current, target, chapter);
    if (!valid) return;
    busyRef.current = true;
    entryLockedRef.current = true;
    setIsBusy(true);
    setIsEntryLocked(true);
    try {
      unshownXp.current = amount;
      walkingTarget.current = { target, chapter, subjectId };
      persist(applyXp(progressed, amount, subjectId).state);
      const walkMs = readTokenMs("--duration-walk", FALLBACK_WALK_MS);
      // 寄り道は、いったん寄り道のマスまで歩いてから本線へ戻る
      if (target.kind === "side") {
        setWalkingTo(target);
        await wait(walkMs);
      }
      commit(applyProgress(stateRef.current, target, chapter).state);
      setWalkingTo(null);
      entryLockedRef.current = false;
      setIsEntryLocked(false);
      await wait(walkMs);
      unshownXp.current = 0;
      walkingTarget.current = null;
      if (amount > 0) giveXp(amount, subjectId);
    } finally {
      walkingTarget.current = null;
      busyRef.current = false;
      entryLockedRef.current = false;
      setIsBusy(false);
      setIsEntryLocked(false);
      setWalkingTo(null);
    }
  }, [commit, giveXp, persist]);

  // 開発時だけ画面の外から呼べるようにする。本番のビルドでは取り除かれる
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__sugorokuDev = { completeLesson };
    return () => { delete window.__sugorokuDev; };
  }, [completeLesson]);

  // 島の地図に出ている島はどれも開く（D-117）
  const selectSubject = useCallback((subjectId: SubjectId): boolean => {
    // 盤面へ直に開くかどうかに使うので、算数の島を選んだ時だけ立てる（D-91）
    if (subjectId === "sansu" && !stateRef.current.sansuSelected) commit({ ...stateRef.current, sansuSelected: true });
    return true;
  }, [commit]);

  // 保存の「章」を替える。鍵の章と知らない章は何もしない（D-96、D-98 で CP-210 は出さない）。替えたか、もう今の章なら true
  const selectChapter = useCallback((chapterId: string): boolean => {
    if (busyRef.current) return false;
    const chapter = chapters.find((candidate) => candidate.id === chapterId);
    if (!chapter || !isChapterOpen(stateRef.current, chapter, chapters, hasLessons)) return false;
    if (stateRef.current.chapterId !== chapterId) commit({ ...stateRef.current, chapterId });
    return true;
  }, [commit, chapters]);

  // 算数以外の課程の章を替える。開き方は課程の問題の有無（hasLessonsOf）で決める
  const selectChapterIn = useCallback((chapterId: string, courseChapters: readonly Chapter[], hasLessonsOf: HasLessons): boolean => {
    if (busyRef.current) return false;
    const chapter = courseChapters.find((candidate) => candidate.id === chapterId);
    // 保存の chapterId は「最後に開いた算数の章」（TBL-002）なので書かない。ほかの教科の今の章は道から決まる
    return chapter !== undefined && isChapterOpen(stateRef.current, chapter, courseChapters, hasLessonsOf);
  }, []);

  // 章の盤面（/sansu/{章の id}）へ移る。PG-004 の札と、カードの「つぎの章へ」から使う（D-100）
  const openChapter = useCallback((chapterId: string): boolean => {
    if (!selectChapter(chapterId)) return false;
    pushRoute(chapterPath(chapterId));
    return true;
  }, [selectChapter]);

  const openChapterIn = useCallback((chapterId: string, courseChapters: readonly Chapter[], subjectId: SubjectId, hasLessonsOf: HasLessons): boolean => {
    if (!selectChapterIn(chapterId, courseChapters, hasLessonsOf)) return false;
    pushRoute(chapterPath(chapterId, subjectId));
    return true;
  }, [selectChapterIn]);

  const toggleGear = useCallback((gearId: GearId) => {
    const current = stateRef.current;
    const gear = EQUIPMENT.find((item) => item.id === gearId);
    if (!gear || gear.level > avatarLevel(totalXp(current))) return;
    const takenOff = current.takenOff.includes(gearId)
      ? current.takenOff.filter((id) => id !== gearId)
      : [...current.takenOff, gearId];
    commit({ ...current, takenOff });
  }, [commit]);

  /** 歩いている間は消さず、false を返す */
  const reset = useCallback((): boolean => {
    if (busyRef.current) return false;
    setLevelUp(null);
    clearAllResume();
    commit(structuredClone(SAMPLE_STATE));
    return true;
  }, [commit]);

  // 学習が無いマスでも「はじめる」は出す。押された時は CP-222 のトーストで伝える（D-93）
  const startLesson = useCallback((target: LessonTarget): boolean => {
    if (entryLockedRef.current) return false;
    const { connected } = startLessonViaGateway(stateRef.current.chapterId, target);
    if (!connected) showToast(COPY.CP_222);
    return connected;
  }, [showToast]);

  const dismissIntro = useCallback(() => {
    if (!stateRef.current.introSeen) commit({ ...stateRef.current, introSeen: true });
  }, [commit]);

  const clearLevelUp = useCallback(() => setLevelUp(null), []);

  return useMemo(() => {
    const total = totalXp(state);
    const level = avatarLevel(total);
    // 保存の章が今の学年の算数に無い（別の学年の章など）時は、今の学年の算数の最初の開いた章（FR-008）
    const effectiveId = normalizeChapter(state, chapters, hasLessons).chapterId;
    const chapter: Chapter = chapters.find((candidate) => candidate.id === effectiveId) ?? chapters[0] as Chapter;
    const intoLevel = xpIntoAvatarLevel(total);
    return {
      state,
      level,
      totalXp: total,
      wornGear: wornGear(state),
      /** 次のレベルまでに足りない経験値 */
      xpToNextLevel: XP_PER_AVATAR_LEVEL - intoLevel,
      /** 今のレベルの中の割合（0〜1） */
      levelRatio: intoLevel / XP_PER_AVATAR_LEVEL,
      nextGear: nextGear(level),
      subjectLevel: (subjectId: SubjectId) => subjectLevel(state.xp[subjectId]),
      subjectId: "sansu" as SubjectId,
      /** 今の学年の算数の章の並び */
      chapters,
      chapter,
      chapterProgress: progressOf(state, chapter),
      /** このマスの学習を作ってあるか */
      hasLesson: (target: LessonTarget) => (findLesson(chapter.id, target) ?? findUpperMath(chapter.id, target)) !== undefined,
      /** 指定した章に学習が1つでもあるか */
      hasLessonsInChapter: (chapterId: string) => hasLessons(chapterId),
      progressOf: (target: Chapter) => progressOf(state, target),
      isChapterOpen: (target: Chapter) => isChapterOpen(state, target, chapters, hasLessons),
      /** 鍵の章に行く前にクリアする章 */
      requiredChapterOf: (target: Chapter) => requiredChapter(state, target, chapters, hasLessons),
      nextOpenChapter: nextOpenChapter(state, chapters, hasLessons),
      /** 今の章のテストをクリアした後に送る章 */
      nextChapter: nextChapterAfter(state, chapter, chapters, hasLessons),
      selectSubject,
      selectChapter,
      selectChapterIn,
      openChapter,
      openChapterIn,
      completeLesson,
      startLesson,
      dismissIntro,
      toggleGear,
      reset,
      toast,
      showToast,
      levelUp,
      clearLevelUp,
      isBusy,
      isEntryLocked,
      walkingTo,
    };
  }, [state, chapters, selectSubject, selectChapter, openChapter, completeLesson, startLesson, dismissIntro, toggleGear, reset, toast, showToast, levelUp, clearLevelUp, isBusy, isEntryLocked, walkingTo]);
}

export type Game = ReturnType<typeof useGame>;
