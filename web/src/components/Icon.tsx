import type { ReactElement } from "react";
import type { IconName } from "../data";

// 手描き風の絵。素材を外から持ち込まず、すべて SVG で描いている（mock/d-sugoroku/doodles.js の ICONS）
const PEN = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

type IconKey = IconName | "chevron-down";

const ICONS: Record<IconKey, ReactElement> = {
  check: <svg viewBox="0 0 32 32" aria-hidden="true"><path {...PEN} strokeWidth={4} d="m7 17 6 7L25 8" /></svg>,
  lock: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path {...PEN} d="M10 15v-4c0-8 12-8 12 0v4" />
      <rect {...PEN} x="7" y="15" width="18" height="12" rx="3" />
    </svg>
  ),
  "chevron-down": <svg viewBox="0 0 24 24" aria-hidden="true"><path {...PEN} strokeWidth={3} d="m5 9 7 7 7-7" /></svg>,
  training: <svg viewBox="0 0 40 40" aria-hidden="true"><path {...PEN} d="M13 20h14M6 13v14M11 9v22M29 9v22M34 13v14" /></svg>,
  advanced: <svg viewBox="0 0 40 40" aria-hidden="true"><path {...PEN} d="M4 33 16 13l7 10 4-5 9 15zM16 13V4l8 3-8 3" /></svg>,
  star: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="var(--yellow-300)" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" d="m24 4 6 13 14 2-10 10 3 15-13-7-13 7 3-15L4 19l14-2z" />
    </svg>
  ),
  // 学校で丸をもらう感じを出すため、章のクリアは花丸で示す
  hanamaru: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="none" stroke="var(--color-stamp)" strokeWidth="3" strokeLinecap="round" d="M24 24c3-4 8-1 6 4s-11 5-13-2 5-14 13-12 12 12 8 20-16 11-24 5-9-20-1-27 22-8 30-1" />
    </svg>
  ),
};

/** 飾りの絵。意味は周りの文字で伝える */
export function Icon({ name }: { name: IconKey }) {
  return ICONS[name];
}
