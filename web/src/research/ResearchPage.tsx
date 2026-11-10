import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../components/Button";
import { ALL_PATTERNS, NAMED_PATTERNS } from "./api";
import type { ErrorPattern, NamedPattern, ReadResult, RegionSummaryItem } from "./api";
import { LABEL, RESEARCH_COPY as C, STEPS } from "./copy";
import type { Loop, Notice } from "./use-loop";
import { STEP, useLoop } from "./use-loop";
import { AuditTable } from "./AuditTable";
import { ChildPreview } from "./ChildPreview";
import { StepNotice } from "./StepNotice";
import { ThemePanel } from "./ThemePanel";
import { THEME_COPY as T } from "./theme-copy";
import { ViewingTierSelector } from "./ViewingTierSelector";
import { StudioPanel } from "../studio/StudioPanel";
import "./research.css";

function Step({ index, notice, children }: { index: number; notice: Notice | null; children: ReactNode }) {
  const step = STEPS[index];
  if (!step) return null;
  return (
    <li className="step">
      <h2 className="step__title"><span className="step__no">{index + 1}</span>{step.title}</h2>
      <p className="step__responsible"><strong>{C.stepResponsible}：</strong>{step.responsible}</p>
      <p className="step__note">{step.note}</p>
      {children}
      <StepNotice notice={notice} step={index} />
    </li>
  );
}

function ReadView({ result }: { result: ReadResult | null }) {
  if (!result || result.items.length === 0) return null;
  if (result.scope === "summary") {
    return (
      <ul className="result" aria-label="集計">
        {result.items.map((item) => (
          <li key={`${item.lessonKey}-${item.problem}`}>
            {item.problem}（{item.lessonKey}）：{item.count} 件
            <span className="note">　{C.patternBreakdown}</span>
            <ul>
              {item.patterns.map((entry) => <li key={entry.pattern}>{C.patterns[entry.pattern]}：{entry.count} 件</li>)}
            </ul>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="result" aria-label="記録">
      {result.items.map((item, index) => (
        <li key={index}>{item.occurredOn}　{item.problem}　見たヒント {item.hintsShown} 個　（{item.source}）</li>
      ))}
    </ul>
  );
}

function RegionView({ items }: { items: RegionSummaryItem[] | null }) {
  if (!items?.length) return null;
  return (
    <section className="result region-result" aria-label="ほかの学校では">
      <h3>ほかの学校では</h3>
      <p className="note">見本のデータ</p>
      <div className="audit__scroll" tabIndex={0} role="region" aria-label="ほかの学校ではの表">
        <table aria-label="ほかの学校では">
          <thead><tr><th scope="col">学習の名前</th><th scope="col">問題</th><th scope="col">間違い方</th><th scope="col">件数</th></tr></thead>
          <tbody>{items.map((item) => (
            <tr key={`${item.lessonKey}-${item.problem}-${item.pattern}`}>
              <td>{item.lessonKey}</td><td>{item.problem}</td><td>{C.patterns[item.pattern]}</td><td>{item.count} 件</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

function PatternSelect<T extends ErrorPattern>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (value: T) => void }) {
  return (
    <label className="field">{label}
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => <option key={option} value={option}>{C.patterns[option]}</option>)}
      </select>
    </label>
  );
}

function Controls({ loop }: { loop: Loop }) {
  return (
    <>
      <fieldset className="roles">
        <legend>{C.roleLegend}</legend>
        {(["teacher", "researcher"] as const).map((value) => (
          <label key={value}>
            <input type="radio" name="role" checked={loop.role === value} onChange={() => loop.setRole(value)} />
            {C.roles[value]}
          </label>
        ))}
        <p className="note">{C.roleNote}</p>
      </fieldset>
      <label className="field">{LABEL.purpose}
        <input type="text" value={loop.purpose} placeholder={LABEL.purposePlaceholder} onChange={(event) => loop.setPurpose(event.target.value)} />
      </label>
      <label className="field">{LABEL.approverKey}
        <input type="password" autoComplete="off" value={loop.approverKey} onChange={(event) => loop.setApproverKey(event.target.value)} />
        <span className="note">{C.approverKeyNote}</span>
      </label>
    </>
  );
}

const STATUS_TEXT = { pending: "決める前", approved: "承認済み", rejected: "断った", revoked: "取り消した" } as const;

export function ResearchPage() {
  const loop = useLoop();
  const [tab, setTab] = useState<"flow" | "theme" | "studio">("flow");
  const serverText = loop.server === "up" ? C.serverUp : loop.server === "down" ? C.serverDown : C.serverChecking;
  return (
    <main className="research">
      <header>
        <h1>{C.title}</h1>
        <p>{C.lead}</p>
        <ol className="flow" aria-label={C.flowName}>
          {C.flow.map((word) => <li key={word}>{word}</li>)}
        </ol>
        <p className="banner" role="note">{C.dummyNotice}</p>
        <p className={`server server--${loop.server}`} role="status">{serverText}</p>
      </header>
      <ViewingTierSelector role={loop.role} scope={loop.scope} onScopeChange={loop.setScope} />
      <Controls loop={loop} />
      <div className="tabs" role="tablist" aria-label="画面の切り替え">
        <button type="button" role="tab" id="tab-flow" className="tab" aria-selected={tab === "flow"} aria-controls="panel-flow" onClick={() => setTab("flow")}>{T.tabFlow}</button>
        <button type="button" role="tab" id="tab-theme" className="tab" aria-selected={tab === "theme"} aria-controls="panel-theme" onClick={() => setTab("theme")}>{T.tabTheme}</button>
        <button type="button" role="tab" id="tab-studio" className="tab" aria-selected={tab === "studio"} aria-controls="panel-studio" onClick={() => setTab("studio")}>{C.tabStudio}</button>
      </div>
      {tab === "theme" && <div role="tabpanel" id="panel-theme" aria-labelledby="tab-theme"><ThemePanel role={loop.role} /></div>}
      {tab === "studio" && <div role="tabpanel" id="panel-studio" aria-labelledby="tab-studio"><StudioPanel approverKey={loop.approverKey} /></div>}
      {tab === "flow" && <div role="tabpanel" id="panel-flow" aria-labelledby="tab-flow" className="panel">
      <p className="note">{C.patternNote}</p>
      <ol className="steps">
        <Step index={STEP.push} notice={loop.notice}>
          <PatternSelect label={LABEL.dummyPattern} value={loop.dummyPattern} options={ALL_PATTERNS} onChange={loop.setDummyPattern} />
          <div className="actions">
            <Button onClick={() => loop.push(1)}>{LABEL.push}</Button>
            <Button onClick={() => loop.push(5)}>{LABEL.pushFive}</Button>
          </div>
          <p className="note">これまでに送った数：{loop.sent} 件</p>
        </Step>
        <Step index={STEP.read} notice={loop.notice}>
          <fieldset className="scopes">
            <legend>{LABEL.scope}</legend>
            {(["summary", "records"] as const).map((value) => (
              <label key={value}>
                <input type="radio" name="scope" checked={loop.scope === value} onChange={() => loop.setScope(value)} />
                {C.scopes[value]}
              </label>
            ))}
          </fieldset>
          <Button onClick={loop.read}>{LABEL.read}</Button>
          <ReadView result={loop.result} />
          <Button onClick={loop.loadRegion}>ほかの学校の集計を見る</Button>
          {loop.regionNotice && <p className="step__notice is-error" role="status">{loop.regionNotice}</p>}
          <RegionView items={loop.regionItems} />
        </Step>
        <Step index={STEP.suggest} notice={loop.notice}>
          <PatternSelect<NamedPattern> label={LABEL.suggestPattern} value={loop.suggestPattern} options={NAMED_PATTERNS} onChange={loop.setSuggestPattern} />
          <Button onClick={loop.suggest}>{LABEL.suggest}</Button>
          {loop.suggestion && (
            <div className="result" role="region" aria-label="提案">
              <p>{loop.suggestion.problem} で「{C.patterns[loop.suggestion.pattern]}」の直し方の候補（この種類の記録 {loop.suggestion.basis.count} 件）</p>
              {loop.suggestion.candidates.map((candidate) => (
                <label key={candidate.number} className="candidate">
                  <input type="radio" name="suggestion-candidate" value={candidate.number}
                    checked={loop.selectedCandidateNumber === candidate.number} disabled={!candidate.passed || loop.suggestion?.status !== "pending"}
                    onChange={() => loop.setSelectedCandidateNumber(candidate.number)} />
                  <span><strong>{C.candidateSource(candidate.source)} {candidate.number}</strong>「{candidate.hint || "文がありません"}」
                    <br />{candidate.passed ? C.candidatePassed : C.candidateFailed(candidate.reason ?? "check_failed")}</span>
                </label>
              ))}
              {loop.suggestion?.candidates.some((candidate) => candidate.source === "gemini" && candidate.passed) && <p>{C.aiApprovalNote}</p>}
              {loop.suggestion.aiFallback && <p>{C.aiFallback(loop.suggestion.aiFallback)}</p>}
            </div>
          )}
        </Step>
        <Step index={STEP.decide} notice={loop.notice}>
          <label className="field">{LABEL.reason}
            <input type="text" value={loop.reason} placeholder={LABEL.reasonPlaceholder} onChange={(event) => loop.setReason(event.target.value)} />
          </label>
          <div className="actions">
            <Button variant="primary" onClick={() => loop.decide("approved")}>{LABEL.approve}</Button>
            <Button onClick={() => loop.decide("rejected")}>{LABEL.reject}</Button>
            {loop.suggestion?.status === "approved" && <Button onClick={loop.revoke}>{LABEL.revoke}</Button>}
          </div>
          {loop.suggestion && <p className="note">いまの状態：{STATUS_TEXT[loop.suggestion.status]}</p>}
        </Step>
        <Step index={STEP.deliver} notice={loop.notice}>
          <ChildPreview approved={loop.approved} onReload={loop.reloadApproved} />
        </Step>
      </ol>
      </div>}
      <AuditTable entries={loop.audit} onLoad={loop.loadAudit} notice={loop.notice} />
    </main>
  );
}
