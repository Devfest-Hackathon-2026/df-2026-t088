import { useState } from "react";
import type { StudioLesson, StudioStrategy } from "./lesson-ir";
import { StudioPreview } from "./StudioPreview";
import { toLesson } from "./to-lesson";

export type TournamentChecks = {
  structure: boolean;
  arithmetic: boolean;
  answerLeak: boolean;
  hintWording: boolean;
};

export type TournamentAlternative = {
  strategy: StudioStrategy;
  lesson?: StudioLesson;
  validation: { ok: true } | { ok: false; issues: string[] };
  checks: TournamentChecks;
  elapsedMs: number;
  source: "gemini" | "mock";
  model: string;
};

export interface TournamentProps {
  alternatives: readonly [TournamentAlternative, TournamentAlternative, TournamentAlternative];
  onSelect: (alternative: TournamentAlternative) => void;
  /** 見本の案があるときの注意の文。先生の画面では、研究用の言葉でない文に替える */
  mockNote?: string;
}

const STRATEGY_LABELS: Record<StudioStrategy, string> = {
  visual: "見える形で考える案",
  numeric: "数で考える案",
  misconception: "まちがいから考える案",
};

const CHECK_LABELS: readonly [keyof TournamentChecks | "elapsedMs", string][] = [
  ["structure", "形"],
  ["arithmetic", "数の正しさ"],
  ["answerLeak", "答えの漏れ"],
  ["hintWording", "ヒントの文"],
  ["elapsedMs", "生成の時間"],
];

const RATINGS = ["1（見直したい）", "2（よい）", "3（とてもよい）"] as const;

/** 教材まるごとの3案を比較し、検査を通った案を親画面へ渡す */
export function Tournament({ alternatives, onSelect, mockNote }: TournamentProps) {
  const previewLessons = alternatives.flatMap((alternative) => alternative.lesson
    ? [{ label: STRATEGY_LABELS[alternative.strategy], lesson: toLesson(alternative.lesson) }]
    : []);

  return (
    <section aria-label="教え方の3案を比べる" style={{ display: "grid", gap: "var(--space-3)" }}>
      <h2>教え方の3案を比べる</h2>
      <div aria-label="教材のプレビュー">
        <StudioPreview lessons={previewLessons} />
        {alternatives.some((alternative) => !alternative.lesson) && (
          <p>教材の形を確認できない案は、プレビューできません。</p>
        )}
      </div>

      <AutomatedComparison alternatives={alternatives} {...(mockNote ? { mockNote } : {})} />
      <TeacherEvaluation alternatives={alternatives} />

      <section aria-labelledby="tournament-effect-heading">
        <h3 id="tournament-effect-heading">学習の効果</h3>
        <p>学習の効果：未計測</p>
        <p>AIの自己評価は使っていません。</p>
      </section>

      <SelectAlternative alternatives={alternatives} onSelect={onSelect} />
    </section>
  );
}

function AutomatedComparison({ alternatives, mockNote = "mock（本物の Gemini ではない）" }: Pick<TournamentProps, "alternatives" | "mockNote">) {
  return (
    <section aria-labelledby="tournament-checks-heading">
      <h3 id="tournament-checks-heading">自動の検査</h3>
      <p>決まったプログラムで形や内容を確認します。</p>
      <div style={{ overflowX: "auto" }}>
        <table aria-label="3案の比較">
          <thead>
            <tr><th scope="col">検査項目</th>{alternatives.map((alternative) => <th scope="col" key={alternative.strategy}>{STRATEGY_LABELS[alternative.strategy]}</th>)}</tr>
          </thead>
          <tbody>
            {CHECK_LABELS.map(([key, label]) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                {alternatives.map((alternative) => <td key={alternative.strategy}>{key === "elapsedMs" ? `${alternative.elapsedMs} ms` : alternative.checks[key] ? "通過" : "要確認"}</td>)}
              </tr>
            ))}
            <tr><th scope="row">総合結果</th>{alternatives.map((alternative) => <td key={alternative.strategy}>{alternative.validation.ok ? "検査に通りました" : "検査に落ちました"}</td>)}</tr>
            <tr><th scope="row">検査の理由</th>{alternatives.map((alternative) => <td key={alternative.strategy}>{alternative.validation.ok ? "なし" : <ul>{alternative.validation.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}</td>)}</tr>
          </tbody>
        </table>
      </div>
      {alternatives.some((alternative) => alternative.source === "mock") && <p>{mockNote}</p>}
    </section>
  );
}

function TeacherEvaluation({ alternatives }: Pick<TournamentProps, "alternatives">) {
  const [ratings, setRatings] = useState<Partial<Record<StudioStrategy, string>>>({});
  const [comments, setComments] = useState<Partial<Record<StudioStrategy, string>>>({});
  return (
    <section aria-labelledby="tournament-teacher-heading">
      <h3 id="tournament-teacher-heading">先生の評価</h3>
      <p>先生が3段階とひとことで記録します。</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "var(--space-2)" }}>
        {alternatives.map((alternative) => (
          <fieldset key={alternative.strategy}>
            <legend>{STRATEGY_LABELS[alternative.strategy]}</legend>
            <label>評価
              <select aria-label={`${STRATEGY_LABELS[alternative.strategy]}の評価`} value={ratings[alternative.strategy] ?? ""} onChange={(event) => setRatings((current) => ({ ...current, [alternative.strategy]: event.target.value }))}>
                <option value="">選んでください</option>
                {RATINGS.map((rating) => <option key={rating} value={rating}>{rating}</option>)}
              </select>
            </label>
            <label>ひとこと
              <input aria-label={`${STRATEGY_LABELS[alternative.strategy]}へのひとこと`} value={comments[alternative.strategy] ?? ""} onChange={(event) => setComments((current) => ({ ...current, [alternative.strategy]: event.target.value }))} />
            </label>
          </fieldset>
        ))}
      </div>
    </section>
  );
}

function SelectAlternative({ alternatives, onSelect }: TournamentProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<StudioStrategy>();
  return (
    <section aria-label="選ぶ案">
      {alternatives.map((alternative) => {
        const label = STRATEGY_LABELS[alternative.strategy];
        const canSelect = alternative.validation.ok && Boolean(alternative.lesson);
        return <button key={alternative.strategy} type="button" disabled={!canSelect} aria-label={canSelect ? `${label}を選ぶ` : "検査に落ちたため選べません"} onClick={() => { setSelectedStrategy(alternative.strategy); onSelect(alternative); }}>
          {selectedStrategy === alternative.strategy ? "選んだ案" : canSelect ? `${label}を選ぶ` : "検査に落ちたため選べません"}
        </button>;
      })}
    </section>
  );
}
