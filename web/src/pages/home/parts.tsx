// CMP-024 提出物の行、CMP-025 時間割の表、教科の札、枠の読み込み・つながらない時（D-138）
import type { CSSProperties, ReactNode } from "react";
import { Button } from "../../components/Button";
import { Ruby } from "../../components/Ruby";
import { COPY } from "../../copy";
import { SUBJECTS } from "../../data";
import { useText } from "../../grade";
import { dueLabel, focusDay, isLate, isOverdue, jstTime, periodCount } from "./rules";
import type { Load } from "./use-home-data";
import type { Assignment, TimetableDay, TimetableSubjectId } from "./types";

const EXTRA_NAMES: Partial<Record<TimetableSubjectId, string>> = COPY.CP_745;

/** 教科の名前（ふりがなの書き方付き）と色。道徳・総合・学級活動は色なし（HM-26） */
export function subjectInfo(id: TimetableSubjectId): { name: string; color?: string } {
  const subject = SUBJECTS.find((s) => s.id === id);
  return { name: EXTRA_NAMES[id] ?? subject?.name ?? id, color: subject?.color };
}

export function SubjectTag({ id }: { id: TimetableSubjectId }) {
  const { name, color } = subjectInfo(id);
  return (
    <span className={`home-subject${color ? "" : " is-plain"}`} style={color ? ({ "--subject-color": color } as CSSProperties) : undefined}>
      <Ruby text={name} />
    </span>
  );
}

export const weekdayName = (weekday: number): string => COPY.CP_746[weekday - 1] ?? "";

function dueText(dueAt: string, now: string): string {
  const label = dueLabel(dueAt, now);
  if (label.kind === "today") return COPY.CP_720(label.time);
  if (label.kind === "tomorrow") return COPY.CP_721(label.time);
  return COPY.CP_722(label.month, label.day, weekdayName(label.weekday), label.time);
}

type RowProps = {
  assignment: Assignment;
  now: string;
  onSubmit: (a: Assignment) => void;
  onWithdraw?: (a: Assignment) => void;
  onOpenName?: (a: Assignment) => void;
  /** 「出した」の色。PG-006 は secondary（主ボタンは「教科をえらぶ」。D-158、D-248）、PG-007 は primary */
  submitVariant?: "primary" | "secondary";
};

/** CMP-024。まだ / 期限を過ぎた / 出した / おくれて出した */
export function AssignmentRow({ assignment, now, onSubmit, onWithdraw, onOpenName, submitVariant = "primary" }: RowProps) {
  const t = useText();
  const submitted = assignment.submittedAt !== null;
  const overdue = isOverdue(assignment, now);
  const state = submitted ? (isLate(assignment) ? "late" : "done") : overdue ? "overdue" : "todo";
  const name = <Ruby text={assignment.title} />;
  return (
    <li className={`home-row is-${state}`} data-assignment={assignment.id}>
      <div className="home-row__text">
        <p className="home-row__name">
          <SubjectTag id={assignment.subjectId} />
          {onOpenName
            ? <button type="button" className="home-row__link" onClick={() => onOpenName(assignment)}>{name}</button>
            : <span className="home-row__title" tabIndex={-1}>{name}</span>}
        </p>
        <p className="home-row__due">
          {submitted ? (
            <span className="home-row__stamp"><span aria-hidden="true">✿ </span>{t(isLate(assignment) ? COPY.CP_734(jstTime(assignment.submittedAt as string)) : COPY.CP_731(jstTime(assignment.submittedAt as string)))}</span>
          ) : overdue ? (
            <strong className="home-row__overdue">{t(COPY.CP_723)}</strong>
          ) : (
            t(dueText(assignment.dueAt, now))
          )}
        </p>
      </div>
      {!submitted && <Button variant={submitVariant} className="home-row__action" se="enter" aria-label={t(COPY.CP_736(assignment.title))} onClick={() => onSubmit(assignment)}>{t(COPY.CP_730)}</Button>}
      {submitted && onWithdraw && <Button variant="text" className="home-row__action" aria-label={t(COPY.CP_737(assignment.title))} onClick={() => onWithdraw(assignment)}>{t(COPY.CP_732)}</Button>}
    </li>
  );
}

/** 読み込み中・つながらない時の枠の中身。ready の時は children */
export function FrameBody<T>({ load, onRetry, children }: { load: Load<T>; onRetry: () => void; children: (data: T) => ReactNode }) {
  const t = useText();
  if (load.status === "loading") {
    return (
      <div className="home-frame__loading" aria-label={t(COPY.CP_754)}>
        <span /><span /><span />
      </div>
    );
  }
  if (load.status === "error") {
    return (
      <div className="home-frame__error">
        <p>{t(load.kind === "rate" ? COPY.CP_752 : COPY.CP_750)}</p>
        <Button variant="secondary" onClick={onRetry}>{t(COPY.CP_751)}</Button>
      </div>
    );
  }
  return <>{children(load.data)}</>;
}

/** CMP-025。1週間の表。今日（無ければ次の授業の日）の列を「今ここ」の色と札で示す（D-137） */
export function TimetableTable({ days, now, caption }: { days: readonly TimetableDay[]; now: string; caption: string }) {
  const t = useText();
  const focus = focusDay(days, now);
  const rows = Array.from({ length: periodCount(days) }, (_, index) => index + 1);
  const sorted = [...days].sort((left, right) => left.weekday - right.weekday);
  return (
    <div className="home-table-wrap">
    <table className="home-table">
      <caption className="visually-hidden">{t(caption)}</caption>
      <thead>
        <tr>
          <td />
          {sorted.map((day) => {
            const isFocus = focus?.weekday === day.weekday;
            return (
              <th key={day.weekday} scope="col" className={isFocus ? "is-focus" : undefined} aria-current={isFocus && focus?.isToday ? "date" : undefined}>
                <Ruby text={weekdayName(day.weekday)} />
                {isFocus && <span className="home-table__tag">{t(focus?.isToday ? COPY.CP_741 : COPY.CP_742)}</span>}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((period) => (
          <tr key={period}>
            <th scope="row">{period}</th>
            {sorted.map((day) => {
              const slot = day.periods.find((p) => p.period === period);
              const isFocus = focus?.weekday === day.weekday;
              return (
                <td key={day.weekday} className={isFocus ? "is-focus" : undefined}>
                  {slot ? <Ruby text={subjectInfo(slot.subjectId).name} /> : <span className="visually-hidden">{t(COPY.CP_744)}</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
