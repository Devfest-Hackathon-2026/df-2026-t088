// CMP-032 囲む線。写真の上を指・ペン・マウスでなぞって囲む。キーボードと、線が無い時の1回押しでは四角で囲む（D-170、D-204）
// 座標はすべて写真の画素。表示の大きさ（枠に収めて縮んだ分）は、読み書きの時だけ換算する
import { useId, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { rectPath } from "./capture";
import type { Point, Rect } from "./types";

/** 前の点から表示の 4px 以上離れた時だけ点を足す（点が多すぎると重い） */
const MIN_POINT_GAP = 4;
/** 矢印キー 1 回の動き。画素ではなく表示の 8px */
const KEY_STEP = 8;
/** Enter で置く四角は、写真の内側 90% */
const INNER_RATIO = 0.9;

export interface LassoFrameProps {
  /** 写真の object URL */
  src: string;
  /** 写真の画素の大きさ */
  width: number;
  height: number;
  /** 今の線（閉じる前の点の列。閉じるのは描く側が始めの点へ戻す） */
  path: Point[];
  onPathChange: (path: Point[]) => void;
  /** 写真の枠の読み上げの名前（CP-875）と、操作の説明（CP-876） */
  label: string;
  description: string;
  /** 線が無い時に1回押すと、Enter と同じ四角を置く（PG-010。D-204）。ほかの画面は今までどおり押しただけでは何もしない */
  placeOnTap?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const toD = (points: Point[], close: boolean) => points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ") + (close ? " Z" : "");

export function LassoFrame({ src, width, height, path, onPathChange, label, description, placeOnTap = false }: LassoFrameProps) {
  const descId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  // なぞっている最中の点。離したら onPathChange へ渡して消す
  const [drawing, setDrawing] = useState<Point[] | null>(null);
  const drawingRef = useRef<Point[] | null>(null);
  // キーボードで置いた四角。なぞり直したら消える
  const [rect, setRect] = useState<Rect | null>(null);

  /** 表示 1px が写真の何画素か。測れない時（0）は 1 とする */
  const pixelsPerDisplay = () => {
    const box = svgRef.current?.getBoundingClientRect();
    return box && box.width > 0 ? width / box.width : 1;
  };

  /** 画面の座標を写真の画素にする。写真の外は縁へ寄せる */
  const toPoint = (event: PointerEvent<SVGSVGElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    const sx = box.width > 0 ? width / box.width : 1;
    const sy = box.height > 0 ? height / box.height : 1;
    return { x: clamp((event.clientX - box.left) * sx, 0, width), y: clamp((event.clientY - box.top) * sy, 0, height) };
  };

  const setDrawingPoints = (points: Point[] | null) => {
    drawingRef.current = points;
    setDrawing(points);
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrawingPoints([toPoint(event)]);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const points = drawingRef.current;
    if (!points) return;
    const next = toPoint(event);
    const last = points[points.length - 1];
    const gap = MIN_POINT_GAP * pixelsPerDisplay();
    if (Math.hypot(next.x - last.x, next.y - last.y) < gap) return;
    setDrawingPoints([...points, next]);
  };

  const finish = (event: PointerEvent<SVGSVGElement>, commit: boolean) => {
    const points = drawingRef.current;
    if (!points) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDrawingPoints(null);
    if (!commit) return;
    if (points.length >= 3) {
      setRect(null);
      onPathChange(points);
    } else if (placeOnTap && path.length < 3) {
      // 線が無い時に1回押しただけなら、Enter と同じ四角を置く。読み上げ（TalkBack など）のダブルタップは
      // 写真の真ん中の1点のタップとしてしか届かず、なぞれないため（D-204）
      placeInner();
    }
    // 線がある時の 3 つ未満は、ちょんと触れただけ。前の線をそのまま残す
  };

  const place = (next: Rect) => {
    setRect(next);
    onPathChange(rectPath(next));
  };

  /** 写真の内側 90% の四角を置く */
  const placeInner = () => {
    const w = width * INNER_RATIO;
    const h = height * INNER_RATIO;
    place({ x: (width - w) / 2, y: (height - h) / 2, width: w, height: h });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      placeInner();
      return;
    }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!dir || !rect || path.length < 3) return;
    event.preventDefault();
    const step = KEY_STEP * pixelsPerDisplay();
    if (event.shiftKey) {
      // 右下の角を動かす。左上は動かさない
      place({
        ...rect,
        width: clamp(rect.width + dir[0] * step, step, width - rect.x),
        height: clamp(rect.height + dir[1] * step, step, height - rect.y),
      });
    } else {
      place({
        ...rect,
        x: clamp(rect.x + dir[0] * step, 0, width - rect.width),
        y: clamp(rect.y + dir[1] * step, 0, height - rect.height),
      });
    }
  };

  const shown = drawing ?? path;
  const closed = drawing === null && shown.length >= 3;
  const dim = closed ? `M0 0H${width}V${height}H0Z ${toD(shown, true)}` : null;

  return (
    <div
      className="lasso"
      role="group"
      tabIndex={0}
      aria-label={label}
      aria-describedby={descId}
      data-state={drawing ? "drawing" : closed ? (rect ? "rect" : "closed") : "empty"}
      onKeyDown={onKeyDown}
    >
      <span id={descId} className="lasso__desc">{description}</span>
      <div className="lasso__stage">
        <img className="lasso__img" src={src} alt="" draggable={false} />
        <svg
          ref={svgRef}
          className="lasso__svg"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => finish(event, true)}
          onPointerCancel={(event) => finish(event, false)}
        >
          {dim && <path className="lasso__dim" d={dim} fillRule="evenodd" />}
          {shown.length >= 2 && (
            <>
              <path className="lasso__edge" d={toD(shown, closed)} vectorEffect="non-scaling-stroke" />
              <path className="lasso__line" d={toD(shown, closed)} vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        {rect && closed && [[0, 0], [1, 0], [1, 1], [0, 1]].map(([cx, cy]) => (
          <span
            key={`${cx}${cy}`}
            className="lasso__handle"
            aria-hidden="true"
            style={{ left: `${((rect.x + cx * rect.width) / width) * 100}%`, top: `${((rect.y + cy * rect.height) / height) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
