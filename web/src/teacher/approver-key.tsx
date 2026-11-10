import { useId, useSyncExternalStore } from "react";
import { ADMIN_COPY } from "./copy";
import "./AdminPages.css";

let approverKey = "";
const listeners = new Set<() => void>();

export const getApproverKey = () => approverKey;
export const setApproverKey = (value: string) => {
  if (approverKey === value) return;
  approverKey = value;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const useApproverKey = () => useSyncExternalStore(subscribe, getApproverKey, () => "");

// 説明の文は画面に出さず、欄の title と読み上げ用の補足に回す（1 行に収めるため）
export function TeacherApproverKey() {
  const key = useApproverKey();
  const id = useId();
  const note = `${ADMIN_COPY.approverKeyNote}この画面を閉じると消えます。${ADMIN_COPY.editLoginOnly}`;
  return (
    <div className="teacher-approver-key">
      <label htmlFor={`${id}-input`}>承認キー</label>
      <input
        id={`${id}-input`}
        type="password"
        autoComplete="off"
        placeholder={ADMIN_COPY.approverKeyPlaceholder}
        title={note}
        aria-describedby={`${id}-note`}
        value={key}
        onChange={(event) => setApproverKey(event.target.value)}
      />
      <span id={`${id}-note`} className="visually-hidden">{note}</span>
    </div>
  );
}
