import { useEffect, useState } from "react";
import { ApiError, decideSuggestion, type NamedPattern, type Suggestion } from "../research/api";
import { createProblemSuggestion } from "./api";
import { DECIDE_COPY, PATTERN_LABEL, PROBLEM_COPY, TODAY_COPY } from "./copy";
import { useApproverKey, setApproverKey } from "./approver-key";
import "./ProblemPage.css";

type Props = { lessonKey: string; problem: string; pattern: NamedPattern };
type Decision = "approved" | "rejected";
type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "decided-before" }
  | { status: "ready"; suggestion: Suggestion }
  | { status: "done"; decision: Decision };

const REASON_MAX = 100;

// 直し方の承認（SCR-T03）。承認と断るだけ（取り消しは契約の変更の後）。理由は必須
export function DecidePage({ lessonKey, problem, pattern }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [reason, setReason] = useState("");
  const [needReason, setNeedReason] = useState(false);
  const [keyNeeded, setKeyNeeded] = useState(false);
  const approverKey = useApproverKey();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  // 同じ問題と型に未決の提案があれば、サーバーはそれを返す（作り直さない）
  useEffect(() => {
    let alive = true;
    createProblemSuggestion(lessonKey, problem, pattern, DECIDE_COPY.purposeDecide)
      .then((suggestion) => {
        if (!alive) return;
        setState(suggestion.status === "pending" ? { status: "ready", suggestion } : { status: "decided-before" });
      })
      .catch(() => {
        if (alive) setState({ status: "error" });
      });
    return () => {
      alive = false;
    };
  }, [lessonKey, problem, pattern]);

  const decide = async (decision: Decision) => {
    if (state.status !== "ready") return;
    if (!reason.trim()) {
      setNeedReason(true);
      return;
    }
    setNeedReason(false);
    setFailed(false);
    setBusy(true);
    try {
      await decideSuggestion(state.suggestion.id, "teacher", decision, reason.trim(), approverKey);
      setState({ status: "done", decision });
    } catch (error) {
      if (error instanceof ApiError && error.code === "UNAUTHORIZED") setKeyNeeded(true);
      else if (error instanceof ApiError && error.code === "ALREADY_DECIDED") setState({ status: "decided-before" });
      else setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="teacher-problem">
      <p>
        <a href={`?lesson=${encodeURIComponent(lessonKey)}&problem=${encodeURIComponent(problem)}`}>{DECIDE_COPY.back}</a>
      </p>
      <h1>{DECIDE_COPY.title}</h1>
      <p className="teacher-problem__meta">
        {problem} ・ {PROBLEM_COPY.lessonName}：{lessonKey} ・ {PATTERN_LABEL[pattern]}
      </p>

      {state.status === "loading" && <p role="status">{TODAY_COPY.loading}</p>}
      {state.status === "error" && <p role="alert">{TODAY_COPY.connError}</p>}
      {state.status === "decided-before" && <p role="status">{DECIDE_COPY.alreadyDecided}</p>}

      {state.status === "ready" && (
        <section aria-label={DECIDE_COPY.title}>
          <p className="teacher-problem__question">{DECIDE_COPY.question}</p>
          <div className="teacher-problem__hint">
            <p>{state.suggestion.hint}</p>
          </div>

          <label className="teacher-decide__label" htmlFor="decide-reason">
            {DECIDE_COPY.reasonLabel}
          </label>
          <textarea
            id="decide-reason"
            className="teacher-decide__reason"
            value={reason}
            maxLength={REASON_MAX}
            rows={3}
            onChange={(event) => setReason(event.target.value)}
          />
          {needReason && <p role="status" className="teacher-decide__need">{DECIDE_COPY.needReason}</p>}

          {keyNeeded && (
            <div className="teacher-decide__key">
              <p role="status">{DECIDE_COPY.keyNeeded}</p>
              <label className="teacher-decide__label" htmlFor="decide-key">
                {DECIDE_COPY.keyLabel}
              </label>
              <input id="decide-key" type="password" autoComplete="off" value={approverKey} onChange={(event) => setApproverKey(event.target.value)} />
            </div>
          )}

          <div className="teacher-decide__actions">
            <button type="button" className="teacher-decide__button" aria-busy={busy} onClick={() => void decide("approved")}>
              {DECIDE_COPY.approve}
            </button>
            <button type="button" className="teacher-decide__button" aria-busy={busy} onClick={() => void decide("rejected")}>
              {DECIDE_COPY.reject}
            </button>
          </div>
          {failed && <p role="alert">{DECIDE_COPY.failed}</p>}
        </section>
      )}

      {state.status === "done" && (
        <p role="status" className="teacher-problem__approved">
          {state.decision === "approved" ? DECIDE_COPY.approvedDone : DECIDE_COPY.rejectedDone}
        </p>
      )}
    </main>
  );
}
