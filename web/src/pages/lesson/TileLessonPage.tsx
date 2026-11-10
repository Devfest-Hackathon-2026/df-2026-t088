import { GradeOneLesson } from "./GradeOneLesson";
import { GradeTwoLesson } from "./GradeTwoLesson";
import { findGradeOne, gradeOneSummary } from "../../lesson/grade-one";
import { findGradeTwo, gradeTwoSummary } from "../../lesson/grade-two";
import { findUpperMath, upperMathSummary } from "../../lesson/upper-math";
import { UpperMathLesson } from "./UpperMathLesson";
import { FractionIntro } from "./FractionIntro";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Ruby } from "../../components/Ruby";
import { COPY } from "../../copy";
import { playBackFade } from "../../back-wave/back-wave";
import { clearResume, loadResume } from "../../game/lesson-resume";
import type { Game } from "../../game/use-game";
import { findLesson } from "../../lesson/fraction-lessons";
import { practiceFromHash } from "../../lesson/practice-link";
import type { LessonDefinition } from "../../lesson/problems";
import { LESSON_COPY } from "../../lesson/wording";
import { useText } from "../../grade";
import { chapterPath, useRoute } from "../../routing";
import { canStart, LessonClear, targetOf, titleOf } from "./lesson-common";
import { LessonButton } from "./LessonButton";
import { ProblemCard } from "./ProblemCard";
import { TileSupport, TileWork } from "./TileWork";
import { useTileLesson } from "./use-tile-lesson";
import { usePinnedActionsHeight } from "./use-pinned-actions";
import "./lesson.css";

interface LessonScreenProps {
  game?: Game;
  lesson: LessonDefinition;
  title: string;
  isRepeat: boolean;
  onExit: () => void;
  onFinish: () => void;
}

function LessonScreen({ game, lesson: definition, title, isRepeat, onExit, onFinish }: LessonScreenProps) {
  const t = useText();
  const total = definition.problems.length;
  const lesson = useTileLesson(definition, game ? loadResume(definition) : 0, { preview: !game });
  const { session, refs } = lesson;
  // タイルを開いている間だけ、左に問題・右にタイルの2列にする（D-127）
  const isSplit = session.view !== "answer";
  // 767px 以下は、問題の式を上に、ボタンの列を下に固定する（D-238）。やったねの画面は固定しない
  const isPinned = !session.isCleared;
  usePinnedActionsHeight(refs.mainRef, isPinned);

  return (
    <main className={`${isSplit ? "lesson is-split" : session.isCleared ? "lesson is-cleared" : "lesson"}${isPinned ? " lesson-pinned" : ""}`} ref={refs.mainRef}>
      <header className="lesson-header">
        <h1 aria-label={t(title)}><Ruby text={title} /></h1>
        <p className="lesson-progress">{t(LESSON_COPY.progress(session.problemIndex + 1, total))}</p>
        {!session.isCleared && <LessonButton text={game ? LESSON_COPY.exit : COPY.CP_760} variant="text" className="lesson-exit" se={null} onClick={onExit} />}
      </header>
      <ProblemCard lesson={lesson} support={isSplit ? <TileSupport lesson={lesson} /> : undefined} />
      {isSplit && <TileWork lesson={lesson} />}
      {session.isCleared && <LessonClear game={game} total={total} isRepeat={isRepeat} onFinish={onFinish} sectionRef={refs.clearRef} buttonText={game ? LESSON_COPY.clearButton : COPY.CP_760} />}
    </main>
  );
}

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function PracticeLesson({ lesson, title, onExit }: { lesson: LessonDefinition; title: string; onExit: () => void }) {
  const [introDone, setIntroDone] = useState(false);
  if (lesson.intro && !introDone) {
    return <FractionIntro intro={lesson.intro} title={title} onExit={onExit} onFinish={() => setIntroDone(true)} />;
  }
  return <LessonScreen lesson={lesson} title={title} isRepeat={false} onExit={onExit} onFinish={onExit} />;
}

/** 先生が並べた問題を、すごろくの記録から分けて解く。 */
export function SharedPracticePage({ onExit }: { onExit: () => void }) {
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash);
  const practice = practiceFromHash(hash);
  if (!practice) {
    return (
      <main className="lesson">
        <p role="alert">{LESSON_COPY.invalidPractice}</p>
        <LessonButton text={COPY.CP_760} variant="text" se={null} onClick={onExit} />
      </main>
    );
  }
  return <PracticeLesson key={hash} {...practice} onExit={onExit} />;
}

export interface TileLessonPageProps {
  game: Game;
  /** どのマスの学習か。道の末尾の名前 */
  lessonKey: string;
}

/** PG-003 の学習。クリアすると盤面へ戻り、いつもの流れで歩いて経験値が増える */
export function TileLessonPage({ game, lessonKey }: TileLessonPageProps) {
  const { replace } = useRoute();
  const { chapter, chapterProgress: progress } = game;
  const target = targetOf(lessonKey, chapter);
  // 図解を見終えた学習。見終えたら同じ学習の問題へ進む（図解だけではマスを終えない）
  const [introDone, setIntroDone] = useState<string | null>(null);
  const lesson = target ? findLesson(chapter.id, target) : undefined;
  const upper = target && !lesson ? findUpperMath(chapter.id, target) : undefined;
  const gradeOne = target && !lesson ? findGradeOne(chapter.id, target) : undefined;
  const gradeTwo = target && !lesson ? findGradeTwo(chapter.id, target) : undefined;
  const isOpen = target !== null && (lesson !== undefined || upper !== undefined || gradeOne !== undefined || gradeTwo !== undefined) && canStart(chapter, progress, target);

  // 履歴から、開いていない章や鍵のマスの学習へ来た時は盤面へ送る。クリアしても進まない学習を見せない
  useEffect(() => {
    if (!isOpen) replace(chapterPath(chapter.id));
  }, [isOpen, replace, chapter.id]);

  if (!isOpen) return null;

  // MOT-032：紙の幕が覆った時に盤面へ移り、消えてから歩く（D-251）
  const backToBoard = () => playBackFade(() => replace(chapterPath(chapter.id)));
  const handleFinish = () => {
    playBackFade(() => {
      if (lesson) clearResume(lesson);
      replace(chapterPath(chapter.id));
    }, () => { void game.completeLesson(target); });
  };

  if (upper) return <UpperMathLesson key={`${chapter.id}-${lessonKey}`} practice={upper}
    summary={target.kind === "test" ? upperMathSummary(chapter.id) : undefined}
    onExit={backToBoard} onFinish={handleFinish} />;
  if (gradeOne) return <GradeOneLesson key={`${chapter.id}-${lessonKey}`} topic={gradeOne}
    topics={target.kind === "test" ? gradeOneSummary(chapter.id) : undefined} onExit={backToBoard} onFinish={handleFinish} />;
  if (gradeTwo) return <GradeTwoLesson key={`${chapter.id}-${lessonKey}`} practice={gradeTwo.practice}
    summary={target.kind === "test" ? gradeTwoSummary(chapter.id) : undefined} onExit={backToBoard} onFinish={handleFinish} />;
  if (!lesson) return null;

  // 図解のある学習は、1問目から始める時だけ先に図解を見せる。途中から続ける時は問題から
  const lessonName = lesson.planId ?? lesson.id;
  if (lesson.intro && introDone !== lessonName && loadResume(lesson) === 0) {
    return <FractionIntro key={lessonName} intro={lesson.intro} title={titleOf(chapter, target)} onExit={backToBoard} onFinish={() => setIntroDone(lessonName)} />;
  }

  const isRepeat = target.kind === "side" && progress.sides.includes(target.sideId);
  return <LessonScreen game={game} lesson={lesson} title={titleOf(chapter, target)} isRepeat={isRepeat} onExit={backToBoard} onFinish={handleFinish} />;
}
