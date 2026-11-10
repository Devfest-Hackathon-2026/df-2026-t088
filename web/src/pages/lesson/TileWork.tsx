import { useRef } from "react";
import { Ruby } from "../../components/Ruby";
import { useText } from "../../grade";
import { currentProblem, isBoardLocked, needsAligned, showsCount } from "../../lesson/session";
import type { LessonSession } from "../../lesson/session";
import { isSolved, rulerCount, stacksOnPress } from "../../lesson/tiles";
import type { TileGame } from "../../lesson/tiles";
import { countLabel, guideParts, LESSON_COPY, noticeParts } from "../../lesson/wording";
import { FractionText, InlineParts } from "./FractionText";
import { HintList } from "./HintList";
import { LessonButton } from "./LessonButton";
import { NudgeText } from "./NudgeText";
import { TileRuler } from "./TileRuler";
import { DragGhost, TileTray } from "./TileTray";
import { useTileDrag } from "./use-tile-drag";
import type { TileDragControls } from "./use-tile-drag";
import type { TileLesson } from "./use-tile-lesson";

function RulerCount({ game }: { game: TileGame }) {
  const counted = rulerCount(game);
  return (
    <p className="lesson-count" role="status">
      {counted && (
        <>
          <FractionText value={{ num: 1, den: counted.den }} />
          <span>{countLabel(counted.count)}</span>
        </>
      )}
    </p>
  );
}

function solvedText(session: LessonSession): string {
  if (currentProblem(session).kind !== "calculate") return LESSON_COPY.solvedChoice;
  return session.game.problem.operator === "-" ? LESSON_COPY.solvedTaken : LESSON_COPY.solved;
}

function reviewGuide(session: LessonSession): string {
  if (needsAligned(session)) return LESSON_COPY.reviewGuide;
  return session.isAlignedChecked ? LESSON_COPY.reviewGuideAnswer : LESSON_COPY.reviewGuideChoice;
}

// 正解の後は、してほしいことが残っていないので案内を出さない
function WorkGuide({ session }: { session: LessonSession }) {
  if (session.isCorrect) return null;
  return (
    <p className="lesson-guide">
      {session.view === "review" ? <Ruby text={reviewGuide(session)} /> : <InlineParts parts={guideParts(session.game)} />}
    </p>
  );
}

/** タイルの案内とヒント。問題のカード（左の列）の下に置く（D-127）。出す物が無い間は何も出さない */
export function TileSupport({ lesson }: { lesson: TileLesson }) {
  const { session } = lesson;
  const hasGuide = !session.isCorrect;
  const hasHints = !isBoardLocked(session) && currentProblem(session).hints.slice(0, session.shownHints).length > 0;
  if (!hasGuide && !hasHints) return null;
  return (
    <div className="lesson-support">
      <WorkGuide session={session} />
      {!isBoardLocked(session) && <HintList session={session} />}
    </div>
  );
}

function WorkTools({ lesson, drag }: { lesson: TileLesson; drag: TileDragControls }) {
  const { session, tiles, refs } = lesson;
  const { game, notice, selectedKey } = session;
  return (
    <>
      <p className="lesson-notice" role="status">{notice && <InlineParts parts={noticeParts(notice, game)} />}</p>
      <TileTray game={game} selectedKey={selectedKey} drag={drag} onSelect={tiles.onSelectPiece} />
      <p className="lesson-note"><Ruby text={LESSON_COPY.trayNote} /></p>
      {/* 767px 以下は、この塊を画面の下に固定する（D-238）。768px 以上は何も変わらない */}
      <div className="lesson-actions">
      <div className="lesson-tools">
        {selectedKey !== null && (
          <LessonButton text={stacksOnPress(game, selectedKey) ? LESSON_COPY.stackButton : LESSON_COPY.placeButton} se={null} onClick={tiles.onPressRuler} />
        )}
        <LessonButton text={LESSON_COPY.hintButton} className={lesson.nudge === "hint" ? "lesson-quiet-button is-nudged" : "lesson-quiet-button"} onClick={tiles.onHint} />
        <LessonButton text={LESSON_COPY.resetButton} onClick={tiles.onClear} />
      </div>
      <NudgeText text={lesson.nudge === "hint" ? LESSON_COPY.nudgeHint : null} />
      {isSolved(game) && (
        <div className="lesson-back-row" ref={refs.backRowRef}>
          <p className="lesson-back-text"><Ruby text={solvedText(session)} /></p>
          <LessonButton text={LESSON_COPY.backButton} variant="primary" onClick={lesson.onBack} />
        </div>
      )}
      </div>
    </>
  );
}

/** タイルで考える所。式にもどった間も、ものさしと枚数は残す */
export function TileWork({ lesson }: { lesson: TileLesson }) {
  const t = useText();
  const { session, tiles, refs } = lesson;
  const { game } = session;
  const rulerRef = useRef<HTMLDivElement>(null);
  const drag = useTileDrag(rulerRef, tiles.onDrop);
  const isLocked = isBoardLocked(session);

  return (
    <section className="lesson-card" ref={refs.workRef} aria-labelledby="lesson-work-heading">
      <h2 id="lesson-work-heading" className="lesson-hidden">{t(LESSON_COPY.workHeading)}</h2>
      <TileRuler
        rulerRef={rulerRef}
        game={game}
        isLocked={isLocked}
        ghost={drag.ghost}
        drag={drag}
        onPress={tiles.onPressTile}
        onTakeOff={tiles.onTakeOff}
        onPressRuler={tiles.onPressRuler}
      />
      {/* まい数は本人が数える。答えた後に、数えた結果として見せる */}
      {showsCount(session) && <RulerCount game={game} />}
      {!isLocked && <WorkTools lesson={lesson} drag={drag} />}
      {drag.ghost && <DragGhost game={game} ghost={drag.ghost} />}
    </section>
  );
}
