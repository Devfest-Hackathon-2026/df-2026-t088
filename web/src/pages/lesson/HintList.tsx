import { Ruby } from "../../components/Ruby";
import { currentProblem } from "../../lesson/session";
import type { LessonSession } from "../../lesson/session";
import { LESSON_COPY } from "../../lesson/wording";

/** 開いた分のヒント */
export function HintList({ session }: { session: LessonSession }) {
  const shown = currentProblem(session).hints.slice(0, session.shownHints);
  if (shown.length === 0) return null;
  return (
    <ol className="lesson-hints" aria-label={LESSON_COPY.hintsName}>
      {shown.map((hint) => <li key={hint}><Ruby text={hint} /></li>)}
    </ol>
  );
}
