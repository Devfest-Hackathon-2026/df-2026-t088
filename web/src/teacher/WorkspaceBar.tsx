// 先生の上の並びの右側。入っているとき、承認キーの欄の代わりに出す（学級の名前・コード・子ども用のリンク・ログアウト）
import { useEffect, useId, useState, type FormEvent } from "react";
import { WORKSPACE_COPY } from "./copy";
import { joinUrl, logoutTeacher, renameWorkspace, setChildCapture, useTeacherSession, type Workspace } from "./workspace";
import "./AdminPages.css";

const NAME_MAX = 30;
const COPIED_MS = 2_000;

export function TeacherWorkspaceBar({ workspace }: { workspace: Workspace }) {
  const { session, setWorkspace } = useTeacherSession();
  const guest = session.guest === true;
  const id = useId();
  const [name, setName] = useState(workspace.name);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState("");
  const url = joinUrl(workspace.joinCode);

  useEffect(() => setName(workspace.name), [workspace.name]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function commitName(event?: FormEvent) {
    event?.preventDefault();
    const next = name.trim();
    if (next === "" || next === workspace.name) { setName(workspace.name); return; }
    try {
      setWorkspace(await renameWorkspace(next));
      setProblem("");
    } catch {
      setName(workspace.name);
      setProblem(WORKSPACE_COPY.renameFailed);
    }
  }

  async function toggleChildCapture(on: boolean) {
    try {
      setWorkspace(await setChildCapture(on));
      setProblem("");
    } catch {
      setProblem(WORKSPACE_COPY.childCaptureFailed);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setProblem("");
    } catch {
      setProblem(WORKSPACE_COPY.copyFailed);
    }
  }

  async function logout() {
    // お試しの学級は、とじると二度と開けない。押す前に確かめる
    if (guest && !window.confirm(WORKSPACE_COPY.confirmCloseClass)) return;
    // 失敗したら読み直さない（読み直すと同じ学級のままで、効かなかったことが分からない）
    try {
      await logoutTeacher();
    } catch {
      setProblem(guest ? WORKSPACE_COPY.closeClassFailed : WORKSPACE_COPY.logoutFailed);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="teacher-workspace">
      <form className="teacher-workspace__field" onSubmit={(event) => void commitName(event)}>
        <label htmlFor={`${id}-name`}>{WORKSPACE_COPY.nameLabel}</label>
        <input id={`${id}-name`} className="teacher-workspace__name" type="text" maxLength={NAME_MAX} autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} onBlur={() => void commitName()} />
      </form>
      <span className="teacher-workspace__field teacher-workspace__field--code">
        {WORKSPACE_COPY.codeLabel}
        <strong className="teacher-workspace__code">{workspace.joinCode}</strong>
      </span>
      <span className="teacher-workspace__field teacher-workspace__field--link">
        <label htmlFor={`${id}-link`}>{WORKSPACE_COPY.linkLabel}</label>
        <input id={`${id}-link`} className="teacher-workspace__link" type="text" readOnly value={url} onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.currentTarget.select()} />
        <button type="button" className="teacher-workspace__button" onClick={() => void copyLink()}>{copied ? WORKSPACE_COPY.copied : WORKSPACE_COPY.copy}</button>
      </span>
      <span className="teacher-workspace__field teacher-workspace__capture">
        <label className="teacher-workspace__check">
          <input type="checkbox" checked={workspace.childCapture === true} aria-describedby={`${id}-capture-note`} onChange={(event) => void toggleChildCapture(event.target.checked)} />
          {WORKSPACE_COPY.childCaptureLabel}
        </label>
        <small id={`${id}-capture-note`} className="teacher-workspace__note">{WORKSPACE_COPY.childCaptureNote}</small>
      </span>
      <button type="button" className="teacher-workspace__button" onClick={() => void logout()}>{guest ? WORKSPACE_COPY.closeClass : WORKSPACE_COPY.logout}</button>
      {problem && <p className="teacher-workspace__status" role="alert">{problem}</p>}
    </div>
  );
}
