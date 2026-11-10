import { Ruby } from "../../components/Ruby";
import { useText } from "../../grade";
import { answerGap } from "../../lesson/answer-gap";
import type { Fraction } from "../../lesson/fraction";
import { currentProblem } from "../../lesson/session";
import type { LessonSession } from "../../lesson/session";
import { compareExpectedParts, LESSON_COPY } from "../../lesson/wording";
import { cssVars } from "./css-vars";
import { FractionText, InlineParts } from "./FractionText";

const valueOf = ({ num, den }: Fraction): number => num / den;

function Marks({ wholes }: { wholes: number }) {
  return (
    <>
      {Array.from({ length: wholes - 1 }, (_unused, index) => (
        <span key={index} className="lesson-ruler-mark" style={cssVars({ at: index + 1, total: wholes })} />
      ))}
    </>
  );
}

/**
 * CMP-020 まちがえた答えの図。問題の大きさと本人の答えを、同じ目盛りの棒で上下に並べる。
 * 問題の棒には式だけを書き、答えの値も、答えの分母の目盛りも書かない（答えをそのまま見せない）
 */
export function AnswerCompare({ session }: { session: LessonSession }) {
  const t = useText();
  const gap = answerGap(session);
  if (!gap) return null;
  const { wholes, isClipped, direction } = gap;
  const expected = valueOf(gap.expected);
  const answer = Math.min(valueOf(gap.answer), wholes);
  const gapStart = Math.min(expected, answer);
  const gapSize = Math.abs(expected - answer);

  return (
    <div className="lesson-compare" role="group" aria-label={t(LESSON_COPY.compareName)}>
      <p className="lesson-compare-title"><Ruby text={LESSON_COPY.compareTitle} /></p>
      <div className="lesson-ruler-labels" aria-hidden="true">
        {Array.from({ length: wholes + 1 }, (_unused, whole) => <span key={whole}>{whole}</span>)}
      </div>
      <p className="lesson-compare-label">
        <Ruby text={LESSON_COPY.compareExpected} />
        <span className="lesson-compare-value"><InlineParts parts={compareExpectedParts(currentProblem(session), session.game)} /></span>
      </p>
      <div className="lesson-compare-track" aria-hidden="true">
        <Marks wholes={wholes} />
        <span className="lesson-compare-bar is-expected" style={cssVars({ start: 0, size: expected, total: wholes })} />
      </div>
      <p className="lesson-compare-label">
        <Ruby text={LESSON_COPY.compareAnswer} />
        <span className="lesson-compare-value"><FractionText value={gap.answer} /></span>
      </p>
      <div className="lesson-compare-track" aria-hidden="true">
        <Marks wholes={wholes} />
        <span className={`lesson-compare-bar is-answer${isClipped ? " is-clipped" : ""}`} style={cssVars({ start: 0, size: answer, total: wholes })} />
        <span className={`lesson-compare-gap is-${direction}`} style={cssVars({ start: gapStart, size: gapSize, total: wholes })} />
        <span className="lesson-compare-guide" style={cssVars({ at: expected, total: wholes })} />
      </div>
      <p className="lesson-compare-text">
        <Ruby text={direction === "short" ? LESSON_COPY.compareShort : LESSON_COPY.compareLong} />
        {isClipped && <>（<Ruby text={LESSON_COPY.compareClipped} />）</>}
      </p>
    </div>
  );
}
