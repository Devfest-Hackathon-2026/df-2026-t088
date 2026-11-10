import { COPY } from "../copy";
import type { Chapter, GameState, SubjectId } from "../data";
import {
  defaultCardTarget,
  isChapterOpen,
  nextChapterAfter,
  nextOpenChapter,
  progressOf,
  requiredChapter,
} from "./logic";
import type { Game } from "./use-game";
import type { LessonTarget } from "./logic";
import { courseChapterPath, courseLessonPath, pushRoute } from "../routing";

export interface Course {
  subjectId: SubjectId;
  chapters: readonly Chapter[];
  hasLesson: (chapterId: string, target: LessonTarget) => boolean;
}

/** 課程のその章に、問題が1つでもあるか */
export function courseHasLessonsInChapter(course: Course, id: string): boolean {
  const targetChapter = course.chapters.find((item) => item.id === id);
  if (!targetChapter) return false;
  return targetChapter.items.some((_item, index) => course.hasLesson(id, { kind: "main", index }))
    || course.hasLesson(id, { kind: "test" })
    || targetChapter.sides.some((side) => course.hasLesson(id, { kind: "side", sideId: side.id }));
}

/** 既存盤面へ、指定教科の章順と学習有無を差し込む */
export function useCourseGame(game: Game, course: Course, chapterId: string) {
  const chapter = course.chapters.find((item) => item.id === chapterId) ?? course.chapters[0];
  if (!chapter) throw new Error(`課程に章がありません: ${course.subjectId}`);
  const chapterProgress = progressOf(game.state, chapter);
  const hasLessonsIn = (id: string): boolean => courseHasLessonsInChapter(course, id);
  const nextChapter = nextChapterAfter(game.state, chapter, course.chapters, hasLessonsIn);
  const selectChapter = (id: string): boolean => game.selectChapterIn(id, course.chapters, hasLessonsIn);
  const openChapter = (id: string): boolean => {
    if (!selectChapter(id)) return false;
    pushRoute(courseChapterPath(id, course.subjectId));
    return true;
  };
  const startLesson = (target: LessonTarget): boolean => {
    if (!course.hasLesson(chapter.id, target)) {
      game.showToast(COPY.CP_222);
      return false;
    }
    pushRoute(courseLessonPath(chapter.id, targetKey(target), course.subjectId));
    return true;
  };
  return {
    ...game,
    state: { ...game.state, chapterId: chapter.id } as GameState,
    // sansu の章の並びではなく、この課程の章の並び
    chapters: course.chapters,
    chapter,
    chapterProgress,
    subjectId: course.subjectId,
    hasLesson: (target: LessonTarget) => course.hasLesson(chapter.id, target),
    hasLessonsInChapter: hasLessonsIn,
    progressOf: (target: Chapter) => progressOf(game.state, target),
    isChapterOpen: (target: Chapter) => isChapterOpen(game.state, target, course.chapters, hasLessonsIn),
    requiredChapterOf: (target: Chapter) => requiredChapter(game.state, target, course.chapters, hasLessonsIn),
    nextOpenChapter: nextOpenChapter(game.state, course.chapters, hasLessonsIn),
    nextChapter,
    selectChapter,
    openChapter,
    completeLesson: (target: LessonTarget) => game.completeLesson(target, chapter, course.subjectId),
    startLesson,
  };
}

function targetKey(target: LessonTarget): string {
  if (target.kind === "main") return `main-${target.index}`;
  if (target.kind === "side") return target.sideId;
  return "test";
}

export function emptyCourse(subjectId: SubjectId, chapters: readonly Chapter[]): Course {
  return { subjectId, chapters, hasLesson: () => false };
}

export { defaultCardTarget };
