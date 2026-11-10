import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Ruby } from "../../components/Ruby";
import { playBackFade } from "../../back-wave/back-wave";
import { COPY } from "../../copy";
import type { LessonTarget } from "../../game/logic";
import type { Game } from "../../game/use-game";
import { clearResume, loadResume, saveResume } from "../../game/lesson-resume";
import { useText } from "../../grade";
import { playSe } from "../../audio/use-bgm";
import { currentProblem, createSession, nextProblem, pressHelp, submitAnswer, submitChoice, typeAnswer } from "../../lesson/quiz-session";
import type { QuizSession } from "../../lesson/quiz-session";
import type { QuizLesson, QuizProblem } from "../../lesson/quiz";
import { LESSON_COPY, MESSAGES } from "../../lesson/wording";
import { chapterPath, useRoute } from "../../routing";
import { LessonButton } from "./LessonButton";
import { LessonClear, canStart, targetOf, titleOf } from "./lesson-common";
import "./lesson.css";
import "./QuizLessonPage.css";

interface QuizGame extends Game {
  completeLesson: (target: LessonTarget) => Promise<void>;
}

export function QuizLessonPage({ game, lessonKey, lesson }: { game: QuizGame; lessonKey: string; lesson?: QuizLesson }) {
  const { replace } = useRoute();
  const { chapter, chapterProgress: progress } = game;
  const target = targetOf(lessonKey, chapter);
  const definition = lesson;
  const isOpen = target !== null && definition !== undefined && definition.problems.length > 0 && canStart(chapter, progress, target);
  useEffect(() => {
    if (!isOpen) replace(chapterPath(chapter.id, game.subjectId));
  }, [isOpen, replace, chapter.id, game.subjectId]);
  if (!isOpen || !target || !definition) return null;
  const backToBoard = () => playBackFade(() => replace(chapterPath(chapter.id, game.subjectId)));
  const handleFinish = () => playBackFade(() => {
    clearResume(definition.key);
    replace(chapterPath(chapter.id, game.subjectId));
  }, () => { void game.completeLesson(target); });
  return <QuizScreen game={game} lesson={definition} title={titleOf(chapter, target)} onExit={backToBoard} onFinish={handleFinish} />;
}

function promptCopy(problem: QuizProblem): string {
  if (problem.kind === "input") return COPY.CP_452;
  return problem.prompt === "kanji" ? COPY.CP_453 : COPY.CP_451;
}

function QuizScreen({ game, lesson, title, onExit, onFinish }: { game: QuizGame; lesson: QuizLesson; title: string; onExit: () => void; onFinish: () => void }) {
  const t = useText();
  const resumeKey = lesson.key;
  const [session, setSession] = useState(() => createSession(lesson, loadResume(resumeKey, lesson.problems.length)));
  const clearRef = useRef<HTMLElement>(null);
  const total = lesson.problems.length;
  const problem = currentProblem(session);

  useEffect(() => {
    if (!session.isCleared) return;
    clearRef.current?.scrollIntoView?.({ block: "nearest" });
    clearRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [session.isCleared]);

  useEffect(() => {
    if (!session.isCleared) saveResume(resumeKey, session.problemIndex);
  }, [resumeKey, session.problemIndex, session.isCleared]);

  const answerMessage = session.message === "wrong" ? MESSAGES.wrongToHints
    : session.message === "correct" ? MESSAGES.correct
      : session.message === "notKana" ? COPY.CP_454
        : session.message === "empty" ? MESSAGES.empty : "";
  // 答えた結果の音（D-90）。何も変わらなかった時（押せない選択肢など）は鳴らさない
  const answer = (next: QuizSession) => {
    if (next === session) return;
    const se = next.isCorrect ? (next.isCleared ? "clear" : "correct") : next.message === "wrong" ? "wrong" : null;
    if (se) playSe(se);
    setSession(next);
  };
  const hintItems = problem.hints.slice(0, session.shownHints);
  const canShowHelp = session.shownHints < problem.hints.length || (problem.kind === "input" && !session.isAnswerShown);
  const shownAnswer = session.isAnswerShown ? t(COPY.CP_456("{答え}")) : "";
  const [answerBefore = "", answerAfter = ""] = shownAnswer.split("{答え}");

  return (
    <main className="lesson">
      <header className="lesson-header">
        <h1 aria-label={t(title)}><Ruby text={title} /></h1>
        <p className="lesson-progress">{t(LESSON_COPY.progress(session.problemIndex + 1, total))}</p>
        {!session.isCleared && <LessonButton text={LESSON_COPY.exit} variant="text" className="lesson-exit" se={null} onClick={onExit} />}
      </header>
      {!session.isCleared && <section className="lesson-card quiz-card" aria-labelledby="quiz-question">
        <p className="quiz-copy">{t(promptCopy(problem))}</p>
        <h2 id="quiz-question" className="quiz-subject">{problem.subject}</h2>
        {problem.kind === "choice" && <div className="quiz-choices">
          {/* 押した音は鳴らさず、結果の音を鳴らす（D-104）。disabled は使わず、間違えた選択肢は打ち消し線で示す（CMP-001） */}
          {problem.choices.map((choice) => {
            const isWrong = session.disabledChoices.includes(choice);
            return <Button key={choice} variant="secondary" se={null} className={`quiz-choice${isWrong ? " is-wrong" : ""}`}
              aria-disabled={isWrong || session.isCorrect || undefined} onClick={() => answer(submitChoice(session, choice))}>{choice}</Button>;
          })}
        </div>}
        {problem.kind === "input" && <form className="lesson-answer quiz-answer" onSubmit={(event) => { event.preventDefault(); answer(submitAnswer(session)); }}>
          <label className="lesson-answer__label" htmlFor="quiz-answer">{t(COPY.CP_454)}</label>
          <input id="quiz-answer" className="lesson-answer__input" lang="ja" autoComplete="off" value={session.answerText} onChange={(event) => setSession((old) => typeAnswer(old, event.target.value))} readOnly={session.isCorrect} />
          {!session.isCorrect && <Button variant="primary" type="submit" se={null}>{t(LESSON_COPY.answerButton)}</Button>}
        </form>}
        <p className="lesson-message" aria-live="polite">{answerMessage ? t(answerMessage) : ""}</p>
        {hintItems.length > 0 && <ol className="quiz-hints">{hintItems.map((hint, index) => <li key={`${index}-${hint}`}>{t(hint)}</li>)}</ol>}
        {session.isAnswerShown && <p className="quiz-answer-reveal">{answerBefore}<span>{problem.answer}</span>{answerAfter}</p>}
        {!session.isCorrect && canShowHelp && <LessonButton text={LESSON_COPY.helpButton} variant="secondary" onClick={() => setSession((old) => pressHelp(old))} />}
        {session.isCorrect && !session.isCleared && <LessonButton text={LESSON_COPY.nextButton} variant="primary" onClick={() => setSession((old) => nextProblem(old))} />}
      </section>}
      {session.isCleared && <LessonClear game={game} total={total} isRepeat={false} onFinish={onFinish} sectionRef={clearRef} />}
    </main>
  );
}
