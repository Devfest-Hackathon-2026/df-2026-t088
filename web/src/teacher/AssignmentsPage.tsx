// 課題の一覧（SCR-T06、#196）。期限の早い順。直す・消す・新しく配る へ行く。
// 消すときは確認パネルを出し、出した人の数を書く（数が読めないときは、その旨を書く）
import { useCallback, useEffect, useState } from "react";
import { displayText } from "../ruby-text";
import { sortByDue, subjectLabel } from "./admin-model";
import { ADMIN_COPY, ASSIGNMENT_FORM_COPY, ASSIGNMENTS_COPY, TIMETABLE_COPY } from "./copy";
import { AdminApiError, listAdminAssignments, readSubmissionCounts, removeAssignment, type AdminAssignment } from "./api";
import { dueText } from "./SubmissionsPage";
import { TeacherNav } from "./TeacherNav";
import "./AdminPages.css";

/** 配った・直した後に、押した場所の近くに出す結果（main.tsx が URL の done と title から読む） */
export type DoneNotice = { kind: "added" | "updated"; title: string };

type Counts = { classSize: number; submitted: Map<string, number> } | null;
type State =
  | { status: "loading" }
  | { status: "error"; code: string }
  | { status: "ready"; items: AdminAssignment[]; counts: Counts; connError: boolean };
type Pending = { id: string; title: string; count: number | null };

const errorCode = (error: unknown) => (error instanceof AdminApiError ? error.code : "NETWORK");

function doneText(done: DoneNotice): string {
  const title = displayText(done.title, null);
  return done.kind === "added" ? ASSIGNMENTS_COPY.added(title) : ASSIGNMENTS_COPY.updated(title);
}

export function AssignmentsPage({ done = null }: { done?: DoneNotice | null }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [notice, setNotice] = useState<string>(() => (done ? doneText(done) : ""));
  const [actionError, setActionError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);

  const load = useCallback(async () => {
    try {
      // 出した数は提出の状況の API から読む。読めないときは「まだ確かめられません」と書く
      const [list, counts] = await Promise.all([listAdminAssignments(), readSubmissionCounts().catch(() => null)]);
      setState({
        status: "ready",
        items: sortByDue(list.assignments),
        counts: counts ? { classSize: counts.classSize, submitted: new Map(counts.assignments.map((row) => [row.id, row.submittedCount])) } : null,
        connError: false,
      });
    } catch (error) {
      // 前の一覧は残し、つながらなかったことだけ足す。ログインが要るときは、その案内
      setState((current) =>
        current.status === "ready" && errorCode(error) !== "UNAUTHORIZED"
          ? { ...current, connError: true }
          : { status: "error", code: errorCode(error) },
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const askRemove = (item: AdminAssignment) => {
    setNotice("");
    setActionError("");
    const count = state.status === "ready" && state.counts ? (state.counts.submitted.get(item.id) ?? 0) : null;
    setPending({ id: item.id, title: displayText(item.title, null), count });
  };

  const confirmRemove = async () => {
    const target = pending;
    setPending(null);
    if (!target) return;
    try {
      const result = await removeAssignment(target.id);
      setNotice(ASSIGNMENTS_COPY.removed(target.title, result.removedSubmissions));
      await load();
    } catch (error) {
      const code = errorCode(error);
      setActionError(code === "ADULT_ASSIGNMENT_NOT_FOUND" ? ASSIGNMENT_FORM_COPY.notFound : code === "LOGIN_REQUIRED" ? ADMIN_COPY.loginRequired : ASSIGNMENTS_COPY.connError);
    }
  };

  return (
    <main className="admin-page">
      <TeacherNav current="assignments" />
      <h1>{ASSIGNMENTS_COPY.title}</h1>
      <div className="admin-page__bar">
        <a className="admin-page__button" href="?view=assignment">{ASSIGNMENTS_COPY.newButton}</a>
      </div>

      {notice && <p role="status" className="admin-page__notice">{notice}</p>}
      {actionError && <p role="alert" className="admin-page__error">{actionError}</p>}

      {state.status === "loading" && <p role="status">{ASSIGNMENTS_COPY.loading}</p>}
      {state.status === "error" && (
        <p role="alert" className="admin-page__error">
          {state.code === "UNAUTHORIZED" ? ADMIN_COPY.notAuthorized : ASSIGNMENTS_COPY.connError}
        </p>
      )}

      {state.status === "ready" && (
        <>
          {state.connError && <p role="alert" className="admin-page__error">{ASSIGNMENTS_COPY.connError}</p>}
          {state.items.length === 0 && <p role="status">{ASSIGNMENTS_COPY.empty}</p>}
          {state.items.length > 0 && (
            <div className="admin-page__scroll">
              <table className="admin-page__table">
                <thead>
                  <tr>
                    <th scope="col">{ASSIGNMENTS_COPY.colDue}</th>
                    <th scope="col">{ASSIGNMENTS_COPY.colSubject}</th>
                    <th scope="col">{ASSIGNMENTS_COPY.colTitle}</th>
                    <th scope="col">{ASSIGNMENTS_COPY.colCount}</th>
                    <th scope="col">{ASSIGNMENTS_COPY.colActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((item) => {
                    const submitted = state.counts ? (state.counts.submitted.get(item.id) ?? 0) : null;
                    return (
                      <tr key={item.id} data-assignment={item.id}>
                        <td className="admin-page__nowrap">{dueText(item.dueAt)}</td>
                        <td>{subjectLabel(item.subjectId)}</td>
                        <th scope="row">
                          <a href="?view=submissions">{displayText(item.title, null)}</a>
                        </th>
                        <td className="admin-page__count">
                          {submitted === null || !state.counts ? TIMETABLE_COPY.empty : `${submitted}/${state.counts.classSize}`}
                        </td>
                        <td>
                          <div className="admin-page__actions">
                            <a className="admin-page__button" href={`?view=assignment&id=${encodeURIComponent(item.id)}`}>{ASSIGNMENTS_COPY.edit}</a>
                            <button type="button" onClick={() => askRemove(item)}>{ASSIGNMENTS_COPY.remove}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {state.items.length > 0 && !state.counts && <p className="admin-form__note">{ASSIGNMENTS_COPY.countUnknown}</p>}
        </>
      )}

      {pending && (
        <div className="admin-page__confirm" role="group" aria-label={ASSIGNMENTS_COPY.remove}>
          {pending.count === null ? <p>{ASSIGNMENTS_COPY.confirmRemoveUnknown(pending.title)}</p> : <p>{ASSIGNMENTS_COPY.confirmRemove(pending.title, pending.count)}</p>}
          <p>{ASSIGNMENTS_COPY.confirmNote}</p>
          <div className="admin-page__actions">
            <button type="button" onClick={() => void confirmRemove()}>{ASSIGNMENTS_COPY.confirmYes}</button>
            <button type="button" onClick={() => setPending(null)}>{ASSIGNMENTS_COPY.confirmNo}</button>
          </div>
        </div>
      )}
    </main>
  );
}
