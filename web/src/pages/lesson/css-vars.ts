import type { CSSProperties } from "react";

/** 目盛りの整数を CSS の変数で渡す。百分率への変換は lesson.css に任せる */
export function cssVars(values: Record<string, number>): CSSProperties {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [`--${name}`, value])) as CSSProperties;
}
