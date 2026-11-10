// CMP-034 月の図。月は地球のまわりの道を反時計回りに進み、いつも太陽の側（図の左）が光る。
// 位置は 0°（太陽の側）から 45° 刻みで、ドラッグでも回せる（離すと近い 45° に寄る。押すだけでも全部進められる）
import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import { COPY } from "../../../copy";
import { useText } from "../../../grade";
import { moonShape, snapMoonAngle } from "../templates";

const CX = 150;
const CY = 150;
const ORBIT = 95;
const MOON_R = 22;

/** 地球から見た月の光る部分の形（反時計回りの角度。0° = 新月、180° = 満月） */
export function litPath(angle: number, r: number, cx: number, cy: number): string | null {
  const a = ((angle % 360) + 360) % 360;
  if (a === 0) return null;
  const k = Math.cos((a * Math.PI) / 180);
  const rx = Math.abs(k) * r;
  const waxing = a < 180;
  // 光る側の半円（満ちる間は右、欠ける間は左）
  const outer = `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${waxing ? 1 : 0} ${cx} ${cy + r}`;
  // 影との境目。半月より細い（k>0）なら光る側へふくらむ
  const crescent = k > 0;
  const sweep = waxing === crescent ? 0 : 1;
  return `${outer} A ${rx} ${r} 0 0 ${sweep} ${cx} ${cy - r} Z`;
}

/** 前の表示の角度から、いちばん短い回り方で新しい角度へ（0° をまたいでも逆回りしない） */
function shortestDelta(from: number, to: number): number {
  const d = ((((to - from) % 360) + 540) % 360) - 180;
  return d === -180 ? 180 : d;
}

interface MoonFigureProps {
  angle: number;
  /** ドラッグで離した時の位置（45° に寄せた値） */
  onDrag: (angle: number) => void;
}

export function MoonFigure({ angle, onDrag }: MoonFigureProps) {
  const t = useText();
  const svgRef = useRef<SVGSVGElement>(null);
  // 表示の角度は 360° をまたいで積み上げる（CSS の transition が逆回りしないように）
  const [shown, setShown] = useState(angle);
  const [dragging, setDragging] = useState<number | null>(null);
  const gap = shortestDelta(shown, angle);
  if (dragging === null && Math.abs(gap) > 0.001) setShown(shown + gap);

  const shape = moonShape(angle);
  const label = t(COPY.CP_847(shape.where, shape.name));
  const rotation = dragging ?? shown;
  const path = litPath(angle, 40, 0, 0);

  const pointerAngle = (event: PointerEvent): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    if (box.width === 0) return null;
    const scale = 300 / box.width;
    const x = (event.clientX - box.left) * scale - CX;
    const y = (event.clientY - box.top) * scale - CY;
    // 太陽の側（左）が 0°、下が 90°（反時計回り）
    return (((Math.atan2(y, -x) * 180) / Math.PI) + 360) % 360;
  };
  const onPointerDown = (event: PointerEvent<SVGGElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const a = pointerAngle(event);
    if (a !== null) setDragging(a);
  };
  const onPointerMove = (event: PointerEvent<SVGGElement>) => {
    if (dragging === null) return;
    const a = pointerAngle(event);
    if (a !== null) setDragging(a);
  };
  const onPointerUp = () => {
    if (dragging === null) return;
    setShown(dragging);
    setDragging(null);
    onDrag(snapMoonAngle(dragging));
  };

  return (
    <div className="moon">
      <svg ref={svgRef} className={`moon__svg${dragging === null ? "" : " is-dragging"}`} viewBox="0 0 300 300" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        {[110, 130, 150].map((y) => (
          <line key={y} x1="8" y1={y} x2="48" y2={y} stroke="var(--color-figure-light)" strokeWidth="5" strokeLinecap="round" />
        ))}
        <text x="4" y="40" textAnchor="start" fontSize="16" fill="var(--color-fg-strong)">{t(COPY.CP_840)}</text>
        <circle cx={CX} cy={CY} r={ORBIT} fill="none" stroke="var(--color-border)" strokeWidth="2" strokeDasharray="4 6" />
        <circle cx={CX} cy={CY} r="34" fill="var(--color-figure-earth)" stroke="var(--color-border-strong)" strokeWidth="2" />
        <text x={CX} y={CY + 58} textAnchor="middle" fontSize="16" fill="var(--color-fg-strong)">{t(COPY.CP_855)}</text>
        {/* 道に沿って動かすため、地球を中心に回す */}
        <g className="moon__orbit" style={{ transformOrigin: `${CX}px ${CY}px`, transform: `rotate(${-rotation}deg)` }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {/* 公転で回った分を戻し、光る側がいつも左（太陽の側）を向くようにする */}
          <g className="moon__body" style={{ transformOrigin: `${CX - ORBIT}px ${CY}px`, transform: `rotate(${rotation}deg)` }}>
            <circle cx={CX - ORBIT} cy={CY} r={MOON_R} fill="var(--color-figure-moon-dark)" stroke="var(--color-border-strong)" strokeWidth="2" />
            <path d={`M ${CX - ORBIT} ${CY - MOON_R} A ${MOON_R} ${MOON_R} 0 0 0 ${CX - ORBIT} ${CY + MOON_R} Z`} fill="var(--color-figure-light)" />
            <circle cx={CX - ORBIT} cy={CY} r={MOON_R + 10} fill="transparent" />
          </g>
        </g>
      </svg>
      <div className="moon__earth-view">
        <p className="moon__earth-view-title">{t(COPY.CP_856)}</p>
        <svg viewBox="-50 -50 100 100" aria-hidden="true" className="moon__shape">
          <circle r="40" fill="var(--color-figure-moon-dark)" stroke="var(--color-border-strong)" strokeWidth="2" />
          {path && <path d={path} fill="var(--color-figure-light)" />}
          <circle r="40" fill="none" stroke="var(--color-border-strong)" strokeWidth="2" />
        </svg>
        <p className="moon__shape-name">{t(shape.name)}</p>
      </div>
    </div>
  );
}
