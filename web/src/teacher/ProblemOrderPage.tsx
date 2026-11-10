import { useState } from "react";
import { practiceHash, practicePlans } from "../lesson/practice-link";
import type { LessonProblem } from "../lesson/problems";
import { inlineName, LESSON_COPY, numberExpressionParts, numberTaskParts } from "../lesson/wording";
import { displayText } from "../ruby-text";
import { PRACTICE_PATH } from "../routing";
import { PROBLEM_ORDER_COPY as COPY } from "./copy";
import { TeacherNav } from "./TeacherNav";
import "./AdminPages.css";

const PLANS = practicePlans();
type Plan = (typeof PLANS)[number];

function problemText(problem: LessonProblem): string {
  const plain = (text: string) => displayText(text, null);
  const fraction = ({ num, den }: { num: number; den: number }) => `${num}/${den}`;
  switch (problem.kind) {
    case "calculate": return `${fraction(problem.left)} ${problem.operator} ${fraction(problem.right)}`;
    case "estimate": return `${fraction(problem.left)} ${problem.operator} ${fraction(problem.right)} / ${fraction(problem.threshold)}`;
    case "divide": return `${problem.dividend} ÷ ${problem.divisor}`;
    case "equivalent": return `${fraction(problem.value)} = □/${problem.target}`;
    case "reduce": return plain(`${fraction(problem.value)}${LESSON_COPY.reduceTask}`);
    case "common": return plain(`${fraction(problem.left)} と ${fraction(problem.right)}${LESSON_COPY.commonTask}`);
    case "compare": return plain(`${fraction(problem.left)} と ${fraction(problem.right)}、${LESSON_COPY.compareTask}`);
    case "number": {
      const { topic } = problem;
      if (topic.t === "intToFraction") return `${topic.n} = □/${topic.den}`;
      const parts = [...numberTaskParts(problem), " ", ...numberExpressionParts(problem, false)];
      if (topic.t === "pickRule" || topic.t === "tableBlank") {
        parts.push(` (${topic.table.map(({ x, y }) => `${x} → ${y ?? "□"}`).join(", ")})`);
      }
      return plain(inlineName(parts).trim());
    }
  }
}

function ProblemOrderEditor({ plan }: { plan: Plan }) {
  const [problems, setProblems] = useState(() => plan.lesson.problems.flatMap((problem) =>
    problem.id ? [{ id: problem.id, text: problemText(problem) }] : []));
  const [copyResult, setCopyResult] = useState<{ url: string; copied: boolean }>();
  const url = new URL(PRACTICE_PATH, window.location.origin);
  url.hash = practiceHash(plan.id, problems.map(({ id }) => id));
  const href = url.href;

  function move(index: number, offset: -1 | 1) {
    const next = index + offset;
    if (next < 0 || next >= problems.length) return;
    const ordered = [...problems];
    [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    setProblems(ordered);
    setCopyResult(undefined);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(href);
      setCopyResult({ url: href, copied: true });
    } catch {
      setCopyResult({ url: href, copied: false });
    }
  }

  return (
    <>
      <div className="admin-page__scroll admin-page__scroll--fill">
        <table className="admin-page__table">
          <thead><tr><th scope="col">{COPY.problem}</th><th scope="col">{COPY.order}</th></tr></thead>
          <tbody>
            {problems.map(({ id, text }, index) => (
              <tr key={id}>
                <th scope="row">{index + 1}. {text}</th>
                <td><div className="admin-page__actions">
                  <button type="button" aria-label={COPY.move(index + 1, COPY.up)} aria-disabled={index === 0} onClick={() => move(index, -1)}>{COPY.up}</button>
                  <button type="button" aria-label={COPY.move(index + 1, COPY.down)} aria-disabled={index === problems.length - 1} onClick={() => move(index, 1)}>{COPY.down}</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="admin-page__bar">
        <label htmlFor="practice-link">{COPY.link}</label>
        <input id="practice-link" readOnly value={href} onFocus={(event) => event.currentTarget.select()} />
        <button type="button" className="admin-page__primary" onClick={() => void copyLink()}>{COPY.copy}</button>
        <a className="admin-page__button" href={href}>{COPY.open}</a>
      </div>
      {copyResult?.url === href && (copyResult.copied
        ? <p role="status" className="admin-page__notice">{COPY.copied}</p>
        : <p role="alert" className="admin-page__error">{COPY.copyError}</p>)}
    </>
  );
}

export function ProblemOrderPage() {
  const [planId, setPlanId] = useState(PLANS[0]?.id ?? "");
  const plan = PLANS.find(({ id }) => id === planId);
  return (
    <main className="admin-page admin-page--fill problem-order">
      <TeacherNav current="problem-order" />
      <h1>{COPY.title}</h1>
      <p>{COPY.intro}</p>
      <div className="admin-page__bar">
        <label htmlFor="practice-plan">{COPY.lesson}</label>
        <select id="practice-plan" value={planId} onChange={(event) => setPlanId(event.currentTarget.value)}>
          {PLANS.map(({ id, chapter, title }) => (
            <option key={id} value={id}>{displayText(chapter.title, null)} / {displayText(title, null)}</option>
          ))}
        </select>
      </div>
      {plan && <ProblemOrderEditor key={planId} plan={plan} />}
    </main>
  );
}
