import { answerGap } from "../../lesson/answer-gap";
import { FractionAnswer } from "./FractionAnswer";
import { ReduceWalkthrough } from "./ReduceWalkthrough";
import { FractionWalkthrough } from "./FractionWalkthrough";
import { useState, type ReactNode } from "react";
import { LessonButton } from "./LessonButton";
import { ANSWER_MAX_LENGTH } from "../../lesson/judge";
import { startsWithHints } from "../../lesson/problems";
import type { CommonProblem, LessonProblem } from "../../lesson/problems";
import { canAnswer, currentProblem, needsAligned, showsAligned } from "../../lesson/session";
import { alignedExpression, isSolved } from "../../lesson/tiles";
import { afterParts, choiceParts, fractionName, inlineName, LESSON_COPY, MESSAGES, noticeParts } from "../../lesson/wording";
import { Ruby } from "../../components/Ruby";
import { useText } from "../../grade";
import { Button } from "../../components/Button";
import { Equation, EquivalentEquation, FractionText, InlineParts } from "./FractionText";
import type { AlignedSlots } from "./FractionText";
import { AnswerCompare } from "./AnswerCompare";
import { HintList } from "./HintList";
import { NumberWork } from "./NumberWork";
import { NudgeText } from "./NudgeText";
import type { TileLesson } from "./use-tile-lesson";

/** 問題の文。計算は式だけ、ほかはしてほしいことを1文で書く */
function ProblemStatement({ lesson, problem }: { lesson: TileLesson; problem: LessonProblem }) {
  const { session } = lesson;
  const { game, isCorrect, partTexts } = session;
  const slots: AlignedSlots | undefined = needsAligned(session)
    ? { ...alignedExpression(game), texts: partTexts, onChange: lesson.onPartChange }
    : undefined;
  const aligned = showsAligned(session) ? alignedExpression(game) : undefined;

  if (problem.kind === "calculate") {
    return <Equation problem={game.problem} mixed={problem.showMixed} slots={slots} aligned={aligned} answer={isCorrect ? game.problem.answer : undefined} />;
  }
  if (problem.kind === "reduce") {
    return (
      <>
        <p className="lesson-task"><FractionText value={problem.value} /><Ruby text={LESSON_COPY.reduceTask} /></p>
        {(slots || isCorrect) && <Equation problem={game.problem} slots={slots} answer={isCorrect ? game.problem.answer : undefined} />}
      </>
    );
  }
  if (problem.kind === "divide") {
    return <p className="lesson-task"><Ruby text={LESSON_COPY.divideTask(problem.dividend, problem.divisor)} /></p>;
  }
  if (problem.kind === "equivalent") {
    return (
      <>
        <p className="lesson-task"><Ruby text={LESSON_COPY.equivalentTask} /></p>
        <EquivalentEquation problem={game.problem} slots={slots} answer={isCorrect ? game.problem.answer : undefined} />
      </>
    );
  }
  if (problem.kind === "common") {
    return <p className="lesson-task"><FractionText value={problem.left} />{LESSON_COPY.and}<FractionText value={problem.right} /><Ruby text={LESSON_COPY.commonTask} /></p>;
  }
  if (problem.kind === "compare") {
    return <p className="lesson-task"><FractionText value={problem.left} />{LESSON_COPY.and}<FractionText value={problem.right} />、<Ruby text={LESSON_COPY.compareTask} /></p>;
  }
  // 数の問題は NumberWork が出す
  if (problem.kind === "number") return null;
  return (
    <>
      <p className="lesson-task"><Ruby text={LESSON_COPY.estimateTask} /></p>
      <Equation problem={game.problem} answer={isCorrect ? game.problem.answer : undefined} />
    </>
  );
}

function answerLabelOf(problem: LessonProblem): string {
  if (problem.kind === "equivalent") return LESSON_COPY.equivalentLabel;
  return problem.kind === "calculate" && problem.showMixed ? LESSON_COPY.answerLabelMixed : LESSON_COPY.answerLabel;
}

function TextAnswer({ lesson, problem }: { lesson: TileLesson; problem: LessonProblem }) {
  const { session, refs } = lesson;
  const label = answerLabelOf(problem);
  const [splitInput, setSplitInput] = useState(false);
  const canSplit = problem.kind === "calculate" && problem.left.den !== problem.right.den;
  if (canSplit && splitInput) {
    return <>
      <button type="button" className="fraction-walk__toggle" onClick={() => setSplitInput(false)}>1つの欄で入力</button>
      <FractionAnswer label="こたえ" value={session.answerText} onChange={lesson.onAnswerValue}
        inputRef={refs.answerRef} allowMixed disabled={session.isCorrect} />
    </>;
  }
  return (
    <>
      <div className="lesson-fraction-input-label">
        <label className="lesson-answer__label" htmlFor="lesson-answer"><Ruby text={label} /></label>
        {canSplit && !session.isCorrect && <button type="button" className="fraction-walk__toggle"
          onClick={() => setSplitInput(true)}>分子と分母で入力</button>}
      </div>
      <input
        ref={refs.answerRef}
        id="lesson-answer"
        className="lesson-answer__input"
        type="text"
        enterKeyHint="done"
        maxLength={ANSWER_MAX_LENGTH}
        value={session.answerText}
        readOnly={session.isCorrect}
        onChange={lesson.onAnswerChange}
        onClick={lesson.onAnswerClick}
      />
    </>
  );
}

// 分母は書かない。どの分母でそろえるかも本人が考える
function PairAnswer({ lesson, problem }: { lesson: TileLesson; problem: CommonProblem }) {
  const t = useText();
  const { session, refs } = lesson;
  const rows = [problem.left, problem.right] as const;
  return (
    <>
      <p className="lesson-answer__label">{LESSON_COPY.answerLabel}</p>
      {rows.map((value, index) => (
        <label key={fractionName(value)} className="lesson-pair">
          <FractionText value={value} />
          <span>=</span>
          <input
            ref={index === 0 ? refs.answerRef : undefined}
            className="lesson-answer__input"
            type="text"
            enterKeyHint="done"
            aria-label={t(LESSON_COPY.commonLabel(fractionName(value)))}
            maxLength={ANSWER_MAX_LENGTH}
            value={session.partTexts[index as 0 | 1]}
            readOnly={session.isCorrect}
            onChange={lesson.onPartChange(index as 0 | 1)}
          />
        </label>
      ))}
    </>
  );
}

function AnswerForm({ lesson, problem, walkthrough }: { lesson: TileLesson; problem: LessonProblem; walkthrough?: ReactNode }) {
  const t = useText();
  const { session } = lesson;
  const { game, view, isCorrect } = session;
  const answerVariant = view === "work" && isSolved(game) ? "secondary" : "primary";
  // □ を入れる間は □ だけを見る。約分は □ がそのまま答えなので、欄を出さない
  const hidesField = needsAligned(session) || (view === "review" && (problem.kind === "reduce" || problem.kind === "equivalent"));
  const choices = choiceParts(problem);
  const isNudged = lesson.nudge === "help";
  const helpButton = !isCorrect && view === "answer" && (
    <>
      <LessonButton text={LESSON_COPY.helpButton} className={isNudged ? "lesson-quiet-button is-nudged" : "lesson-quiet-button"} onClick={lesson.onHelp} />
      <NudgeText text={isNudged ? LESSON_COPY.nudgeHelp : null} />
    </>
  );

  if (choices.length > 0) {
    return (
      <div className="lesson-answer" role="group" aria-label={LESSON_COPY.answerButton}>
        {!isCorrect && choices.map(({ choice, parts }) => (
          <Button key={choice} className="lesson-choice" se={null} aria-label={t(inlineName(parts))} onClick={() => lesson.onChoice(choice)}><InlineParts parts={parts} /></Button>
        ))}
        {helpButton}
      </div>
    );
  }
  return (
    <form id="lesson-answer-form" className="lesson-answer" autoComplete="off" onSubmit={lesson.onAnswer}>
      {problem.kind === "common" && <PairAnswer lesson={lesson} problem={problem} />}
      {problem.kind !== "common" && !hidesField && <TextAnswer key={session.problemIndex} lesson={lesson} problem={problem} />}
      {/* ボタンは回答欄の下にまとめる。欄に入れてから押す順に上から並べる */}
      {(!isCorrect || helpButton) && (
        <div className="lesson-answer__buttons">
          {!isCorrect && <Button type="submit" variant={answerVariant} se={null}>{LESSON_COPY.answerButton}</Button>}
          {helpButton}
          {walkthrough}
        </div>
      )}
    </form>
  );
}

// 式と答えの欄。主ボタンは1画面に1つなので、タイルが解けた間は「もとの問題にもどる」に譲る
export function ProblemCard({ lesson, support }: { lesson: TileLesson; /** タイルの案内とヒント。正解の一言の下に置く */ support?: ReactNode }) {
  const { session, refs } = lesson;
  const { game, view, isCorrect, isCleared, message, notice } = session;
  const problem = currentProblem(session);
  const after = isCorrect ? afterParts(problem, game, session.answerText) : [];
  const showsHints = view === "answer" && startsWithHints(problem);
  const answerable = canAnswer(session);
  const hasAnswerComparison = Boolean(answerGap(session));
  const walkthrough = !isCorrect &&
    (problem.kind === "common" || (problem.kind === "calculate" && problem.left.den !== problem.right.den))
    ? <FractionWalkthrough key={session.problemIndex} left={problem.left} right={problem.right} />
    : undefined;

  return (
    <section className="lesson-card" ref={refs.cardRef} aria-labelledby="lesson-problem-heading">
      <h2 id="lesson-problem-heading" className="lesson-hidden" tabIndex={-1}>{LESSON_COPY.problemHeading}</h2>
      {problem.kind === "number" ? <NumberWork lesson={lesson} problem={problem} /> : (
        <>
          {/* 767px 以下は、この塊を題の下に固定する（D-238）。768px 以上は何も変わらない */}
          <div className="lesson-problem"><ProblemStatement lesson={lesson} problem={problem} /></div>
          {answerable && <AnswerForm lesson={lesson} problem={problem} walkthrough={hasAnswerComparison ? undefined : walkthrough} />}
        </>
      )}
      <p className="lesson-message" role="status">{message ? <span key={lesson.answerTry} className="lesson-message-text"><Ruby text={MESSAGES[message]} /></span> : ""}</p>
      <AnswerCompare session={session} walkthrough={hasAnswerComparison ? walkthrough : undefined} />
      {after.length > 0 && <p className="lesson-after"><InlineParts parts={after} /></p>}
      {support}
      {problem.kind === "compare" && session.view === "answer" && !isCorrect && session.shownHints > 0 && <div className="fraction-compare" aria-label="1を等分した図" role="group">
        {[problem.left, problem.right].map((fraction, row) => <div className="fraction-compare__row" key={row}>
          <p>{fraction.num}/{fraction.den}：1を{fraction.den}つに分けたうちの{fraction.num}つ分</p>
          <div className="fraction-compare__bar" role="img" aria-label={`1を${fraction.den}等分したうち${fraction.num}つ分`}>
            {Array.from({ length: fraction.den }, (_, i) => <span key={i} className={i < fraction.num ? "is-filled" : ""}>{i + 1}</span>)}
          </div>
        </div>)}
      </div>}
      {!isCorrect && problem.kind === "reduce" && <ReduceWalkthrough key={session.problemIndex} />}
      {!answerable && !hasAnswerComparison && walkthrough}
      {showsHints && <HintList session={session} />}
      {showsHints && notice && <p className="lesson-notice" role="status"><InlineParts parts={noticeParts(notice, game)} /></p>}
      {view === "review" && !isCorrect && <Button className="lesson-tiles-button" onClick={lesson.onReturnToTiles}>{LESSON_COPY.tilesButton}</Button>}
      {isCorrect && !isCleared && <LessonButton text={LESSON_COPY.nextButton} variant="primary" se="enter" className="lesson-next" onClick={lesson.onNext} />}
    </section>
  );
}
