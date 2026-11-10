import type { ReactElement } from "react";
import type { SubjectId } from "../data";
import type { PhotoLook } from "../photo";
import { AvatarFigure } from "./Avatar";
import "./AvatarPhoto.css";

// アバターの写真（CMP-040）。画像は作らず、選び方の id からその場で SVG に描く
export type PhotoShape = "face" | "top" | "cheki" | "roster";

interface AvatarPhotoProps {
  look: PhotoLook;
  shape: PhotoShape;
  /** スタンプ「subject」の印にする教科。sansu・kokugo・rika だけ描く */
  stampSubject?: SubjectId;
}

// 全身の絵は 80 x 96。正方形の写真には左右に 8 ずつ足す
const BODY_VIEW = { x: -8, y: 0, w: 96, h: 96 };
// 頭のあたり（帽子・かんむりが見える範囲）
const HEAD_VIEW = { x: 16, y: 0, w: 48, h: 48 };

type View = typeof BODY_VIEW;

/** 方眼の線。紙の背景に引く */
function gridPath({ x, y, w, h }: View, step = 8): string {
  let d = "";
  for (let gx = Math.ceil(x / step) * step; gx < x + w; gx += step) d += `M${gx} ${y}v${h}`;
  for (let gy = Math.ceil(y / step) * step; gy < y + h; gy += step) d += `M${x} ${gy}h${w}`;
  return d;
}

function Background({ bg, view }: { bg: PhotoLook["bg"]; view: View }) {
  const fill = bg === "grid" ? "var(--color-bg)" : `var(--color-subject-${bg})`;
  return (
    <>
      <rect x={view.x} y={view.y} width={view.w} height={view.h} fill={fill} />
      {bg === "grid" && <path d={gridPath(view)} stroke="var(--color-grid)" strokeWidth="1" fill="none" />}
    </>
  );
}

const STAR = "m16 4 3.6 7.6 8.4 1-6.2 5.7 1.7 8.3L16 22.5l-7.5 4.1 1.7-8.3L4 12.6l8.4-1z";
const STAMP_PEN = { stroke: "var(--color-border-strong)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const SUBJECT_STAMP: Partial<Record<SubjectId, ReactElement>> = {
  sansu: <text x="16" y="23" textAnchor="middle" fontSize="20" fill="var(--color-fg-strong)" fontFamily="var(--font-hand)">½</text>,
  kokugo: <text x="16" y="22" textAnchor="middle" fontSize="18" fill="var(--color-fg-strong)" fontFamily="var(--font-hand)">漢</text>,
  // フラスコの線画
  rika: <path {...STAMP_PEN} fill="none" d="M13 6h6M14 6v7L8 24h16l-6-11V6M11 19h10" />,
};

/** スタンプの中身（viewBox 0 0 32 32）。描く物が無ければ null。CMP-028 の候補の絵も使う */
export function stampBody(stamp: PhotoLook["stamp"], subject?: SubjectId): ReactElement | null {
  let body: ReactElement | null = null;
  if (stamp === "hanamaru") {
    // 花丸：まわりに小さな丸を8つ、まん中に丸
    body = (
      <g fill="var(--red-400)" {...STAMP_PEN}>
        {Array.from({ length: 8 }, (_, i) => (
          <circle key={i} cx={16 + 9 * Math.cos((i * Math.PI) / 4)} cy={16 + 9 * Math.sin((i * Math.PI) / 4)} r="4.5" />
        ))}
        <circle cx="16" cy="16" r="7" fill="var(--color-bg)" />
      </g>
    );
  } else if (stamp === "star") {
    body = <path d={STAR} fill="var(--color-now)" {...STAMP_PEN} />;
  } else if (stamp === "heart") {
    body = <path d="M16 27C4 18 5 8 11 7c3-.5 5 1.5 5 4 0-2.5 2-4.5 5-4 6 1 7 11-5 20z" fill="var(--red-400)" {...STAMP_PEN} />;
  } else if (stamp === "subject" && subject && SUBJECT_STAMP[subject]) {
    body = (
      <>
        <circle cx="16" cy="16" r="14" fill={`var(--color-subject-${subject})`} {...STAMP_PEN} />
        {SUBJECT_STAMP[subject]}
      </>
    );
  }
  return body;
}

/** 絵の右下に置く印（32 x 32）。描く物が無ければ null */
function Stamp({ stamp, subject }: { stamp: PhotoLook["stamp"]; subject?: SubjectId }) {
  const body = stampBody(stamp, subject);
  if (!body) return null;
  return (
    <svg className="avatar-photo__stamp" viewBox="0 0 32 32" aria-hidden="true">
      {body}
    </svg>
  );
}

/** 飾りなので読み上げない */
export function AvatarPhoto({ look, shape, stampSubject }: AvatarPhotoProps) {
  const { pose, face, bg, frame, stamp, gear } = look;
  const head = shape === "face" || shape === "roster";
  const view = head ? HEAD_VIEW : BODY_VIEW;
  const picture = (
    <svg
      className={`avatar-photo avatar-photo--${head ? shape : "square"}`}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      aria-hidden="true"
    >
      <Background bg={bg} view={view} />
      <AvatarFigure gear={gear} pose={pose} face={face} />
    </svg>
  );
  if (shape !== "cheki") return picture;
  return (
    <div className={`avatar-photo-cheki avatar-photo-cheki--${frame}`} aria-hidden="true">
      {picture}
      {frame === "star" && (
        <svg className="avatar-photo-cheki__stars" viewBox="0 0 96 16">
          {[16, 48, 80].map((cx) => (
            <path key={cx} d={STAR} transform={`translate(${cx - 8} 0) scale(.5)`} fill="var(--color-now)" stroke="var(--color-border-strong)" strokeWidth="2" strokeLinejoin="round" />
          ))}
        </svg>
      )}
      <Stamp stamp={stamp} subject={stampSubject} />
    </div>
  );
}
