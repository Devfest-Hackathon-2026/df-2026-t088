// ファーストディスプレイ・提出物・時間割で読むデータと、出す・取り消す。
// 押した時にすぐ画面を変え、失敗したら戻す（HM-30）。同じ提出物の送信が終わるまでは次を送らない（FR-005）
import { useCallback, useEffect, useRef, useState } from "react";
import { COPY } from "../../copy";
import { HomeApiError, readAssignments, readTimetable, submitAssignment, withdrawAssignment } from "./api";
import type { Assignment, TimetableDay } from "./types";

export type Load<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; kind: "offline" | "rate" };
type AssignmentsData = { now: string; assignments: Assignment[] };
type TimetableData = { now: string; days: TimetableDay[] };

const errorKind = (error: unknown): "offline" | "rate" => (error instanceof HomeApiError ? error.kind : "offline");

export function useHomeData(showToast: (text: string) => void, options: { timetable?: boolean; assignments?: boolean } = {}) {
  const wantAssignments = options.assignments ?? true;
  const wantTimetable = options.timetable ?? true;
  const [assignments, setAssignments] = useState<Load<AssignmentsData>>({ status: "loading" });
  const [timetable, setTimetable] = useState<Load<TimetableData>>({ status: "loading" });
  // 結果の読み上げ（role="status"）
  const [announce, setAnnounce] = useState("");
  const pending = useRef(new Set<string>());
  const alive = useRef(true);

  // load を呼ぶたびに進める連番。最新の呼び出しの応答だけを反映し、遅れて届いた古い応答は捨てる
  const loadSeq = useRef(0);

  const load = useCallback(() => {
    const seq = ++loadSeq.current;
    const latest = () => alive.current && seq === loadSeq.current;
    if (wantAssignments) {
      setAssignments({ status: "loading" });
      readAssignments().then(
        (data) => { if (latest()) setAssignments({ status: "ready", data }); },
        (error: unknown) => { if (latest()) setAssignments({ status: "error", kind: errorKind(error) }); },
      );
    }
    if (wantTimetable) {
      setTimetable({ status: "loading" });
      readTimetable().then(
        (data) => { if (latest()) setTimetable({ status: "ready", data }); },
        (error: unknown) => { if (latest()) setTimetable({ status: "error", kind: errorKind(error) }); },
      );
    }
  }, [wantAssignments, wantTimetable]);

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [load]);

  const patch = (id: string, submittedAt: string | null) => setAssignments((current) => (current.status !== "ready" ? current : {
    status: "ready",
    data: { ...current.data, assignments: current.data.assignments.map((a) => (a.id === id ? { ...a, submittedAt } : a)) },
  }));

  const change = (target: Assignment, submit: boolean) => {
    if (assignments.status !== "ready" || pending.current.has(target.id)) return;
    pending.current.add(target.id);
    const before = target.submittedAt;
    // 送る間はサーバの今の時刻を仮に入れる。答えが来たらサーバの時刻に替える
    patch(target.id, submit ? assignments.data.now : null);
    (submit ? submitAssignment(target.id) : withdrawAssignment(target.id)).then(
      (result) => {
        if (!alive.current) return;
        patch(target.id, result.submittedAt);
        setAnnounce(submit ? COPY.CP_733(target.title) : COPY.CP_735(target.title));
      },
      (error: unknown) => {
        if (!alive.current) return;
        patch(target.id, before);
        showToast(errorKind(error) === "rate" ? COPY.CP_752 : COPY.CP_753);
      },
    ).finally(() => pending.current.delete(target.id));
  };

  return {
    assignments,
    timetable,
    announce,
    reload: load,
    submit: (target: Assignment) => change(target, true),
    withdraw: (target: Assignment) => change(target, false),
  };
}

/** ファーストディスプレイの名前を押した時に、提出物の画面で focus を置く提出物 */
let focusRequest: string | null = null;
export const requestFocus = (id: string | null) => { focusRequest = id; };
export const takeFocusRequest = (): string | null => {
  const id = focusRequest;
  focusRequest = null;
  return id;
};
