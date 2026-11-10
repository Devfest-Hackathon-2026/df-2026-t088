// CMP-031 説明のカード。1問ぶん。図（CMP-033 てこ、CMP-034 月）だけを型で入れ替える（04_components-print.md）
import { useEffect, useRef, useState } from "react";
import type { Ref } from "react";
import { Button } from "../../components/Button";
import { useBgmMuted } from "../../audio/use-bgm";
import { COPY } from "../../copy";
import { SUBJECTS } from "../../data/constants";
import { useText } from "../../grade";
import { LEVER_HINT_BY_PATTERN } from "../../lesson/error-pattern";
import { loadApprovedHints } from "../../lesson/approved-hints";
import { reportPrintLeverWrong } from "../../lesson/stumble-reporter";
import type { ErrorPattern } from "../../lesson/error-pattern";
import { LeverFigure } from "./figures/LeverFigure";
import { MoonFigure } from "./figures/MoonFigure";
import { narrationForStep, narrationSegmentsFor } from "./narration/narration";
import { AVAILABLE_EXPLANATION_LANGUAGES, explanationTemplateFor } from "./locales";
import type { ExplanationLanguage } from "./locales";
import {
  STEP_HOLD_MS,
  STEP_WALK_MS,
  TEMPLATES,
  initialLever,
  initialMoon,
  leverAuto,
  leverBarRatio,
  leverChoices,
  classifyLeverWrongAnswer,
  leverChoose,
  leverProducts,
  leverShift,
  leverTilt,
  moonAuto,
  moonRotate,
  moonSet,
} from "./templates";
import type { LeverState, MoonState } from "./templates";
import type { ExplainProblem, LeverParams } from "./types";
import "./explain.css";

interface ExplainCardProps {
  problem: ExplainProblem;
  /** 撮りなおす。配られた説明（先生が選んだ問題）には撮るものが無いので渡さず、ボタンも出さない */
  onRetake?: () => void;
  /** 配られた説明の id。間違いの記録とヒントの読み出しに付け、サーバーが学級を引く */
  handoutId?: string;
  headingId?: string;
  headingRef?: Ref<HTMLHeadingElement>;
}

type Run = { kind: "lever"; params: LeverParams; state: LeverState } | { kind: "moon"; state: MoonState };
type LeverHint = { text: string; approved: boolean };

function initialRun(problem: ExplainProblem): Run {
  return problem.templateId === "rika-lever"
    ? { kind: "lever", params: problem.params, state: initialLever(problem.params) }
    : { kind: "moon", state: initialMoon() };
}

function stepOf(run: Run): number {
  return run.state.step;
}

function autoRun(run: Run): Run {
  return run.kind === "lever" ? { ...run, state: leverAuto(run.params, run.state) } : { kind: "moon", state: moonAuto(run.state) };
}

/** reduced-motion の時は図が動かないので、動きの長さ（MOT-026）を待たず置き換える（MOT-027） */
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ExplainCard({ problem, onRetake, handoutId, headingId, headingRef }: ExplainCardProps) {
  const t = useText();
  const template = TEMPLATES[problem.templateId];
  const [language, setLanguage] = useState<ExplanationLanguage>("ja");
  const localizedTemplate = explanationTemplateFor(language, problem.templateId);
  const stepCount = localizedTemplate.steps.length;
  const [run, setRun] = useState<Run>(() => initialRun(problem));
  const [playing, setPlaying] = useState(false);
  const [narrateSteps, setNarrateSteps] = useState(false);
  const [voiceReadyStep, setVoiceReadyStep] = useState<number | null>(null);
  const [leverHint, setLeverHint] = useState<LeverHint | null>(null);
  const [muted] = useBgmMuted();
  const firstWrongRecorded = useRef(false);
  const playingAudios = useRef<HTMLAudioElement[]>([]);

  const step = stepOf(run);
  const finished = step >= stepCount;

  // 再生：1 手順 = 動き + 止まる。最後の手が済んだら止める
  useEffect(() => {
    if (!playing) return;
    if (finished) {
      setPlaying(false);
      return;
    }
    if (voiceReadyStep !== step) return;
    const wait = prefersReducedMotion() ? STEP_HOLD_MS : STEP_WALK_MS + STEP_HOLD_MS;
    const id = setTimeout(() => setRun((current) => autoRun(current)), wait);
    return () => clearTimeout(id);
  }, [playing, run, finished, step, voiceReadyStep]);

  // 音声が無い・再生を許可されない場合は、待たずに動きを続ける。
  useEffect(() => {
    if (!narrateSteps || finished) return;
    let cancelled = false;
    const ids = narrationForStep(problem, step, language);
    const narrationSegments = narrationSegmentsFor(language);
    const finish = () => { if (!cancelled) setVoiceReadyStep(step); };
    if (muted || ids.length === 0) {
      finish();
      return;
    }

    const playAt = (index: number) => {
      if (cancelled) return;
      if (index >= ids.length) { finish(); return; }
      const textId = ids[index];
      if (!narrationSegments[textId]) { finish(); return; }
      const languageDirectory = language === "ja" ? "" : `${language}/`;
      const audio = new Audio(`${import.meta.env.BASE_URL}narration/${languageDirectory}${textId}.mp3`);
      playingAudios.current.push(audio);
      audio.onended = () => playAt(index + 1);
      audio.onerror = finish;
      try {
        void audio.play().catch(finish);
      } catch {
        finish();
      }
    };

    playAt(0);
    return () => {
      cancelled = true;
      playingAudios.current.forEach((audio) => {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
      });
      playingAudios.current = [];
    };
  }, [narrateSteps, finished, problem, step, muted]);

  // 図の操作。押すと再生は止まる（MOT-027）
  const operate = (next: (current: Run) => Run) => {
    const nextRun = next(run);
    const nextStep = stepOf(nextRun);
    setPlaying(false);
    setNarrateSteps(nextStep > step && nextStep < stepCount);
    if (nextStep !== step) setVoiceReadyStep(null);
    setRun(nextRun);
  };

  const onPlayButton = () => {
    if (playing) {
      setPlaying(false);
      setNarrateSteps(false);
    } else if (finished) {
      setRun(initialRun(problem));
      setVoiceReadyStep(null);
      setNarrateSteps(true);
      setPlaying(true);
    } else {
      setVoiceReadyStep(null);
      setNarrateSteps(true);
      setPlaying(true);
    }
  };

  const subject = SUBJECTS.find((s) => s.id === template.subject);
  const stepText = localizedTemplate.steps[Math.min(step, stepCount - 1)];
  const note = noteOf(run);

  const chooseLever = (current: Extract<Run, { kind: "lever" }>, guess: number) => {
    if (current.state.step === 0 && guess !== current.params.left.g * current.params.left.pos / current.params.right.pos && !firstWrongRecorded.current) {
      firstWrongRecorded.current = true;
      const pattern: ErrorPattern = classifyLeverWrongAnswer(current.params, guess);
      const ruleHint = pattern === "unclassified" ? undefined : LEVER_HINT_BY_PATTERN[pattern];
      if (ruleHint) setLeverHint({ text: ruleHint, approved: false });
      const target = reportPrintLeverWrong(current.params, guess, handoutId);
      if (target && ruleHint) {
        void loadApprovedHints(target).then((hints) => {
          const approved = hints[0];
          if (approved) setLeverHint({ text: approved.hint, approved: true });
        });
      }
    }
    operate((runNow) => runNow.kind === "lever" ? { ...runNow, state: leverChoose(runNow.params, runNow.state, guess) } : runNow);
  };

  return (
    <article className="explain" aria-labelledby={headingId}>
      <div className="explain__head">
        {subject && <span className="explain__subject" style={{ background: subject.color }}>{t(subject.name)}</span>}
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="explain__title">{t(localizedTemplate.title)}</h2>
        <label className="explain__language">
          説明の言語
          <select aria-label="説明の言語" value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}>
            {AVAILABLE_EXPLANATION_LANGUAGES.map((locale) => <option key={locale.code} value={locale.code}>{locale.label}</option>)}
          </select>
        </label>
        {problem.approved && <span className="explain__approved">{t(COPY.CP_889)}</span>}
      </div>

      <section className="explain__problem">
        <p className="explain__problem-label">{t(COPY.CP_890)}</p>
        <div className="explain__problem-box" tabIndex={0}>
          <p>{problem.questionText}</p>
        </div>
      </section>

      <div className="explain__steps">
        <div role="status" className="explain__status">
          <p className="explain__step-text">{t(stepText)}</p>
          {note && <p className="explain__note">{t(note)}</p>}
        </div>
        <p className="explain__dots">
          <span aria-hidden="true">
            {localizedTemplate.steps.map((_, i) => (
              <span key={i} className={`explain__dot${i < step ? " is-done" : i === step ? " is-now" : ""}`}>{i < step ? "✓" : i === step ? "●" : "○"}</span>
            ))}
          </span>
          <span>{t(COPY.CP_891(Math.min(step + 1, stepCount), stepCount))}</span>
        </p>
      </div>

      <div className="explain__work">
        <div className="explain__figure">
          {run.kind === "lever" ? <LeverView run={run} /> : <MoonFigure angle={run.state.angle} onDrag={(angle) => operate((c) => (c.kind === "moon" ? { kind: "moon", state: moonSet(c.state, angle) } : c))} />}
        </div>
        {run.kind === "lever" && <LeverReading run={run} />}
        <div className="explain__controls">
          {run.kind === "lever" && step === 0 && (
            <>
              <span className="explain__choice-label">{t(COPY.CP_825(run.params.right.pos))}</span>
              {leverChoices(run.params).map((g) => (
                <Button key={g} variant="secondary" onClick={() => run.kind === "lever" && chooseLever(run, g)}>
                  {t(COPY.CP_831(g))}
                </Button>
              ))}
            </>
          )}
          {run.kind === "lever" && step === 1 && (
            <Button variant="secondary" onClick={() => operate((c) => (c.kind === "lever" ? { ...c, state: leverShift(c.state) } : c))}>{t(COPY.CP_826)}</Button>
          )}
          {run.kind === "moon" && (
            <>
              <Button variant="secondary" onClick={() => operate((c) => (c.kind === "moon" ? { kind: "moon", state: moonRotate(c.state, 90) } : c))}>{t(COPY.CP_845)}</Button>
              <Button variant="secondary" onClick={() => operate((c) => (c.kind === "moon" ? { kind: "moon", state: moonRotate(c.state, 45) } : c))}>{t(COPY.CP_846)}</Button>
            </>
          )}
          <Button variant="secondary" className="explain__play" onClick={onPlayButton}>
            {playing ? t(COPY.CP_893) : finished ? t(COPY.CP_894) : (<><span aria-hidden="true">▶ </span>{t(COPY.CP_892)}</>)}
          </Button>
        </div>
      </div>

      {finished && (
        <section className="explain__conclusion">
          <h3>{t(COPY.CP_897)}</h3>
          <p>{t(localizedTemplate.conclusion)}</p>
        </section>
      )}
      {leverHint && step === 0 && (
        <section className="explain__hint" aria-live="polite">
          {leverHint.approved && <p className="explain__approved-hint">先生が選んだヒント</p>}
          <p>{t(leverHint.text)}</p>
        </section>
      )}
      {onRetake && (
        <div className="explain__retake">
          <Button variant="text" onClick={onRetake}>{t(COPY.CP_871)}</Button>
        </div>
      )}
    </article>
  );
}

/** 手順の文の下の一言。てこは合わない操作の後、月は満月・新月の位置にいる間 */
function noteOf(run: Run): string | undefined {
  if (run.kind === "lever") {
    return run.state.note === "light" ? COPY.CP_823 : run.state.note === "heavy" ? COPY.CP_824 : undefined;
  }
  return run.state.angle === 180 ? COPY.CP_852 : run.state.angle === 0 ? COPY.CP_853 : undefined;
}

function LeverView({ run }: { run: Extract<Run, { kind: "lever" }> }) {
  return <LeverFigure left={run.params.left} rightPos={run.state.rightPos} rightG={run.state.rightG} tilt={leverTilt(run.params, run.state)} />;
}

/** 左右の「重さ × めもり」の棒と式。棒は transform の拡大で動かす */
function LeverReading({ run }: { run: Extract<Run, { kind: "lever" }> }) {
  const t = useText();
  const { left, right } = leverProducts(run.params, run.state);
  const rows = [
    { side: "left" as const, label: COPY.CP_828.left, product: left, text: COPY.CP_829(run.params.left.g, run.params.left.pos) },
    { side: "right" as const, label: COPY.CP_828.right, product: right, text: COPY.CP_829(run.state.rightG, run.state.rightPos) },
  ];
  return (
    <div className="explain__reading">
      {rows.map((row) => (
        <div key={row.side} className="explain__reading-row">
          <span className="explain__reading-side">{t(row.label)}</span>
          <span className="explain__bar" aria-hidden="true">
            <span className="explain__bar-fill" style={{ transform: `scaleX(${leverBarRatio(row.product, left)})` }} />
          </span>
          <span className="explain__reading-text">{row.text}</span>
        </div>
      ))}
    </div>
  );
}
