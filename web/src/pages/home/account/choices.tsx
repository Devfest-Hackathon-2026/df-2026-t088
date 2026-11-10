import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { AvatarPhoto, stampBody } from "../../../components/AvatarPhoto";
import { Icon } from "../../../components/Icon";
import type { SubjectId } from "../../../data";
import type { PhotoLook } from "../../../photo";

// CMP-028 アバターのタブの候補（CMP-009 の着けはずしを小さくした物、ほかは radio）。絵で見せ、名前は読み上げにだけ使う（D-198）

export interface Choice<T extends string> {
  id: T;
  /** 読み上げの名前 */
  label: string;
  picture: ReactNode;
}

interface RadioChoicesProps<T extends string> {
  /** radiogroup の名前 */
  label: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange: (id: T) => void;
}

/** 選んでいる1つだけが Tab で止まり、矢印で選びが移る。選ぶのは下書きだけ */
export function RadioChoices<T extends string>({ label, choices, value, onChange }: RadioChoicesProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const checked = choices.some((choice) => choice.id === value) ? value : choices[0]?.id;
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = choices.findIndex((choice) => choice.id === checked);
    const next = choices[(index + step + choices.length) % choices.length];
    onChange(next.id);
    groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[choices.indexOf(next)]?.focus();
  };
  return (
    <div ref={groupRef} role="radiogroup" aria-label={label} className="account-choices" onKeyDown={handleKeyDown}>
      {choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          role="radio"
          aria-checked={choice.id === value}
          aria-label={choice.label}
          tabIndex={choice.id === checked ? 0 : -1}
          className="account-choice"
          onClick={() => onChange(choice.id)}
        >
          {choice.picture}
        </button>
      ))}
    </div>
  );
}

/** 小さく見せる。中身は本物の写真の絵（AvatarPhoto）を縮めた物 */
function Scaled({ kind, children }: { kind: "top" | "cheki"; children: ReactNode }) {
  return (
    <span className={`account-scaled account-scaled--${kind}`} aria-hidden="true">
      <span className="account-scaled__inner">{children}</span>
    </span>
  );
}

export const posePicture = (look: PhotoLook, pose: PhotoLook["pose"]) => (
  <Scaled kind="top"><AvatarPhoto look={{ ...look, pose }} shape="top" /></Scaled>
);

export const facePicture = (look: PhotoLook, face: PhotoLook["face"]) => (
  <span className="account-choice__face" aria-hidden="true"><AvatarPhoto look={{ ...look, face }} shape="face" /></span>
);

export const bgPicture = (look: PhotoLook, bg: PhotoLook["bg"]) => (
  <Scaled kind="top"><AvatarPhoto look={{ ...look, bg }} shape="top" /></Scaled>
);

export const framePicture = (look: PhotoLook, frame: PhotoLook["frame"]) => (
  <Scaled kind="cheki"><AvatarPhoto look={{ ...look, frame, stamp: "none" }} shape="cheki" /></Scaled>
);

// スタンプの絵。AvatarPhoto の印と同じ形（32 x 32）を候補の大きさで描く
const PEN = { stroke: "var(--color-border-strong)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function stampPicture(stamp: PhotoLook["stamp"], subject?: SubjectId): ReactNode {
  // なしは斜線を引いた丸。ほかは写真の印と同じ絵（AvatarPhoto の stampBody）
  const body = stampBody(stamp, subject) ?? <path {...PEN} stroke="var(--color-muted-fg)" fill="none" d="M16 4a12 12 0 1 0 .01 0M7.5 24.5l17-17" />;
  return <svg className="account-choice__stamp" viewBox="0 0 32 32" aria-hidden="true">{body}</svg>;
}

/** 鍵の候補（そうび）の絵。点線の四角に鍵 */
export function LockedPicture() {
  return <span className="account-choice__lock" aria-hidden="true"><Icon name="lock" /></span>;
}
