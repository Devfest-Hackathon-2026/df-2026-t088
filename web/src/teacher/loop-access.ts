// 学びの輪の部品が、API の呼び出しに付ける承認キーと、権限が無いときの文を決める。
// 学級に入っている先生は Cookie のまま呼ぶ（承認キーは付けず、求めない）。入っていないときは今のまま（キーがあれば付ける）
import { useApproverKey } from "./approver-key";
import { WORKSPACE_COPY } from "./copy";
import { useTeacherSession } from "./workspace";

export function useLoopAccess() {
  const approverKey = useApproverKey();
  const inWorkspace = useTeacherSession().session.workspace !== undefined;
  const headers: Record<string, string> = !inWorkspace && approverKey.trim() ? { "x-approver-key": approverKey } : {};
  /** 401 のときの文。入っていれば、ログインが切れたことを知らせる */
  const unauthorizedText = (keyText: string): string => (inWorkspace ? WORKSPACE_COPY.sessionEnded : keyText);
  return { approverKey, headers, inWorkspace, unauthorizedText };
}
