import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../components/Button";
import { NAMED_PATTERNS, readStumbles, type ApprovedHint, type NamedPattern, type Suggestion, type SummaryItem } from "../research/api";
import { createProblemSuggestion, readApprovedFor } from "./api";
import { unitLabel } from "./unit";
import { TeacherApproverKey } from "./approver-key";
import { DECIDE_COPY, PATTERN_LABEL, PROBLEM_COPY, TODAY_COPY, UNIT_COPY } from "./copy";
import "./ProblemPage.css";

// 単元の問題の一覧（SCR-T11）から来たときの、戻る先
export type BackTo = { chapterId: string; lessonKey: string; period?: "today" | "7days" };
type Props = { lessonKey: string; problem: string; backTo?: BackTo };

function backHref(backTo: BackTo): string {
  const base = `?view=unit&chapter=${encodeURIComponent(backTo.chapterId)}&lesson=${encodeURIComponent(backTo.lessonKey)}`;
  return backTo.period === "today" ? `${base}&period=today` : base;
}

// 直し方の承認（SCR-T03）へのアドレス
export function decideHref(lessonKey: string, problem: string, pattern: NamedPattern): string {
  return `?lesson=${encodeURIComponent(lessonKey)}&problem=${encodeURIComponent(problem)}&pattern=${pattern}`;
}

type Loaded = {
  item: SummaryItem | undefined;
  approved: Partial<Record<NamedPattern, ApprovedHint[]>>;
  suggestions: Partial<Record<NamedPattern, Suggestion>>;
};
type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: Loaded };

// 問題の詳細（SCR-T02）。件数と型の内訳は summary から、承認の状態は問題と型ごとに読む
export function ProblemPage({ lessonKey, problem, backTo }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState<NamedPattern | null>(null);
  const [failed, setFailed] = useState<NamedPattern | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const result = await readStumbles("teacher", "summary", PROBLEM_COPY.purposeProblem);
        if (result.scope !== "summary") return;
        const item = result.items.find((row) => row.lessonKey === lessonKey && row.problem === problem && (!backTo || row.chapterId === backTo.chapterId));
        const named = (item?.patterns ?? []).map((entry) => entry.pattern).filter((p): p is NamedPattern => p !== "unclassified");
        const approvedEntries = await Promise.all(
          named.map(async (pattern) => [pattern, (await readApprovedFor(lessonKey, problem, pattern)).items] as const),
        );
        if (alive) setState({ status: "ready", data: { item, approved: Object.fromEntries(approvedEntries), suggestions: {} } });
      } catch {
        if (alive) setState({ status: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [lessonKey, problem, backTo?.chapterId]);

  if (state.status === "loading") {
    return <Shell lessonKey={lessonKey} problem={problem} backTo={backTo}><p role="status">{TODAY_COPY.loading}</p></Shell>;
  }
  if (state.status === "error") {
    return <Shell lessonKey={lessonKey} problem={problem} backTo={backTo}><p role="alert">{TODAY_COPY.connError}</p></Shell>;
  }

  const { item, approved, suggestions } = state.data;
  if (!item) {
    return <Shell lessonKey={lessonKey} problem={problem} backTo={backTo}><p role="status">{PROBLEM_COPY.notFound}</p></Shell>;
  }

  const make = async (pattern: NamedPattern) => {
    setBusy(pattern);
    setFailed(null);
    try {
      const suggestion = await createProblemSuggestion(lessonKey, problem, pattern, PROBLEM_COPY.purposeProblem);
      setState({ status: "ready", data: { ...state.data, suggestions: { ...suggestions, [pattern]: suggestion } } });
    } catch {
      setFailed(pattern);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Shell lessonKey={lessonKey} problem={problem} backTo={backTo} count={item.count} unit={unitLabel(item.chapterId, lessonKey)}>
      <p className="teacher-problem__question">{PROBLEM_COPY.question}</p>
      <ul className="teacher-problem__list">
        {item.patterns.map((entry) => {
          const pattern = entry.pattern;
          const named = (NAMED_PATTERNS as string[]).includes(pattern) ? (pattern as NamedPattern) : null;
          const approvedHints = named ? (approved[named] ?? []) : [];
          const suggestion = named ? suggestions[named] : undefined;
          return (
            <li key={pattern} className="teacher-problem__row">
              <p className="teacher-problem__pattern">
                {PATTERN_LABEL[pattern]}：{entry.count} {TODAY_COPY.count}
              </p>
              {approvedHints.length > 0 && <p className="teacher-problem__approved">{PROBLEM_COPY.approved}</p>}
              {named && approvedHints.length === 0 && !suggestion && (
                <Button variant="secondary" onClick={() => void make(named)} aria-busy={busy === named}>
                  {PROBLEM_COPY.makeSuggestion}
                </Button>
              )}
              {named && failed === named && <p role="alert">{PROBLEM_COPY.makeError}</p>}
              {suggestion && (
                <div className="teacher-problem__hint">
                  <p>{suggestion.hint}</p>
                  <p className="teacher-problem__note">{PROBLEM_COPY.suggestedNote}</p>
                  <p>
                    <a href={decideHref(lessonKey, problem, named as NamedPattern)}>{DECIDE_COPY.linkToDecide}</a>
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {item.patterns.length === 0 && <p role="status">{PROBLEM_COPY.empty}</p>}
    </Shell>
  );
}

// 学習は「分数 7マス目」の形で出す。lessonKey（main-6）は先生には読めないため（D-188）。行が見つかる前は問題だけ
function Shell({ problem, backTo, count, unit, children }: Props & { count?: number; unit?: string; children: ReactNode }) {
  return (
    <main className="teacher-problem">
      <div className="teacher-problem__top">
        <p>{backTo ? <a href={backHref(backTo)}>{UNIT_COPY.backToUnit}</a> : <a href="./">{PROBLEM_COPY.back}</a>}</p>
        <TeacherApproverKey />
      </div>
      <h1>{PROBLEM_COPY.title}</h1>
      <p className="teacher-problem__meta">
        {problem}
        {unit !== undefined && ` ・ ${unit}`}
        {count !== undefined && ` ・ ${count} ${TODAY_COPY.count}`}
      </p>
      {children}
    </main>
  );
}
