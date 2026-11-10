import type { CSSProperties } from "react";
import { Icon } from "../../components/Icon";
import { COPY } from "../../copy";
import type { Side } from "../../data";
import { isSideOpen, mainCellStatus } from "../../game/logic";
import type { LessonTarget } from "../../game/logic";
import type { Game } from "../../game/use-game";
import { useText } from "../../grade";
import { samplePoints, smoothPathOf, wobbleAt } from "../../wobble";
import type { Point } from "../../wobble";
import { mainLabel, sideLabel, sideStatus, testLabel, testStatus } from "./board-labels";
import { useNarrowBoard } from "./use-narrow-board";
import { Walker } from "./Walker";

/** 今のマスなど、アバターが立つマスの印。Walker がこのマスを測る */
export type AnchorKey = string;

export const mainAnchor = (index: number): AnchorKey => `main:${index}`;
export const sideAnchor = (sideId: string): AnchorKey => `side:${sideId}`;
export const TEST_ANCHOR: AnchorKey = "test";

interface RoadProps {
  game: Game;
  /** アバターが立つマス */
  anchorKey: AnchorKey;
  /** マスを押した時。歩いている間の判断は呼ぶ側 */
  onPress: (target: LessonTarget) => void;
}

/** S字の並び（D-112、D-113）。tokens.css の `--board-col-step` `--board-step` と同じ値。線の SVG は枠の px を座標にするので、数も合わせて持つ */
const MAX_COLS = 4;
/** 767px 以下の1行のマスの数（D-237） */
export const NARROW_MAX_COLS = 3;
const COL_STEP = 96;
const ROW_STEP = 136;
/** 枠の左右の余白。折り返しの半円がある側は半円の半径と道の帯の半分（縁取りを含めて 20）、無い側は今のマスの輪を含めた章のテストの半分に、欄の端との間（24）を足す */
const PAD_EDGE = 24;
const PAD_BULGE = ROW_STEP / 2 + 20 + PAD_EDGE;
const PAD_FLAT = 40 + PAD_EDGE;
/** 枠の高さの余り（上の行のアバターと最後の行の寄り道） */
const BOX_PAD_Y = 52;

/** マスの数から行と列の数と枠の大きさを決める（D-113）。行は1行4マスまでで最も少なく、列は行ごとの数がそろうように少なくする。
 * 半円は2行目への折り返しが右、3行目への折り返しが左に出るので、出る側だけ余白を広げて見た目を左右の中央にそろえる */
export const layoutOf = (total: number, maxCols: number = MAX_COLS) => {
  const rows = Math.max(1, Math.ceil(total / maxCols));
  const cols = Math.max(1, Math.ceil(total / rows));
  const padLeft = rows >= 3 ? PAD_BULGE : PAD_FLAT;
  const padRight = rows >= 2 ? PAD_BULGE : PAD_FLAT;
  return { rows, cols, padLeft, width: padLeft + (cols - 1) * COL_STEP + padRight, height: rows * ROW_STEP + BOX_PAD_Y };
};

/** 寄り道が付く本線のマスの索引。after がそのまま索引。章の全マスの後なら items.length（章のテストから下げる） */
const sideAnchorIndex = (side: Side, count: number): number => Math.min(side.after, count);

/** 道の1区間の形。同じ行は横の直線、行をまたぐ所は同じ列の間の半円（clockwise は右へ膨らむ） */
export type SegmentShape =
  | { kind: "line"; x1: number; x2: number; y: number }
  | { kind: "arc"; x: number; y1: number; y2: number; clockwise: boolean };

/** 揺れのない区間の d。線の位置を確かめるテストが読む */
export const segmentPathOf = (shape: SegmentShape): string => {
  if (shape.kind === "line") return `M${shape.x1} ${shape.y}L${shape.x2} ${shape.y}`;
  const r = (shape.y2 - shape.y1) / 2;
  return `M${shape.x} ${shape.y1}A${r} ${r} 0 0 ${shape.clockwise ? 1 : 0} ${shape.x} ${shape.y2}`;
};

/** 道の i 番目のマスの行と列。偶数行は左から右、奇数行は右から左 */
const placeIn = (cols: number, index: number) => {
  const row = Math.floor(index / cols);
  return { row, col: row % 2 === 1 ? cols - 1 - (index % cols) : index % cols };
};

/** 揺れを付ける前の、マスの数 total の道の区間。i 番目は i 番目のマスから次のマスへの線。
 * 座標は x が左の余白から列の間隔ずつ、y が行の間隔ずつ。枠と同じ縦横比の viewBox で描くので、半円は歪まない。
 * 行をまたぐ区間は同じ列の間の半円（半径は行の間隔の半分）。右端なら右へ、左端なら左へ膨らむ */
export const roadShapesOf = (total: number, maxCols: number = MAX_COLS): SegmentShape[] => {
  const { cols, padLeft } = layoutOf(total, maxCols);
  const xOf = (col: number) => padLeft + col * COL_STEP;
  const yOf = (row: number) => (row + 0.5) * ROW_STEP;
  return Array.from({ length: total - 1 }, (_unused, i) => {
    const from = placeIn(cols, i);
    const to = placeIn(cols, i + 1);
    return from.row === to.row
      ? { kind: "line", x1: xOf(from.col), x2: xOf(to.col), y: yOf(from.row) }
      : { kind: "arc", x: xOf(from.col), y1: yOf(from.row), y2: yOf(to.row), clockwise: from.col === cols - 1 };
  });
};

/** 手描きの揺れの幅と、点を置く間隔（線の座標の単位。盤面と一緒に伸び縮みする） */
const WOBBLE_AMP = 1.2;
const WOBBLE_STEP = 8;

/** 長さ length の線を pointAt(0〜1) で点に分け、点をずらして曲線にする（揺れの付け方は wobble.ts） */
const wobbleCurveOf = (length: number, pointAt: (t: number) => Point): string =>
  smoothPathOf(
    samplePoints(length, WOBBLE_STEP, pointAt).map(([x, y]): Point => {
      const [dx, dy] = wobbleAt(x, y, WOBBLE_AMP);
      return [x + dx, y + dy];
    }),
  );

/** 道の1区間を、揺れの付いた曲線にする */
const wobblePathOf = (shape: SegmentShape): string => {
  if (shape.kind === "line") return wobbleCurveOf(Math.abs(shape.x2 - shape.x1), (t) => [shape.x1 + (shape.x2 - shape.x1) * t, shape.y]);
  // 上の端（-90°）から、右へ膨らむなら 0° を、左へ膨らむなら 180° を通って下の端へ
  const r = (shape.y2 - shape.y1) / 2;
  return wobbleCurveOf((Math.PI * (shape.y2 - shape.y1)) / 2, (t) => {
    const angle = -Math.PI / 2 + (shape.clockwise ? 1 : -1) * Math.PI * t;
    return [shape.x + r * Math.cos(angle), shape.y1 + r + r * Math.sin(angle)];
  });
};

/** 寄り道へ下りる線の、揺れを付ける前の形。本線のマスの中心から、行の間隔の半分だけ真下（寄り道のマスの中心）へ */
export const sideLineOf = (total: number, anchorIndex: number, maxCols: number = MAX_COLS) => {
  const { cols, padLeft } = layoutOf(total, maxCols);
  const { row, col } = placeIn(cols, anchorIndex);
  const x = padLeft + col * COL_STEP;
  const y1 = (row + 0.5) * ROW_STEP;
  return { x, y1, y2: y1 + ROW_STEP / 2 };
};

const wobbleSidePathOf = ({ x, y1, y2 }: { x: number; y1: number; y2: number }): string =>
  wobbleCurveOf(y2 - y1, (t) => [x, y1 + (y2 - y1) * t]);

// CMP-007 の線、CMP-006 のマス、寄り道、歩くアバター（SEC-002-04）。1行4マス（767px 以下は3マス）までのS字（D-112、D-113、D-237）。
// DOM は道の順のまま（Tab の順＝道の順）。見た目の位置は --col / --row で付ける。
// 道（D-110 のすごろくの道）は枠の px を座標にした SVG。同じ行は横にまっすぐ、行の端は外へ膨らむ半円で下の行の同じ列へつなぐ
export function Road({ game, anchorKey, onPress }: RoadProps) {
  const { chapter, chapterProgress: progress, isBusy, walkingTo } = game;
  const t = useText();
  const count = chapter.items.length;
  const total = count + 1;
  const maxCols = useNarrowBoard() ? NARROW_MAX_COLS : MAX_COLS;
  const { rows, cols, padLeft, width: boxWidth, height: boxHeight } = layoutOf(total, maxCols);
  const placeOf = (index: number) => placeIn(cols, index);
  const indexAt = (row: number, col: number) => row * cols + (row % 2 === 1 ? cols - 1 - col : col);
  const anchorProps = (key: AnchorKey) => (key === anchorKey ? { "data-walker-anchor": "" } : {});

  // 開いている寄り道と終えた寄り道だけを出す。鍵の寄り道は出さない（D-76）
  const visibleSides = chapter.sides.filter((side) => isSideOpen(progress, side));
  const sidesAt = (index: number) => visibleSides.filter((side) => sideAnchorIndex(side, count) === index);

  const renderSide = (side: Side) => {
    const status = sideStatus(progress, side);
    return (
      <span key={side.id} className="side">
        <button
          type="button"
          className={`cell cell--side${status === "done" ? " is-done" : ""}`}
          aria-label={t(sideLabel(side, status))}
          onClick={() => onPress({ kind: "side", sideId: side.id })}
          {...anchorProps(sideAnchor(side.id))}
        >
          {t(COPY.CP_284)}
        </button>
      </span>
    );
  };

  const renderMain = (index: number) => {
    const status = mainCellStatus(progress, index);
    return (
      <button
        type="button"
        className={`cell cell--${status}`}
        aria-label={t(mainLabel(chapter, progress, index))}
        aria-current={status === "now" ? "step" : undefined}
        onClick={() => onPress({ kind: "main", index })}
        {...anchorProps(mainAnchor(index))}
      >
        {index + 1}
      </button>
    );
  };

  const testState = testStatus(chapter, progress);
  const renderTest = () => (
    <button
      type="button"
      className={`cell cell--test cell--${testState}`}
      aria-label={t(testLabel(testState))}
      aria-current={testState === "now" ? "step" : undefined}
      onClick={() => onPress({ kind: "test" })}
      {...anchorProps(TEST_ANCHOR)}
    >
      <Icon name={testState === "done" ? "hanamaru" : "star"} />
    </button>
  );

  // 線の区間。i 番目のマスへ入る線で、終えた区間は「i マス目まで終えた」とき（今のマスへ入る線まで）
  const segments = roadShapesOf(total, maxCols).map((shape, i) => ({ key: i + 1, d: wobblePathOf(shape), passed: i + 1 <= progress.done }));
  // 寄り道へ下りる点線。本線と同じ揺れを付け、道の帯の下に描く（帯と本線のマスに隠れる所は見えない）
  const sideLines = visibleSides.map((side) => ({ key: side.id, d: wobbleSidePathOf(sideLineOf(total, sideAnchorIndex(side, count), maxCols)) }));

  // アバターは今のマスの上に立つ。真上のマスに寄り道があるときだけ、盤面の内側へ列の間隔の半分ずらして重ならないようにする
  const anchorIndex = anchorKey === TEST_ANCHOR ? count : anchorKey.startsWith("main:") ? Number(anchorKey.slice(5)) : null;
  const walkerClasses: string[] = [];
  if (anchorKey.startsWith("side:")) walkerClasses.push("walker--side");
  if (anchorIndex !== null) {
    const { row, col } = placeOf(anchorIndex);
    if (row > 0 && sidesAt(indexAt(row - 1, col)).length > 0) walkerClasses.push(col < cols / 2 ? "walker--shift-right" : "walker--shift-left");
  }

  return (
    <section className="road-wrap" aria-label={t(COPY.CP_247)}>
      <div
        className="road-field"
        style={{ "--board-cols": cols, "--rows": rows, "--board-pad-left": padLeft, "--board-box-w": boxWidth, "--board-box-h": boxHeight } as CSSProperties}
      >
        <div className="road-lane">
          <svg className="road-line" viewBox={`0 0 ${boxWidth} ${rows * ROW_STEP}`} aria-hidden="true">
            {sideLines.map((line) => <path key={line.key} className="road-side" d={line.d} />)}
            {segments.map((segment) => <path key={segment.key} className="road-edge" d={segment.d} />)}
            {segments.map((segment) => <path key={segment.key} className="road-band" d={segment.d} />)}
            {segments.map((segment) => <path key={segment.key} className="road-dash" d={segment.d} />)}
            {segments.filter((segment) => segment.passed).map((segment) => <path key={segment.key} className="road-done" d={segment.d} />)}
          </svg>
          <ol className="road">
            {Array.from({ length: total }, (_unused, index) => {
              const { row, col } = placeOf(index);
              return (
                <li key={index} className="node" style={{ "--col": col, "--row": row } as CSSProperties}>
                  {index < count ? renderMain(index) : renderTest()}
                  {sidesAt(index).map(renderSide)}
                </li>
              );
            })}
          </ol>
        </div>
        <Walker anchorKey={anchorKey} className={walkerClasses.join(" ") || undefined} gear={game.wornGear} walking={isBusy || walkingTo !== null} />
      </div>
    </section>
  );
}
