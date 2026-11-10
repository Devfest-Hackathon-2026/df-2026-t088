// 時間割（SCR-T08、#196）。1週間の表（行はコマ、列は曜日）を、まとめて保存する。
// 押せない理由（曜日・コマの上限と下限）は、disabled ではなく操作の下に書く。保存に失敗したら表を残す
import { useEffect, useRef, useState } from "react";
import { addDay, addPeriod, normalizeDays, removeDay, removePeriod, rowCount, setSubject, subjectLabel, WEEKDAY_NAMES } from "./admin-model";
import { ADMIN_COPY, ASSIGNMENTS_COPY, TIMETABLE_COPY, TODAY_COPY } from "./copy";
import { AdminApiError, readTimetable, saveTimetable, type TimetableDay } from "./api";
import { TeacherNav } from "./TeacherNav";
import "./AdminPages.css";

type Load = { status: "loading" } | { status: "error"; code: string } | { status: "ready"; subjects: string[] };

const errorCode = (error: unknown) => (error instanceof AdminApiError ? error.code : "NETWORK");
const weekdayName = (index: number) => WEEKDAY_NAMES[index] ?? String(index + 1);

export function TimetablePage() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [saved, setSaved] = useState<TimetableDay[]>([]);
  const [days, setDays] = useState<TimetableDay[]>([]);
  const [problem, setProblem] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savingRef = useRef(false);

  useEffect(() => {
    let alive = true;
    readTimetable()
      .then((result) => {
        if (!alive) return;
        const normalized = normalizeDays(result.days);
        setSaved(normalized);
        setDays(normalized);
        setLoad({ status: "ready", subjects: result.subjects });
      })
      .catch((error: unknown) => {
        if (alive) setLoad({ status: "error", code: errorCode(error) });
      });
    return () => {
      alive = false;
    };
  }, []);

  // 操作の結果：上限・下限に当たったら理由を出し、表は変えない。通ったら理由を消す
  const apply = (result: { days: TimetableDay[]; problem?: string }) => {
    setNotice("");
    setSaveError("");
    setProblem(result.problem ?? "");
    setDays(result.days);
  };

  const save = async () => {
    if (savingRef.current) return; // 保存中は、もう一度押しても送らない（disabled は使わない）
    savingRef.current = true;
    setSaving(true);
    setNotice("");
    setSaveError("");
    try {
      const payload = normalizeDays(days);
      await saveTimetable(payload);
      setSaved(payload);
      setDays(payload);
      setNotice(TIMETABLE_COPY.saved);
    } catch (error) {
      const code = errorCode(error);
      const details = error instanceof AdminApiError ? error.details : [];
      if (code === "ADULT_INVALID_REQUEST") setSaveError(details.some((detail) => detail.reason === "duplicate") ? TIMETABLE_COPY.duplicateDay : ADMIN_COPY.invalidInput);
      else if (code === "LOGIN_REQUIRED") setSaveError(ADMIN_COPY.loginRequired);
      else if (code === "UNAUTHORIZED") setSaveError(ADMIN_COPY.notAuthorized);
      else setSaveError(TIMETABLE_COPY.saveFailed);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const rows = days.length > 0 ? rowCount(days) : 0;

  return (
    <main className="admin-page admin-page--fill">
      <TeacherNav current="timetable" />
      {/* 見出しは読み上げのためだけに残し、説明文は出さない（D-189） */}
      <h1 className="admin-page__title-hidden">{TIMETABLE_COPY.title}</h1>

      {load.status === "loading" && <p role="status">{TODAY_COPY.loading}</p>}
      {load.status === "error" && (
        <p role="alert" className="admin-page__error">
          {load.code === "UNAUTHORIZED" ? ADMIN_COPY.notAuthorized : ASSIGNMENTS_COPY.connError}
        </p>
      )}

      {load.status === "ready" && (
        <>
          <div className="admin-page__bar">
            <button type="button" onClick={() => apply(addDay(days))}>{TIMETABLE_COPY.addDay}</button>
            <button type="button" onClick={() => apply(removeDay(days))}>{TIMETABLE_COPY.removeDay}</button>
            {/* 保存と捨てるは、表を動かしても見える上の行に置く（D-186） */}
            <div className="admin-page__actions admin-page__actions--end">
              <button type="button" className="admin-page__primary" onClick={() => void save()}>{TIMETABLE_COPY.save}</button>
              <button
                type="button"
                onClick={() => {
                  setDays(saved);
                  setProblem("");
                  setSaveError("");
                  setNotice("");
                }}
              >
                {TIMETABLE_COPY.discard}
              </button>
            </div>
          </div>
          {problem && <p role="status" className="admin-page__problem">{problem}</p>}

          <div className="admin-page__scroll admin-page__scroll--fill">
            <table className="admin-page__table">
              <thead>
                <tr>
                  <th scope="col" />
                  {days.map((day, index) => (
                    <th scope="col" key={day.weekday}>{weekdayName(index)}</th>
                  ))}
                </tr>
                <tr>
                  <th scope="row" />
                  {days.map((day, index) => (
                    <td key={day.weekday} className="admin-timetable__controls">
                      <button type="button" aria-label={`${weekdayName(index)} ${TIMETABLE_COPY.addPeriod}`} onClick={() => apply(addPeriod(days, index))}>
                        {TIMETABLE_COPY.addPeriod}
                      </button>
                      <button type="button" aria-label={`${weekdayName(index)} ${TIMETABLE_COPY.removePeriod}`} onClick={() => apply(removePeriod(days, index))}>
                        {TIMETABLE_COPY.removePeriod}
                      </button>
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rows }, (_, periodIndex) => (
                  <tr key={periodIndex}>
                    <th scope="row" className="admin-page__nowrap">{TIMETABLE_COPY.periodLabel(periodIndex + 1)}</th>
                    {days.map((day, dayIndex) => {
                      const period = day.periods[periodIndex];
                      if (!period) return <td key={day.weekday} className="admin-timetable__cell">{TIMETABLE_COPY.empty}</td>;
                      return (
                        <td key={day.weekday}>
                          <select
                            aria-label={`${weekdayName(dayIndex)} ${TIMETABLE_COPY.periodLabel(periodIndex + 1)}`}
                            value={period.subjectId}
                            onChange={(event) => setDays((current) => setSubject(current, dayIndex, periodIndex, event.target.value))}
                          >
                            {load.subjects.map((subjectId) => (
                              <option key={subjectId} value={subjectId}>{subjectLabel(subjectId)}</option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {saving && <p role="status">{ADMIN_COPY.saving}</p>}
          {notice && <p role="status" className="admin-page__notice">{notice}</p>}
          {saveError && <p role="alert" className="admin-page__error">{saveError}</p>}

        </>
      )}
    </main>
  );
}
