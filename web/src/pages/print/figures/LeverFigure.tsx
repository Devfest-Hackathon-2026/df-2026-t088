// CMP-033 てこの図。傾きは水平か ±12° の 3 つだけで、差の大きさで角度を変えない（読みとりの数で比べてもらう）
import { COPY } from "../../../copy";
import { useText } from "../../../grade";
import type { LeverTilt } from "../templates";

const PIVOT_X = 200;
const BEAM_Y = 150;
const POS_GAP = 30;
const TILT_DEG: Record<LeverTilt, number> = { balanced: 0, left: -12, right: 12 };

interface LeverFigureProps {
  left: { pos: number; g: number };
  rightPos: number;
  /** 右に吊るした重さ。まだ無い間は undefined */
  rightG: number | undefined;
  tilt: LeverTilt;
}

export function LeverFigure({ left, rightPos, rightG, tilt }: LeverFigureProps) {
  const t = useText();
  const deg = TILT_DEG[tilt];
  const label = t(COPY.CP_830(left.pos, left.g, rightPos, rightG, tilt));
  const originStyle = { transformOrigin: `${PIVOT_X}px ${BEAM_Y}px` };

  // おもりは、うでと一緒に動くが、まっすぐ下がるよう吊るし位置を中心に逆へ回す
  const weight = (pos: number, g: number, side: -1 | 1) => {
    const x = PIVOT_X + side * pos * POS_GAP;
    return (
      <g className="lever__weight-hang" style={{ transformOrigin: `${x}px ${BEAM_Y}px`, transform: `rotate(${-deg}deg)` }}>
        <line x1={x} y1={BEAM_Y} x2={x} y2={BEAM_Y + 30} stroke="var(--color-border-strong)" strokeWidth="2" />
        <rect x={x - 24} y={BEAM_Y + 30} width="48" height="34" rx="4" fill="var(--color-figure-weight)" stroke="var(--color-border-strong)" strokeWidth="2" />
        <text x={x} y={BEAM_Y + 53} textAnchor="middle" fontSize="16" fontWeight="800" fill="var(--color-fg-strong)">{t(COPY.CP_831(g))}</text>
      </g>
    );
  };

  return (
    <svg className="lever" viewBox="0 0 400 260" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      <polygon points={`${PIVOT_X},${BEAM_Y + 6} ${PIVOT_X - 22},${BEAM_Y + 80} ${PIVOT_X + 22},${BEAM_Y + 80}`} fill="var(--color-fg)" />
      <rect x={PIVOT_X - 50} y={BEAM_Y + 80} width="100" height="10" rx="3" fill="var(--color-fg)" />
      <g className="lever__beam" style={{ ...originStyle, transform: `rotate(${deg}deg)` }}>
        <rect x="10" y={BEAM_Y - 8} width="380" height="16" rx="4" fill="var(--color-figure-beam)" stroke="var(--color-border-strong)" strokeWidth="2" />
        {[1, 2, 3, 4, 5, 6].flatMap((p) =>
          ([-1, 1] as const).map((side) => (
            <text key={`${side}${p}`} x={PIVOT_X + side * p * POS_GAP} y={BEAM_Y - 14} textAnchor="middle" fontSize="16" fill="var(--color-fg-strong)">{p}</text>
          )),
        )}
        {weight(left.pos, left.g, -1)}
        {rightG !== undefined && weight(rightPos, rightG, 1)}
      </g>
    </svg>
  );
}
