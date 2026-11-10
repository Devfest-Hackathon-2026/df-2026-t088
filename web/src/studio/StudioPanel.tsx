import { useRef, useState } from "react";
import { Button } from "../components/Button";
import { RESEARCH_COPY } from "../research/copy";
import { createConnectedStudioApi, STUDIO_MOCK_LESSON } from "./api";
import type { StudioDiff, StudioValidationResult } from "./api";
import type { StudioLesson } from "./lesson-ir";
import { EvidencePanel } from "./EvidencePanel";
import type { EvidenceVersion } from "./EvidencePanel";
import { StudioPreview } from "./StudioPreview";
import { Tournament } from "./Tournament";
import type { TournamentAlternative } from "./Tournament";
import { toLesson } from "./to-lesson";

export type StudioMode = "mock" | "real";
export type StudioDecision = "approved" | "rejected" | "revoked";
export type StudioDraft = {
  draftId: string;
  lessonId?: string;
  lesson: StudioLesson;
  validation: StudioValidationResult;
  version: number;
  mode: StudioMode;
  fallbackReason?: string;
};
export type StudioApi = {
  generate: (lessonId: string, prompt: string) => Promise<StudioDraft>;
  createRevision?: (draft: StudioDraft, prompt: string) => Promise<StudioDraft>;
  decide: (draftId: string, decision: "approved" | "rejected", reason: string, headers: Record<string, string>, version?: number) => Promise<{ status: "approved" | "rejected"; version: number; mode: StudioMode; fallbackReason?: string }>;
  revoke: (draftId: string, reason: string, headers: Record<string, string>, version?: number) => Promise<{ status: "revoked"; version: number; mode: StudioMode; lesson?: StudioLesson; fallbackReason?: string }>;
  diff?: (draftId: string, from: number, to: number) => Promise<StudioDiff>;
  /** 同じ一文から、3 つの教え方を作る（#163） */
  tournament?: (prompt: string) => Promise<{ alternatives: TournamentAlternative[]; fallbackReason?: string }>;
  /** 比べて選んだ案を、承認待ちの版 1 として置く */
  adopt?: (lesson: StudioLesson, mode: StudioMode) => Promise<StudioDraft>;
  /** 版の一覧（根拠と出どころの表示に使う。#164） */
  versions?: (lessonId: string) => Promise<EvidenceVersion[]>;
};

function createMockApi(): StudioApi {
  let version = 1;
  let nextDraftId = 1;
  return {
    async generate() {
      return { draftId: `mock-draft-${nextDraftId++}`, lessonId: "mock-studio", lesson: STUDIO_MOCK_LESSON, validation: { ok: true }, version: 1, mode: "mock" };
    },
    async createRevision(draft) {
      version = draft.version + 1;
      const lesson = { ...draft.lesson, strategy: draft.lesson.strategy === "visual" ? "numeric" as const : "visual" as const };
      return { ...draft, lesson, version, mode: "mock" };
    },
    async decide(_draftId, decision, _reason, _headers, currentVersion = version) {
      return { status: decision, version: currentVersion, mode: "mock" };
    },
    async revoke(_draftId, _reason, _headers, currentVersion = version) {
      return { status: "revoked", version: Math.max(1, currentVersion - 1), mode: "mock", lesson: STUDIO_MOCK_LESSON };
    },
    async diff(_draftId, from, to) {
      return { from, to, changes: [{ path: "strategy", before: "visual", after: "numeric" }] };
    },
    async tournament() {
      const strategies = ["visual", "numeric", "misconception"] as const;
      return {
        alternatives: strategies.map((strategy) => ({
          strategy, lesson: { ...STUDIO_MOCK_LESSON, strategy }, validation: { ok: true } as const,
          checks: { structure: true, arithmetic: true, answerLeak: true, hintWording: true }, elapsedMs: 0, source: "mock" as const, model: "mock",
        })),
      };
    },
    async adopt(lesson) {
      return { draftId: `mock-draft-${nextDraftId++}`, lessonId: "mock-studio", lesson, validation: { ok: true }, version: 1, mode: "mock" };
    },
  };
}

const messageOf = (error: unknown) => error instanceof Error ? error.message : "教材を作れませんでした";
const approvalHeaders = (key: string): Record<string, string> => key.trim() ? { "x-approver-key": key } : {};
const STATUS_TEXT: Record<StudioDecision, string> = { approved: "承認済み", rejected: "却下しました", revoked: "取り消し済み" };

export function StudioPanel({ api, approverKey = "" }: { api?: StudioApi; approverKey?: string }) {
  const mockApi = useRef<StudioApi | null>(null);
  if (!mockApi.current) mockApi.current = createMockApi();
  const connectedApi = useRef<StudioApi | null>(null);
  if (!connectedApi.current) connectedApi.current = createConnectedStudioApi(mockApi.current);
  const client = api ?? connectedApi.current;
  const [lessonId, setLessonId] = useState("fraction-addition");
  const [prompt, setPrompt] = useState("");
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<StudioDraft | null>(null);
  const [decision, setDecision] = useState<StudioDecision | null>(null);
  const [diff, setDiff] = useState<StudioDiff | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [previousLesson, setPreviousLesson] = useState<StudioLesson | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [alternatives, setAlternatives] = useState<TournamentAlternative[] | null>(null);
  const [versions, setVersions] = useState<EvidenceVersion[] | null>(null);

  // 版が動いたら、根拠と出どころの表示を読み直す。読めなければ見本のまま（見本の印が出る）
  const refreshVersions = async (target: StudioDraft | null) => {
    if (!target?.lessonId || !client.versions || target.fallbackReason) { setVersions(null); return; }
    try { setVersions(await client.versions(target.lessonId)); } catch { setVersions(null); }
  };

  const compare = async () => {
    if (!prompt.trim()) { setError("作りたい教材を一文で書いてください"); return; }
    if (!client.tournament) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const result = await client.tournament(prompt.trim());
      setAlternatives(result.alternatives);
      setNotice("3 つの教え方を作りました。検査に通った案から 1 つを選んでください");
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setWorking(false);
    }
  };

  const adopt = async (alternative: TournamentAlternative) => {
    if (!alternative.lesson || !client.adopt) return;
    setWorking(true);
    setError("");
    try {
      const next = await client.adopt(alternative.lesson, alternative.source === "gemini" ? "real" : "mock");
      setDraft(next);
      setDecision(null);
      setDiff(null);
      setShowDiff(false);
      setPreviousLesson(null);
      setNotice(`選んだ案を版 ${next.version} として置きました。承認してください`);
      await refreshVersions(next);
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setWorking(false);
    }
  };

  const generate = async () => {
    if (!prompt.trim()) { setError("作りたい教材を一文で書いてください"); return; }
    setWorking(true);
    setError("");
    setNotice("");
    setDecision(null);
    try {
      const result = await client.generate(lessonId, prompt.trim());
      setDraft(result);
      setDiff(null);
      setShowDiff(false);
      setPreviousLesson(null);
      setAlternatives(null);
      if (result.validation.ok) setNotice("検査に通りました");
      await refreshVersions(result);
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setWorking(false);
    }
  };

  const decide = async (next: "approved" | "rejected") => {
    if (!draft) return;
    if (!reason.trim()) { setError("理由を書いてください"); return; }
    setWorking(true);
    setError("");
    try {
      const result = await client.decide(draft.draftId, next, reason.trim(), approvalHeaders(approverKey), draft.version);
      setDraft({ ...draft, version: result.version, mode: result.mode, ...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {}) });
      setDecision(result.status);
      setNotice(result.status === "approved" ? `版 ${result.version} を承認しました` : "却下しました");
      await refreshVersions(draft);
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setWorking(false);
    }
  };

  const createRevision = async () => {
    if (!draft || !client.createRevision) return;
    setWorking(true);
    setError("");
    try {
      setPreviousLesson(draft.lesson);
      const nextDraft = await client.createRevision(draft, prompt.trim());
      setDraft(nextDraft);
      setDecision(null);
      setShowDiff(false);
      setNotice(`版 ${nextDraft.version} を作りました。内容を確かめてください`);
      await refreshVersions(nextDraft);
      if (client.diff) {
        const nextDiff = await client.diff(nextDraft.draftId, draft.version, nextDraft.version);
        setDiff(nextDiff);
        if (nextDiff.fallbackReason) setDraft({ ...nextDraft, mode: "mock", fallbackReason: nextDiff.fallbackReason });
      }
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setWorking(false);
    }
  };

  const revoke = async () => {
    if (!draft) return;
    if (!reason.trim()) { setError("理由を書いてください"); return; }
    setWorking(true);
    setError("");
    try {
      const result = await client.revoke(draft.draftId, reason.trim(), approvalHeaders(approverKey), draft.version);
      setDraft({ ...draft, version: result.version, lesson: result.lesson ?? previousLesson ?? draft.lesson, mode: result.mode, ...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {}) });
      setDecision(result.status);
      setNotice(`承認を取り消しました。版 ${result.version} に戻しました`);
      await refreshVersions(draft);
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setWorking(false);
    }
  };

  const isMock = draft?.mode === "mock" || !draft;
  return (
    <section className="studio-panel" aria-label="教材スタジオ">
      {isMock && <p className="banner studio-panel__mock" role="note">mock（本物の Gemini ではない）</p>}
      {isMock && <p className="banner" role="note">{RESEARCH_COPY.dummyNotice}</p>}
      {draft?.fallbackReason && <p className="banner" role="note">サーバーに接続できないため、見本データで続けています。</p>}

      <ol className="studio-panel__steps" aria-label="教材をつくる流れ">
        <li className="studio-panel__card">
          <h2>教材を選ぶ</h2>
          <label className="field">教材
            <select value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
              <option value="fraction-addition">分数のたし算（見本）</option>
            </select>
          </label>
        </li>
        <li className="studio-panel__card">
          <h2>先生が一文で書く</h2>
          <label className="field" htmlFor="studio-prompt">先生が一文で書く
            <input id="studio-prompt" type="text" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例：分母をそろえる教材を作る" />
          </label>
          <div className="actions">
            <Button variant="primary" onClick={generate}>{draft ? "作り直す" : "教材を生成する"}</Button>
            {client.tournament && <Button onClick={compare}>3 つの教え方を作って比べる</Button>}
          </div>
          <p className="studio-panel__status" role="status" aria-live="polite">{working ? (draft ? "作り直し中です" : "生成中です") : notice}</p>
          {error && <p className="step__notice is-error" role="alert">{error}</p>}
          {draft && <p className="note">現在の版：版 {draft.version}</p>}
          {draft && !draft.validation.ok && <ul className="studio-panel__issues" aria-label="検査の理由">{draft.validation.issues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ul>}
        </li>
        <li className="studio-panel__card">
          <h2>プレビュー</h2>
          <div className="studio-panel__preview-slot" data-studio-preview-slot>
            <section className="studio-panel__preview" role="region" aria-label="教材プレビュー">
              {draft && <strong>{draft.lesson.objective}</strong>}
              {draft && draft.lesson.problems.length > 0
                ? <StudioPreview lessons={[{ label: `版 ${draft.version}`, lesson: toLesson(draft.lesson) }]} />
                : draft ? <p>タイルの問題がありません。</p> : <p>教材を生成すると、ここにプレビューが表示されます。</p>}
            </section>
          </div>
          {/* 改訂は、承認の前に前の版との差分を見て確かめる */}
          {draft && diff && draft.version > 1 && <Button onClick={() => setShowDiff((visible) => !visible)}>{showDiff ? "差分を閉じる" : "差分を表示"}</Button>}
          {draft && diff && showDiff && draft.version > 1 && <section className="studio-panel__comparison" aria-label="版の差分">
            <h3>版 {diff.from} から版 {diff.to} の差分</h3>
            {diff.changes.length === 0 ? <p className="note">変更はありません。</p> : <ul>{diff.changes.map((change) => <li key={change.path}>{change.path}: {String(change.before)} → {String(change.after)}</li>)}</ul>}
          </section>}
          {alternatives && alternatives.length === 3 && <section className="studio-panel__comparison" aria-label="3案の比較">
            <Tournament alternatives={alternatives as unknown as readonly [TournamentAlternative, TournamentAlternative, TournamentAlternative]} onSelect={(alternative) => { void adopt(alternative); }} />
          </section>}
        </li>
        {draft?.validation.ok && <li className="studio-panel__card">
          <h2>承認</h2>
          <p className="note">承認キーは画面の上の欄に入れてください</p>
          <label className="field">理由
            <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="例：内容を確認しました" />
          </label>
          <div className="actions">
            <Button variant="primary" onClick={() => decide("approved")}>承認する</Button>
            <Button onClick={() => decide("rejected")}>却下する</Button>
            {decision === "approved" && <Button onClick={revoke}>承認を取り消す</Button>}
          </div>
          {decision && <p className="note">版 {draft.version} の状態：{STATUS_TEXT[decision]}</p>}
          {decision === "approved" && client.createRevision && <Button onClick={createRevision}>版{draft.version + 1}を作る</Button>}
        </li>}
        {draft && <li className="studio-panel__card">
          <h2>根拠と出どころ</h2>
          <EvidencePanel {...(versions && versions.length > 0 ? { versions } : {})} />
        </li>}
      </ol>
    </section>
  );
}
