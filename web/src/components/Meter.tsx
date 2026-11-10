import type { CSSProperties } from "react";
import "./Meter.css";

interface MeterProps {
  /** 塗りの割合（0〜1） */
  ratio: number;
  /** 読み上げの名前。CP-204 か CP-205 を渡す */
  label: string;
  /** 塗りの色。省略すると今ここの色（アバター用）。教科はトークン名を渡す */
  color?: string;
}

export function Meter({ ratio, label, color }: MeterProps) {
  const style = {
    "--meter-ratio": Math.min(Math.max(ratio, 0), 1),
    ...(color ? { "--meter-color": color } : {}),
  } as CSSProperties;
  return (
    <span className="meter" role="img" aria-label={label} style={style}>
      <span className="meter-fill" />
    </span>
  );
}
