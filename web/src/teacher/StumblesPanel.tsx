import { useEffect, useState } from "react";
import type { SummaryItem } from "../research/api";
import { readSummary } from "./api";
import { CLASS_COPY, PATTERN_LABEL, TODAY_COPY, UNIT_COPY } from "./copy";
import { groupByUnit, unitHref, unitLabel, type UnitRow } from "./unit";
import "./StumblesPanel.css";

export type Period = "today" | "7days";

// 問題の詳細へのアドレス（同じ画面の中の、問題と教材の名前のクエリ）
export function problemHref(item: Pick<SummaryItem, "lessonKey" | "problem">): string {
  return `?lesson=${encodeURIComponent(item.lessonKey)}&problem=${encodeURIComponent(item.problem)}`;
}

// 件数の多い順。同じ件数は、教材の名前と問題の順で並べる（画面を開くたびに順が変わらないように）
export function sortByCount(items: SummaryItem[]): SummaryItem[] {
  return [...items].sort(
    (a, b) => b.count - a.count || a.lessonKey.localeCompare(b.lessonKey) || a.problem.localeCompare(b.problem),
  );
}

// 多い型：件数の多い順に2つまで、残りは「ほか {n}」（n は残った型の数）
export function patternsText(patterns: SummaryItem["patterns"]): string {
  const sorted = [...patterns].sort((a, b) => b.count - a.count);
  const shown = sorted.slice(0, 2).map((entry) => `${PATTERN_LABEL[entry.pattern]} ${entry.count}`);
  const rest = sorted.length - 2;
  return [...shown, ...(rest > 0 ? [CLASS_COPY.otherPatterns(rest)] : [])].join("、");
}

type State = { period: Period; items: UnitRow[] | null; error: boolean };

// 「詰まっている問題」タブの中身（単元ごと）。サーバーの summary を読むだけで、個人は出さない（5 件未満の行はサーバーが外す）。
// つながらないときは前の表を残す。reloadKey が変わると読み直す
export function StumblesPanel({ period, reloadKey }: { period: Period; reloadKey: number }) {
  const [state, setState] = useState<State>({ period, items: null, error: false });

  useEffect(() => {
    let alive = true;
    // 期間が替わったら、前の期間の表は残さない
    setState((prev) => (prev.period === period ? { ...prev, error: false } : { period, items: null, error: false }));
    readSummary(period)
      .then((result) => {
        if (!alive || result.scope !== "summary") return;
        setState({ period, items: groupByUnit(result.items), error: false });
      })
      .catch(() => {
        if (alive) setState((prev) => ({ ...prev, period, error: true }));
      });
    return () => {
      alive = false;
    };
  }, [period, reloadKey]);

  const items = state.period === period ? state.items : null;

  return (
    <div className="stumbles">
      {items === null && !state.error && <p role="status">{TODAY_COPY.loading}</p>}
      {state.error && <p role="alert">{TODAY_COPY.connError}</p>}
      {items !== null && items.length === 0 && (
        <p role="status">{period === "today" ? TODAY_COPY.empty : CLASS_COPY.empty7days}</p>
      )}
      {items !== null && items.length > 0 && (
        <div className="stumbles__scroll">
          <table className="stumbles__table">
            <thead>
              <tr>
                <th scope="col">{UNIT_COPY.colUnit}</th>
                <th scope="col">{CLASS_COPY.colCount}</th>
                <th scope="col">{CLASS_COPY.colPatterns}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.chapterId}/${item.lessonKey}`} className="stumbles__row">
                  <td className="stumbles__problem">
                    <a href={unitHref(item.chapterId, item.lessonKey, period)}>{unitLabel(item.chapterId, item.lessonKey)}</a>
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
  );
}
