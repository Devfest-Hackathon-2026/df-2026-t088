import { useEffect, useState } from "react";
import type { SummaryItem } from "../research/api";
import { readSummary } from "./api";
import { CLASS_COPY, PROBLEM_COPY, TODAY_COPY, UNIT_COPY } from "./copy";
import { TeacherNav } from "./TeacherNav";
import { patternsText, problemHref, sortByCount, type Period } from "./StumblesPanel";
import { unitLabel } from "./unit";
import "./StumblesPanel.css";
import "./UnitPage.css";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; items: SummaryItem[] };

// SCR-T10 に戻るアドレス（来たときの期間を残す）
export function classHref(period: Period): string {
  return period === "today" ? "?period=today" : "?";
}

// 単元の問題の一覧（SCR-T11）。その単元（章＋学習）の問題だけを、件数の多い順に出す
export function UnitPage({ chapterId, lessonKey, period = "7days" }: { chapterId: string; lessonKey: string; period?: Period }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    readSummary(period)
      .then((result) => {
        if (!alive || result.scope !== "summary") return;
        const rows = result.items.filter((row) => row.chapterId === chapterId && row.lessonKey === lessonKey);
        setState({ status: "ready", items: sortByCount(rows) });
      })
      .catch(() => {
        if (alive) setState({ status: "error" });
      });
    return () => {
      alive = false;
    };
  }, [chapterId, lessonKey, period]);

  const periodQuery = period === "today" ? "&period=today" : "";

  return (
    <main className="unit-page">
      <TeacherNav current="class" />
      <p className="unit-page__back">
        <a href={classHref(period)}>{PROBLEM_COPY.back}</a>
      </p>
      <h1 className="unit-page__title">{UNIT_COPY.title(unitLabel(chapterId, lessonKey))}</h1>
      <div className="stumbles">
        {state.status === "loading" && <p role="status">{TODAY_COPY.loading}</p>}
        {state.status === "error" && <p role="alert">{TODAY_COPY.connError}</p>}
        {state.status === "ready" && state.items.length === 0 && <p role="status">{UNIT_COPY.empty}</p>}
        {state.status === "ready" && state.items.length > 0 && (
          <div className="stumbles__scroll">
            <table className="stumbles__table">
              <thead>
                <tr>
                  <th scope="col">{CLASS_COPY.colProblem}</th>
                  <th scope="col">{CLASS_COPY.colCount}</th>
                  <th scope="col">{CLASS_COPY.colPatterns}</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((item) => (
                  <tr key={item.problem} className="stumbles__row">
                    <td className="stumbles__problem">
                      <a href={`${problemHref(item)}&chapter=${encodeURIComponent(chapterId)}&from=unit${periodQuery}`}>{item.problem}</a>
                    </td>
                    <td className="stumbles__count">{item.count}</td>
                    <td>{patternsText(item.patterns)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
