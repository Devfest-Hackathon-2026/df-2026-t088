// 提出の状況（SCR-T05、#187）。提出物ごとの n/30、出していない人、おくれて出した人。出していない人が半分より多い時は人数だけ（D-193）。
// 30秒ごとに新しくし、画面が隠れている間は止める（HM-29）。番号だけで出す。名簿は別の作業で作る（#256）
import { useCallback, useEffect, useState } from "react";
import { displayText } from "../ruby-text";
import { DECIDE_COPY, SUBMISSIONS_COPY, TODAY_COPY } from "./copy";
import { TeacherNav } from "./TeacherNav";
import { useApproverKey, setApproverKey } from "./approver-key";
import "./SubmissionsPage.css";

const base = (import.meta.env.VITE_LOOP_API_URL as string | undefined) ?? "";
export const REFRESH_MS = 30_000;

type Row = { id: string; subjectId: string; title: string; dueAt: string; submittedCount: number; notSubmitted: string[]; late: string[] };
type Status = { now: string; classSize: number; assignments: Row[] };
type State = { status: "loading" } | { status: "key-needed" } | { status: "ready"; data: Status; error: boolean };

const JST = 9 * 3_600_000;
const jst = (iso: string) => new Date(Date.parse(iso) + JST);
const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
/** 11/8(日) 8:30 の形 */
export function dueText(iso: string): string {
  const d = jst(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEK[d.getUTCDay()]}) ${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
const clockText = (iso: string) => jst(iso).toISOString().slice(11, 19);

export function SubmissionsPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const approverKey = useApproverKey();

  const load = useCallback(async () => {
    const headers: Record<string, string> = approverKey.trim() ? { "x-approver-key": approverKey } : {};
    try {
      const response = await fetch(`${base}/api/v1/teacher/submissions`, { headers });
      if (response.status === 401) {
        setState({ status: "key-needed" });
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as Status;
      setState({ status: "ready", data, error: false });
    } catch {
      // 前の数を残し、つながらなかったことだけ足す
      setState((current) => (current.status === "ready" ? { ...current, error: true } : { status: "ready", data: { now: "", classSize: 0, assignments: [] }, error: true }));
    }
  }, [approverKey]);

  useEffect(() => {
    void load();
    const tick = () => { if (!document.hidden) void load(); };
    const timer = window.setInterval(tick, REFRESH_MS);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return (
    <main className="teacher-submissions">
      <TeacherNav current="submissions" />
      <h1>{SUBMISSIONS_COPY.title}</h1>
      <p className="teacher-submissions__question">{SUBMISSIONS_COPY.question}</p>

      {state.status === "loading" && <p role="status">{TODAY_COPY.loading}</p>}

      {state.status === "key-needed" && (
        <form className="teacher-submissions__key" onSubmit={(event) => { event.preventDefault(); void load(); }}>
          <p role="status">{DECIDE_COPY.keyNeeded}</p>
          <label htmlFor="submissions-key">{DECIDE_COPY.keyLabel}</label>
          <input id="submissions-key" type="password" autoComplete="off" value={approverKey} onChange={(event) => setApproverKey(event.target.value)} />
          <button type="submit">{SUBMISSIONS_COPY.keyApply}</button>
        </form>
      )}

      {state.status === "ready" && (
        <>
          <div className="teacher-submissions__bar">
            <button type="button" onClick={() => void load()}>{SUBMISSIONS_COPY.refresh}</button>
            {state.data.now && <span>{SUBMISSIONS_COPY.refreshedAt(clockText(state.data.now))}</span>}
          </div>
          {state.error && <p role="alert">{SUBMISSIONS_COPY.connError(state.data.now ? clockText(state.data.now) : "--:--:--")}</p>}
          <div className="teacher-submissions__scroll">
          <table className="teacher-submissions__table">
            <thead>
              <tr>
                <th scope="col">{SUBMISSIONS_COPY.colDue}</th>
                <th scope="col">{SUBMISSIONS_COPY.colTitle}</th>
                <th scope="col">{SUBMISSIONS_COPY.colCount}</th>
                <th scope="col">{SUBMISSIONS_COPY.colMissing}</th>
              </tr>
            </thead>
            <tbody>
              {state.data.assignments.map((row) => (
                <tr key={row.id} data-assignment={row.id}>
                  <td className="teacher-submissions__due">{dueText(row.dueAt)}</td>
                  <th scope="row">{displayText(row.title, null)}</th>
                  <td className="teacher-submissions__count">{row.submittedCount}/{state.data.classSize}</td>
                  <td>
                    {row.notSubmitted.length === 0 ? SUBMISSIONS_COPY.allDone
                      : isMany(row.notSubmitted.length, state.data.classSize) ? (
                        <details className="teacher-submissions__many">
                          <summary>{SUBMISSIONS_COPY.missingCount(row.notSubmitted.length)}</summary>
                          <NameList names={row.notSubmitted} />
                        </details>
                      ) : <NameList names={row.notSubmitted} />}
                    {row.late.length > 0 && <div className="teacher-submissions__late"><strong>{SUBMISSIONS_COPY.late}</strong><NameList names={row.late} /></div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </main>
  );
}

/** 出していない人が学級の半分より多い時は、人数だけを出して番号はたたむ（D-193） */
export const isMany = (count: number, classSize: number) => count * 2 > classSize;

/** 1人ずつ要素に分け、番号や名前の途中で行を折らない（D-193） */
function NameList({ names }: { names: string[] }) {
  return <ul className="teacher-submissions__names">{names.map((name) => <li key={name}>{name}</li>)}</ul>;
}
