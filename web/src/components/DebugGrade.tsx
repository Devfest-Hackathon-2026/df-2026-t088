import { useEffect, useRef, useState } from "react";
import { COPY } from "../copy";
import { GRADES } from "../data/kanji-grades";
import { DEFAULT_GRADE, useGradeControl, useText } from "../grade";
import "./DebugGrade.css";

/**
 * CMP-027 デバッグの学年（開発中だけ。D-144）。右下に {n}年 の小さなボタンを置き、開くと1〜6年を選べる。
 * 子どもには見せないので、App が import.meta.env.DEV の分岐の中で lazy に読む（本番のビルドに入れない）。
 * 開いているかどうかは残さない。学年を押しても閉じず、もう一度ボタンか Esc で閉じる
 */
export default function DebugGrade() {
  const t = useText();
  const control = useGradeControl();
  const current = control?.grade ?? DEFAULT_GRADE;
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="debug-grade">
      {open && (
        <div className="debug-grade__box" role="radiogroup" aria-label={t(COPY.CP_267)}>
          {GRADES.map((grade) => {
            const isChecked = grade === current;
            return (
              <button
                key={grade}
                type="button"
                role="radio"
                aria-checked={isChecked}
                className={`debug-grade__option${isChecked ? " is-checked" : ""}`}
                onClick={() => control?.setGrade(grade)}
              >
                {t(COPY.CP_268(grade))}
              </button>
            );
          })}
        </div>
      )}
      <button
        ref={toggleRef}
        type="button"
        className="debug-grade__toggle"
        aria-expanded={open}
        aria-label={t(COPY.CP_783(current))}
        onClick={() => setOpen((value) => !value)}
      >
        {current}年
      </button>
    </div>
  );
}
