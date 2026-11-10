import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/Button";
import { ApiError, readHintEffect, sendAfterHint } from "./api";
import type { HintEffect, HintVersion, NextOutcome, Role } from "./api";
import { RESEARCH_COPY as R } from "./copy";
import { THEME_COPY as T } from "./theme-copy";

const PATTERN = "sum-both" as const;
const BASE_MIX: NextOutcome[] = ["correct", "same", "same", "same", "other"];
const APPROVED_MIX: NextOutcome[] = ["correct", "correct", "correct", "same", "other"];

export function ThemePanel({ role }: { role: Role }) {
  const [effect, setEffect] = useState<HintEffect | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEffect(await readHintEffect(role));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "うまくいきませんでした");
    }
  }, [role]);

  useEffect(() => { void load(); }, [load]);

  const addDummy = async (version: HintVersion, mix: NextOutcome[]) => {
    try {
      for (const next of mix) await sendAfterHint(PATTERN, version, next);
      await load();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "うまくいきませんでした");
    }
  };

  const stageIndex = effect ? T.stageOrder.indexOf(effect.stage) : -1;
  return (
    <section className="theme" aria-labelledby="theme-title">
      <h2 id="theme-title">{T.title}</h2>
      <p><strong>問い：</strong>{T.question}</p>
      <p>{T.how}</p>
      <p className="banner" role="note">{T.honest}</p>

      <h3>{T.stageName}</h3>
      {effect ? (
        <ol className="stages" aria-label={T.stageName}>
          {T.stageOrder.map((stage, index) => (
            <li key={stage} aria-current={index === stageIndex ? "step" : undefined} className={index <= stageIndex ? "stage stage--done" : "stage"}>
              {T.stages[stage]}
            </li>
          ))}
        </ol>
      ) : <p className="note" role="status">{T.waiting}</p>}
      {message && <p className="notice" role="alert">{message}</p>}

      <h3>{T.cellsName}</h3>
      <p className="note">{T.cellsNote}</p>
      {effect && (effect.cells.length === 0 ? <p>{T.cellsEmpty}</p> : (
        <div className="audit__scroll" role="region" aria-label={T.cellsName} tabIndex={0}>
          <table>
            <thead>
              <tr><th scope="col">間違い方</th><th scope="col">ヒント</th><th scope="col">件数</th>
                {(["correct", "same", "other"] as const).map((key) => <th key={key} scope="col">{T.outcomes[key]}</th>)}</tr>
            </thead>
            <tbody>
              {effect.cells.map((cell) => (
                <tr key={`${cell.lessonKey}-${cell.problem}-${cell.pattern}-${cell.hintVersion}`}>
                  <td>{R.patterns[cell.pattern]}</td><td>{T.versions[cell.hintVersion]}</td><td>{cell.count}</td>
                  <td>{cell.correct}</td><td>{cell.same}</td><td>{cell.other}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {effect && <p className="note" role="status">{effect.comparable ? T.comparable : T.notComparable}</p>}
      <Button onClick={() => void load()}>{T.reload}</Button>

      <h3>{T.dummyTitle}</h3>
      <p className="note">{T.dummyNote}</p>
      <div className="actions">
        <Button onClick={() => void addDummy("base", BASE_MIX)}>{T.dummyBase}</Button>
        <Button onClick={() => void addDummy("approved", APPROVED_MIX)}>{T.dummyApproved}</Button>
      </div>
    </section>
  );
}
