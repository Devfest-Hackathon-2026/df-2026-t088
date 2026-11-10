import type { ReactElement } from "react";
import type { GearId } from "../data";
import { DEFAULT_LOOK, usePhoto } from "../photo";
import type { FaceId, PoseId } from "../photo";
import { AvatarPhoto } from "./AvatarPhoto";
import "./Avatar.css";

// 手描き風の棒人間（mock/d-sugoroku/doodles.js）。装備は体の後ろと前に分けて重ねる
const PEN = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

// マントとつばさは体より後ろに描く
const BACK_GEAR: Partial<Record<GearId, ReactElement>> = {
  wings: <path {...PEN} fill="var(--color-bg)" d="M22 44C8 34 4 46 6 58c6-3 10-3 17-1M58 44c14-10 18 2 16 14-6-3-10-3-17-1" />,
  cape: <path d="M31 42 19 80c12 5 30 5 42 0L49 42z" fill="var(--red-400)" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />,
};

const FRONT_GEAR: Partial<Record<GearId, ReactElement>> = {
  pencil: (
    <>
      <path {...PEN} d="m63 66 7-30" />
      <path d="m70 36 2-7 3 6-5 1z" fill="var(--yellow-300)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </>
  ),
  hat: <path d="M21 21c8-4 30-4 38 0-4-8-8-16-19-17C29 5 25 13 21 21z" fill="var(--teal-300)" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />,
  crown: <path d="m26 15-2-13 9 7 7-8 7 8 9-7-2 13c-9-3-19-3-28 0z" fill="var(--yellow-300)" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />,
};

// ロッカーの棚に置く絵。アバターの線をそのまま使い、viewBox でその装備の部分だけを切り出す
const GEAR_VIEWS: Record<GearId, string> = {
  pencil: "46 24 40 48",
  hat: "16 0 48 26",
  cape: "14 38 52 50",
  wings: "0 30 80 34",
  crown: "20 0 40 20",
};

// ポーズごとの手足の線（CMP-040）。stand は今の棒人間と同じ線。hand は右手の先で、えんぴつをそこへ寄せる
const STAND_HAND = [63, 66] as const;
const POSES: Record<PoseId, { d: string; hand: readonly [number, number]; lift?: number }> = {
  stand: { d: "M40 45v26M40 52 25 63M40 52l23 14M40 71 30 91M40 71l10 20", hand: STAND_HAND },
  // 右手を上げる
  wave: { d: "M40 45v26M40 52 25 63M40 52l12-4 6-10M40 71 30 91M40 71l10 20", hand: [58, 38] },
  // 両手を上げる
  banzai: { d: "M40 45v26M40 52 26 36M40 52l14-16M40 71 30 91M40 71l10 20", hand: [54, 36] },
  // 体を前に倒し、手と足を前後に開く
  run: { d: "M40 45 43 71M41 52 27 58M41 52l16-8M43 71 29 86M43 71l17 14", hand: [57, 44] },
  // 右手を頭の横に上げ、指2本を短い線で
  peace: { d: "M40 45v26M40 52 25 63M40 52l16-6 4-12M60 34 57 25M60 34l5-8M40 71 30 91M40 71l10 20", hand: [60, 34] },
  // 右手をひじで曲げてあごへ
  think: { d: "M40 45v26M40 52 25 63M40 52l14 6-8-15M40 71 30 91M40 71l10 20", hand: [46, 43] },
  // ひざを曲げ、手を軽く上げる。全体は描く所で少し上へ
  jump: { d: "M40 45v26M40 52 26 44M40 52l14-8M40 71 27 78 31 88M40 71l13 7-3 10", hand: [54, 44], lift: 3 },
};

// かおごとの目・口（CMP-040）。smile は今の顔と同じ線
const FACES: Record<FaceId, ReactElement> = {
  smile: (
    <>
      <circle cx="34" cy="27" r="2" fill="currentColor" />
      <circle cx="46" cy="27" r="2" fill="currentColor" />
      <path {...PEN} d="M34 34c4 4 8 4 12 0" />
    </>
  ),
  // 右目を線に
  wink: (
    <>
      <circle cx="34" cy="27" r="2" fill="currentColor" />
      <path {...PEN} strokeWidth={2.5} d="M43 27h6" />
      <path {...PEN} d="M34 34c4 4 8 4 12 0" />
    </>
  ),
  // 大きめの丸い目と、丸い口
  surprise: (
    <>
      <circle cx="34" cy="27" r="3.5" fill="currentColor" />
      <circle cx="46" cy="27" r="3.5" fill="currentColor" />
      <circle cx="40" cy="37" r="3.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </>
  ),
  // 眉を足し、口はまっすぐ
  proud: (
    <>
      <circle cx="34" cy="28" r="2" fill="currentColor" />
      <circle cx="46" cy="28" r="2" fill="currentColor" />
      <path {...PEN} strokeWidth={2.5} d="M29 22l9 2M51 22l-9 2" />
      <path {...PEN} d="M35 36h10" />
    </>
  ),
};

const wornParts = (table: Partial<Record<GearId, ReactElement>>, gear: GearId[], pose: PoseId = "stand") =>
  gear.map((id) => {
    const part = table[id];
    if (!part) return null;
    // 手に持つ物は、ポーズの右手の先へ寄せる
    const [x, y] = POSES[pose].hand;
    const hold = id === "pencil" ? `translate(${x - STAND_HAND[0]} ${y - STAND_HAND[1]})` : undefined;
    return <g key={id} transform={hold}>{part}</g>;
  });

// "side" は学習の画面（pages/lesson）が使っている。盤面の引き出しは "drawer"
export type AvatarSize = "side" | "drawer" | "walker" | "mirror" | "levelup";

interface AvatarProps {
  /** 身につけている装備 */
  gear: GearId[];
  /** 大きさは 04_components.md の CMP-002 */
  size: AvatarSize;
  /** 省けば たつ。写真（CMP-040）で使う */
  pose?: PoseId;
  /** 省けば にこにこ */
  face?: FaceId;
}

/** 棒人間の全身（装備つき）。Avatar と写真（AvatarPhoto）が共有する。viewBox は 0 0 80 96 */
export function AvatarFigure({ gear, pose = "stand", face = "smile" }: { gear: GearId[]; pose?: PoseId; face?: FaceId }) {
  const { d, lift } = POSES[pose];
  const figure = (
    <>
      {wornParts(BACK_GEAR, gear)}
      <circle cx="40" cy="28" r="17" fill="var(--color-bg)" stroke="currentColor" strokeWidth="3" />
      {FACES[face]}
      <path {...PEN} d={d} />
      {wornParts(FRONT_GEAR, gear, pose)}
    </>
  );
  // ジャンプだけ全体を少し上へ。ほかは <g> を足さない
  return lift ? <g transform={`translate(0 ${-lift})`}>{figure}</g> : figure;
}

/** 飾りなので読み上げない。レベルは文字で別に出す */
export function Avatar({ gear, size, pose, face }: AvatarProps) {
  return (
    <svg className={`avatar avatar--${size}`} viewBox="0 0 80 96" aria-hidden="true">
      <AvatarFigure gear={gear} pose={pose} face={face} />
    </svg>
  );
}

/** ロッカーの扉に置く、装備だけの絵 */
export function GearIcon({ gearId }: { gearId: GearId }) {
  return (
    <svg viewBox={GEAR_VIEWS[gearId]} aria-hidden="true">
      {BACK_GEAR[gearId] ?? FRONT_GEAR[gearId]}
    </svg>
  );
}

/** 顔のボタンに描く、アバターの顔の絵。保存した写真があればその顔、無ければ既定の顔。飾りなので読み上げない */
export function AvatarFace() {
  const look = usePhoto() ?? { ...DEFAULT_LOOK, gear: [] };
  return <AvatarPhoto look={look} shape="face" />;
}
