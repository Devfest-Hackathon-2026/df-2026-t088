import { Button } from "../components/Button";
import type { ApprovedHint } from "./api";
import { LABEL, RESEARCH_COPY as C } from "./copy";

// いまのヒント。ダミーで、本物の学習のヒントではない
const CURRENT_HINTS = ["1/3 と 1/4 の分母をそろえよう", "そろえた分数をたそう"];

export function ChildPreview({ approved, onReload }: { approved: ApprovedHint[]; onReload: () => void }) {
  const after = CURRENT_HINTS.map((hint, index) => approved.find((item) => item.replacesHintIndex === index)?.hint ?? hint);
  const changed = approved.length > 0;
  return (
    <>
      <Button onClick={onReload}>{LABEL.reload}</Button>
      <div className="child" role="group" aria-label={C.childLegend}>
        <p className="child__problem">1/3 + 1/4</p>
        <div className="child__columns">
          <section>
            <h3>{C.hintNow}</h3>
            <ol>{CURRENT_HINTS.map((hint) => <li key={hint}>{hint}</li>)}</ol>
          </section>
          <section>
            <h3>{C.hintAfter}</h3>
            <ol>
              {after.map((hint, index) => (
                <li key={`${index}-${hint}`} className={hint !== CURRENT_HINTS[index] ? "is-changed" : undefined}>
                  {hint}{hint !== CURRENT_HINTS[index] ? C.hintApproved : ""}
                </li>
              ))}
            </ol>
            {!changed && <p className="note">{C.hintNone}</p>}
          </section>
        </div>
      </div>
    </>
  );
}
