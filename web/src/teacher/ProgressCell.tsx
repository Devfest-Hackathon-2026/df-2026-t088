// 進みのマス（CMP-036）。上に「終えた/全部」の数字、下に細い棒。読み上げは CP-1106 の文だけ。
// 学級の表（SCR-T10）では数字を出さず、太い棒だけで見せる（D-182。ざっと眺めるため）
import { CLASS_COPY } from "./copy";
import "./ProgressCell.css";

export function ProgressCell({ label, done, total, numbers = true }: { label: string; done: number; total: number; numbers?: boolean }) {
  const shown = Math.min(done, total);
  const percent = total > 0 ? (shown / total) * 100 : 0;
  return (
    <span className={numbers ? "progress-cell" : "progress-cell progress-cell--bar-only"} role="img" aria-label={CLASS_COPY.cellLabel(label, total, shown)}>
      {numbers && <span className={shown >= total && total > 0 ? "progress-cell__num progress-cell__num--full" : "progress-cell__num"} aria-hidden="true">
        {shown}/{total}
      </span>}
      <span className="progress-cell__bar" aria-hidden="true">
        <span className="progress-cell__fill" style={{ width: `${percent}%` }} />
      </span>
    </span>
  );
}
