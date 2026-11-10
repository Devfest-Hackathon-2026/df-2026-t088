import { findGradeOne } from "../lesson/grade-one";
import { findGradeTwo } from "../lesson/grade-two";
import { findUpperMath } from "../lesson/upper-math";
import { findLesson, lessonKey } from "../lesson/fraction-lessons";
import { lessonPath, pushRoute } from "../routing";
import type { LessonTarget } from "./logic";

export function hasMathLesson(chapterId: string, target: LessonTarget): boolean {
  return Boolean(findLesson(chapterId, target) || findUpperMath(chapterId, target) || findGradeOne(chapterId, target) || findGradeTwo(chapterId, target));
}

export interface StartResult {
  /** 学習画面（PG-003）につながったか */
  connected: boolean;
}

// どのマスの学習かを道に入れて開く。学習が無いマスは呼んだ側が CP-222 のトーストを出す。
// 学習を終えた時は、学習画面が use-game の completeLesson(target) を呼ぶ
export function startLesson(chapterId: string, target: LessonTarget): StartResult {
  if (!hasMathLesson(chapterId, target)) return { connected: false };
  pushRoute(lessonPath(lessonKey(target)));
  return { connected: true };
}
