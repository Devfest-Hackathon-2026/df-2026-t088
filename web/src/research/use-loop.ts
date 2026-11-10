import { useCallback, useEffect, useState } from "react";
import * as api from "./api";
import type { ApprovedHint, AuditEntry, ErrorPattern, NamedPattern, ReadResult, RegionSummaryItem, Role, Scope, Suggestion } from "./api";
import { NOTICE } from "./copy";
import { useApproverKey, setApproverKey } from "../teacher/approver-key";

export type ServerState = "checking" | "up" | "down";

/** 結果の文。どの段のものかを持ち、その段の中に出す（押した場所から離れないように） */
export type Notice = { step: number; text: string; isError: boolean };

// 段の番号。画面の並びと同じ。操作の記録は、5 つの手順の次
export const STEP = { push: 0, read: 1, suggest: 2, decide: 3, deliver: 4, audit: 5 } as const;

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : "うまくいきませんでした");

export function useLoop() {
  const [role, setRoleState] = useState<Role>("teacher");
  const [server, setServer] = useState<ServerState>("checking");
  const [sent, setSent] = useState(0);
  const [dummyPattern, setDummyPatternState] = useState<ErrorPattern>("sum-both");
  const [suggestPattern, setSuggestPatternState] = useState<NamedPattern>("sum-both");
  const [scope, setScopeState] = useState<Scope>("summary");
  const [purpose, setPurpose] = useState("");
  const [reason, setReason] = useState("");
  const approverKey = useApproverKey(); // 先生の画面と共有する。画面の中だけで、保存しない
  const [result, setResult] = useState<ReadResult | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [selectedCandidateNumber, setSelectedCandidateNumber] = useState<number | null>(null);
  const [approved, setApproved] = useState<ApprovedHint[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [regionItems, setRegionItems] = useState<RegionSummaryItem[] | null>(null);
  const [regionNotice, setRegionNotice] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let alive = true;
    api.checkHealth().then(() => alive && setServer("up"), () => alive && setServer("down"));
    return () => { alive = false; };
  }, []);

  const say = useCallback((step: number, text: string, isError = false) => setNotice({ step, text, isError }), []);

  // 役割や種類を変えたら、前の操作の結果の文は、もう当てはまらないので消す
  const setRole = (next: Role) => { setRoleState(next); setNotice(null); };
  const setScope = (next: Scope) => { setScopeState(next); setNotice(null); };
  const setDummyPattern = (next: ErrorPattern) => { setDummyPatternState(next); setNotice(null); };
  const setSuggestPattern = (next: NamedPattern) => { setSuggestPatternState(next); setNotice(null); };

  const loadAudit = useCallback(async (as: Role, key: string) => {
    try {
      setAudit((await api.readAuditLog(as, key)).items);
    } catch (error) {
      say(STEP.audit, messageOf(error), true);
    }
  }, [say]);

  // 失敗は、押した段に出す。サーバーの文は大人向けなので、そのまま見せる。
  // 操作の記録の自動の読み込みは「決めた」あとだけにする。読むたびに「記録を読んだ」が増えて、本当の操作が埋もれるため
  const run = useCallback(async (step: number, action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      say(step, messageOf(error), true);
    }
  }, [say]);

  const push = (count: number) => run(STEP.push, async () => {
    let total = sent;
    // 途中で失敗しても、送れた分の数は合わせる
    try {
      for (let index = 0; index < count; index += 1) {
        await api.sendStumble(0, dummyPattern);
        total += 1;
      }
    } finally {
      setSent(total);
    }
    say(STEP.push, NOTICE.sentOne(total));
  });

  const read = () => run(STEP.read, async () => {
    if (!purpose.trim()) { say(STEP.read, NOTICE.needPurpose, true); return; }
    const next = await api.readStumbles(role, scope, purpose, approverKey);
    setResult(next);
    if (next.items.length === 0) say(STEP.read, NOTICE.hiddenSmall);
    else setNotice(null);
  });

  const loadRegion = () => run(STEP.read, async () => {
    setRegionItems(null);
    setRegionNotice(null);
    try {
      setRegionItems((await api.readRegionSummary(approverKey)).items);
    } catch (error) {
      if (error instanceof api.ApiError && error.code === "NOT_FOUND") return;
      setRegionNotice(messageOf(error));
    }
  });

  const suggest = () => run(STEP.suggest, async () => {
    if (!purpose.trim()) { say(STEP.suggest, NOTICE.needPurpose, true); return; }
    const created = await api.createSuggestion(role, suggestPattern, purpose);
    setSuggestion(created);
    setSelectedCandidateNumber(created.candidates.find((candidate) => candidate.passed)?.number ?? null);
    say(STEP.suggest, NOTICE.suggested);
  });

  // 次の子の画面は、いま選んでいる種類ではなく、承認する提案の種類で読む（選び直しても、ずれない）
  const previewPattern: NamedPattern = suggestion?.pattern ?? suggestPattern;
  const reloadApproved = useCallback(() => run(STEP.deliver, async () => {
    setApproved((await api.readApprovedHints(previewPattern)).items);
  }), [run, previewPattern]);

  const decide = (decision: "approved" | "rejected") => run(STEP.decide, async () => {
    if (!suggestion) { say(STEP.decide, NOTICE.noSuggestion, true); return; }
    if (!reason.trim()) { say(STEP.decide, NOTICE.needReason, true); return; }
    if (decision === "approved" && selectedCandidateNumber === null) { say(STEP.decide, NOTICE.noSelectableCandidate, true); return; }
    try {
      const done = await api.decideSuggestion(suggestion.id, role, decision, reason, approverKey, decision === "approved" ? selectedCandidateNumber ?? undefined : undefined);
      setSuggestion({ ...suggestion, status: done.status });
      say(STEP.decide, decision === "approved" && (done.replaced?.length ?? 0) > 0
        ? NOTICE.replaced(done.replaced)
        : NOTICE.decided(done.status));
      await reloadApproved();
    } finally {
      await loadAudit(role, approverKey);
    }
  });

  const revoke = () => run(STEP.decide, async () => {
    if (!suggestion) { say(STEP.decide, NOTICE.noSuggestion, true); return; }
    if (!reason.trim()) { say(STEP.decide, NOTICE.needReason, true); return; }
    try {
      const done = await api.revokeSuggestion(suggestion.id, role, reason, approverKey);
      setSuggestion({ ...suggestion, status: done.status });
      say(STEP.decide, NOTICE.revoked);
      await reloadApproved();
    } finally {
      await loadAudit(role, approverKey);
    }
  });

  return {
    role, setRole, server, sent, dummyPattern, setDummyPattern, suggestPattern, setSuggestPattern, scope, setScope, purpose, setPurpose, reason, setReason, approverKey, setApproverKey,
    selectedCandidateNumber, setSelectedCandidateNumber,
    result, suggestion, approved, audit, notice, regionItems, regionNotice,
    push, read, loadRegion, suggest, decide, revoke, reloadApproved, loadAudit: () => loadAudit(role, approverKey),
  };
}

export type Loop = ReturnType<typeof useLoop>;
