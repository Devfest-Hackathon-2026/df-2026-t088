import { useEffect, useState } from "react";
import { ApiError, call } from "../research/api";
import { useLoopAccess } from "./loop-access";
import { PATTERN_LABEL } from "./copy";
import { problemLabel, unitLabel } from "./unit";
import "./LoopAssistantCard.css";

type Candidate = { number: number; source: "gemini" | "table"; hint: string; passed: boolean; reason?: string };
type Side = { count: number; correct: number | null };
type AssistantRow = {
  chapterId: string;
  lessonKey: string;
  problem: string;
  pattern: string;
  count: number;
  status: string;
  source: "dummy" | "demo";
  suggestion?: { id: string; candidates: Candidate[]; selectedCandidateNumber?: number };
  effect: { status: "undetermined" | "compared"; before: Side; after: Side; tryAlternatives: boolean; alternatives: Candidate[] };
};

type State = { items: AssistantRow[] | null; error: string | null; keyRequired: boolean };
const patternLabel = (pattern: string): string => (PATTERN_LABEL as Record<string, string>)[pattern] ?? pattern;

function rate(side: Side): string {
  return side.correct === null ? "まだ判断できません" : `${Math.round(side.correct * 100)}%（${side.count}件）`;
}

// 承認キーは先生の画面の上の行（TeacherApproverKey）で 1 回だけ入れる。学級に入っている先生は、キー無しで自分の学級の分を使う
export function LoopAssistantCard() {
  const [state, setState] = useState<State>({ items: null, error: null, keyRequired: false });
  const { approverKey, headers, unauthorizedText } = useLoopAccess();
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sampleBaseAdded, setSampleBaseAdded] = useState(false);
  const [sampleAfterAdded, setSampleAfterAdded] = useState<Record<string, boolean>>({});

  async function refresh() {
    try {
      const result = await call<{ items: AssistantRow[] }>("GET", "/api/v1/loop/assistant", undefined, headers);
      setState({ items: result.items, error: null, keyRequired: false });
      setSelected((current) => {
        const next = { ...current };
        for (const item of result.items) {
          const first = item.suggestion?.candidates.find((candidate) => candidate.passed);
          if (first && next[item.suggestion!.id] === undefined) next[item.suggestion!.id] = first.number;
        }
        return next;
      });
    } catch (error) {
      const keyRequired = error instanceof ApiError && error.code === "UNAUTHORIZED";
      setState((current) => ({ ...current, items: current.items ?? [], error: keyRequired ? unauthorizedText("画面の上の「承認キー」を入れてください") : "アシスタントを読み込めませんでした", keyRequired }));
    }
  }

  useEffect(() => { void refresh(); }, [approverKey]);

  async function decide(item: AssistantRow, decision: "approved" | "rejected") {
    if (!item.suggestion) return;
    const reason = (reasons[item.suggestion.id] ?? "").trim();
    if (!reason) { setState((current) => ({ ...current, error: "理由を書いてください（確かめたことを短く）" })); return; }
    setBusy(true);
    try {
      await call("POST", `/api/v1/suggestions/${encodeURIComponent(item.suggestion.id)}/decision`, {
        role: "teacher", decision, ...(decision === "approved" ? { candidateNumber: selected[item.suggestion.id] } : {}), reason,
      }, headers);
      setReasons((current) => ({ ...current, [item.suggestion!.id]: "" }));
      setState((current) => ({ ...current, error: null }));
      await refresh();
    } catch (error) {
      const keyRequired = error instanceof ApiError && error.code === "UNAUTHORIZED";
      setState((current) => ({ ...current, error: keyRequired ? unauthorizedText("承認キーが必要か、合っていません") : "決定を保存できませんでした", keyRequired }));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(item: AssistantRow) {
    if (!item.suggestion) return;
    const reason = (reasons[item.suggestion.id] ?? "").trim();
    if (!reason) { setState((current) => ({ ...current, error: "取り消す理由を書いてください" })); return; }
    setBusy(true);
    try {
      await call("POST", `/api/v1/suggestions/${encodeURIComponent(item.suggestion.id)}/revoke`, { role: "teacher", reason }, headers);
      setReasons((current) => ({ ...current, [item.suggestion!.id]: "" }));
      setState((current) => ({ ...current, error: null }));
      await refresh();
    } catch (error) {
      const keyRequired = error instanceof ApiError && error.code === "UNAUTHORIZED";
      setState((current) => ({ ...current, error: keyRequired ? unauthorizedText("承認キーが必要か、合っていません") : "取り消しを保存できませんでした", keyRequired }));
    } finally {
      setBusy(false);
    }
  }

  async function tryAlternative(item: AssistantRow) {
    if (!item.suggestion) return;
    setBusy(true);
    try {
      await call("POST", `/api/v1/loop/assistant/${encodeURIComponent(item.suggestion.id)}/alternatives`, {}, headers);
      await refresh();
    } catch (error) {
      const keyRequired = error instanceof ApiError && error.code === "UNAUTHORIZED";
      setState((current) => ({ ...current, error: keyRequired ? unauthorizedText("承認キーが必要か、合っていません") : "別の案を読み込めませんでした", keyRequired }));
    } finally {
      setBusy(false);
    }
  }

  async function addSampleRecords(approved: boolean, onlyPattern?: string) {
    setBusy(true);
    try {
      await call("POST", "/api/v1/loop/assistant/samples", approved
        ? { stage: "approved", pattern: onlyPattern }
        : { stage: "base" }, headers);
      if (approved && onlyPattern) setSampleAfterAdded((current) => ({ ...current, [onlyPattern]: true }));
      else setSampleBaseAdded(true);
      setState((current) => ({ ...current, error: null }));
      await refresh();
    } catch (error) {
      // 混んでいるとき（429）は、待てば直ると分かる文を出す。押し直しは、応答が返るまでボタンが効かない（busy）で止める（#377）
      const crowded = error instanceof ApiError && error.code === "RATE_LIMITED";
      setState((current) => ({ ...current, error: crowded ? "混み合っています。少し待ってからもう一度押してください" : "見本の記録を用意できませんでした" }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="loop-assistant" aria-labelledby="loop-assistant-title">
      <div className="loop-assistant__heading">
        <h2 id="loop-assistant-title">学びの輪アシスタント</h2>
        {!sampleBaseAdded && <button type="button" onClick={() => void addSampleRecords(false)} disabled={busy}>見本を入れる</button>}
        <button type="button" onClick={() => void refresh()} disabled={busy}>更新</button>
      </div>
      {state.error && <p role="alert">{state.error}</p>}
      {state.items === null && !state.error && <p role="status">読み込んでいます</p>}
      {state.items?.length === 0 && <p role="status">今は対象の型がありません</p>}
      {state.items && state.items.length > 0 && (
        <div className="loop-assistant__items">
          {state.items.map((item) => {
            const approvedHint = item.suggestion?.candidates.find((candidate) => candidate.number === item.suggestion?.selectedCandidateNumber);
            const reasonField = item.suggestion && (
              <label className="loop-assistant__reason">理由（必須）
                <input required aria-required="true" value={reasons[item.suggestion.id] ?? ""} maxLength={200} placeholder="確かめたことを短く" onChange={(event) => setReasons((current) => ({ ...current, [item.suggestion!.id]: event.target.value }))} />
              </label>
            );
            const passing = item.suggestion?.candidates.filter((candidate) => candidate.passed) ?? [];
            return (
              <article className="loop-assistant__item" key={`${item.lessonKey}/${item.problem}/${item.pattern}`}>
                <div className="loop-assistant__summary">
                  <strong>{item.count} 件</strong>{item.source === "dummy" && <span className="loop-assistant__badge">見本</span>}
                  <span>{unitLabel(item.chapterId, item.lessonKey)}・{problemLabel(item.lessonKey, item.problem)}</span>
                  <span>型: {patternLabel(item.pattern)}</span>
                </div>
                {item.status === "pending" && item.suggestion && (
                  <div className="loop-assistant__decision">
                    {passing.length > 0 ? <>
                      <label className="loop-assistant__choice">直し方の案
                        <select aria-label="直し方の案" title={passing.find((candidate) => candidate.number === (selected[item.suggestion!.id] ?? passing[0]!.number))?.hint} value={selected[item.suggestion.id] ?? passing[0]!.number} onChange={(event) => setSelected((current) => ({ ...current, [item.suggestion!.id]: Number(event.target.value) }))}>
                          {passing.map((candidate) => <option key={candidate.number} value={candidate.number}>{candidate.hint}</option>)}
                        </select>
                      </label>
                    </> : <span>使える案がありません</span>}
                    {reasonField}
                    {passing.length > 0 && <button type="button" onClick={() => void decide(item, "approved")} disabled={busy}>承認</button>}
                    <button type="button" onClick={() => void decide(item, "rejected")} disabled={busy}>却下</button>
                  </div>
                )}
                {item.status === "approved" && item.suggestion && (
                  <div className="loop-assistant__decision">
                    {approvedHint && <span>承認した案: {approvedHint.hint}</span>}
                    {reasonField}
                    <button type="button" onClick={() => void revoke(item)} disabled={busy}>承認を取り消す</button>
                  </div>
                )}
                {item.status === "approved" && <p className="loop-assistant__effect">
                  {item.effect.status === "compared"
                    ? `承認前 ${rate(item.effect.before)} ／ 承認後 ${rate(item.effect.after)}（この記録内の割合です。学習効果の証明ではありません）`
                    : `承認前 ${rate(item.effect.before)} ／ 承認後 ${rate(item.effect.after)}（まだ判断できません）`}
                  {item.source === "dummy" && "・見本の記録"}
                  {item.source === "dummy" && item.effect.after.count === 0 && !sampleAfterAdded[item.pattern] && <button type="button" onClick={() => void addSampleRecords(true, item.pattern)} disabled={busy}>見本の承認後記録を入れる</button>}
                  {item.effect.tryAlternatives && item.effect.alternatives.length > 0 && <button type="button" onClick={() => void tryAlternative(item)} disabled={busy}>別の案を試す</button>}
                </p>}
                {item.status === "rejected" && <p>この案は却下されました</p>}
                {item.status === "revoked" && <p>承認は取り消されました</p>}
              </article>
            );
          })}
        </div>
      )}
      <p className="loop-assistant__note">件数と割合はこの記録の中での値です。少人数の効果は表示しません。</p>
    </section>
  );
}
