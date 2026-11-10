import type { KeyboardEvent, MouseEvent, RefObject } from "react";
import { findPiece, layoutTiles, pieceSize, rulerLength, takenUnits } from "../../lesson/tiles";
import type { PlacedTile, TileGame } from "../../lesson/tiles";
import { useText } from "../../grade";
import { LESSON_COPY, rulerTileName } from "../../lesson/wording";
import { cssVars } from "./css-vars";
import { FractionText } from "./FractionText";
import type { TileDragControls, TileGhost } from "./use-tile-drag";

// これより細いマスには、狭い画面で分数の名前が入らない。名前は CSS が消す
const NARROW_CELLS_PER_RULER = 10;

function TileCells({ game, tile }: { game: TileGame; tile: PlacedTile }) {
  if (!tile.coverKey) return null;
  const coverPiece = findPiece(game, tile.coverKey);
  const units = tile.size / pieceSize(game, coverPiece);
  const taken = takenUnits(game, tile);
  const narrow = pieceSize(game, coverPiece) * NARROW_CELLS_PER_RULER < rulerLength(game) ? " is-narrow" : "";
  return (
    <span className="lesson-cells" style={cssVars({ filled: tile.coverCount, units })}>
      {Array.from({ length: tile.coverCount }, (_unused, index) => {
        const isTaken = index >= tile.coverCount - taken;
        return (
          <span key={index} className={`lesson-cell lesson-piece-${coverPiece.colorIndex}${narrow}${isTaken ? " is-taken" : ""}`}>
            <FractionText value={coverPiece} />
          </span>
        );
      })}
    </span>
  );
}

interface RulerTileProps {
  game: TileGame;
  tile: PlacedTile;
  isLocked: boolean;
  ghost: TileGhost | null;
  drag: TileDragControls;
  onPress: (tileId: number) => void;
  onTakeOff: (tileId: number) => void;
}

function RulerTile({ game, tile, isLocked, ghost, drag, onPress, onTakeOff }: RulerTileProps) {
  const t = useText();
  const piece = findPiece(game, tile.key);
  const isWholeTaken = tile.takenKey !== null && tile.coverCount === 0;
  const classes = [
    "lesson-tile",
    `lesson-piece-${piece.colorIndex}`,
    isWholeTaken && "is-taken",
    ghost?.tileId === tile.id && "is-dragging",
    ghost?.targetTileId === tile.id && "is-target",
  ].filter(Boolean).join(" ");
  const handleClick = (event: MouseEvent) => {
    if (!drag.isDragClick(event)) onPress(tile.id);
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Delete" || event.key === "Backspace") onTakeOff(tile.id);
  };
  return (
    <button
      type="button"
      className={classes}
      style={cssVars({ start: tile.start, size: tile.size, total: rulerLength(game) })}
      data-tile-id={tile.id}
      aria-label={t(rulerTileName(game, tile))}
      aria-keyshortcuts="Delete"
      disabled={isLocked}
      onPointerDown={(event) => drag.startDrag(event, tile.key, tile.id, () => onPress(tile.id))}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <FractionText value={piece} spaced />
      <TileCells game={game} tile={tile} />
    </button>
  );
}

// 重ねると下のタイルの文字が隠れる。何の上に重ねたのかが分かるように、ものさしの上に名前を残す
function TileNames({ game }: { game: TileGame }) {
  const total = rulerLength(game);
  return (
    <div className="lesson-tile-names" aria-hidden="true">
      {layoutTiles(game).map((tile) => {
        if (!tile.coverKey) return null;
        const { num, den } = findPiece(game, tile.key);
        return <span key={tile.id} className="lesson-tile-name" style={cssVars({ start: tile.start, size: tile.size, total })}>{`${num}/${den}`}</span>;
      })}
    </div>
  );
}

interface TileRulerProps extends Omit<RulerTileProps, "tile"> {
  rulerRef: RefObject<HTMLDivElement | null>;
  onPressRuler: () => void;
}

/** ものさし。整数の目盛りの位置は CSS が百分率にする */
export function TileRuler({ rulerRef, onPressRuler, ...tileProps }: TileRulerProps) {
  const { game, ghost, drag, isLocked } = tileProps;
  // タイルの押す操作はタイルが受ける。空いた所を押した時だけ、選んだタイルを置く
  const handleClick = (event: MouseEvent) => {
    const isOnTile = event.target instanceof Element && event.target.closest("[data-tile-id]") !== null;
    if (!isLocked && !isOnTile && !drag.isDragClick(event)) onPressRuler();
  };
  const total = rulerLength(game);
  const marks = Array.from({ length: game.wholes - 1 }, (_unused, index) => (index + 1) * game.scale);
  return (
    <>
      <p id="lesson-ruler-name" className="lesson-area-name">{LESSON_COPY.rulerName}</p>
      <div className="lesson-ruler-labels" aria-hidden="true">
        {Array.from({ length: game.wholes + 1 }, (_unused, whole) => <span key={whole}>{whole}</span>)}
      </div>
      <TileNames game={game} />
      <div ref={rulerRef} className={`lesson-ruler${ghost?.isOverRuler ? " is-over" : ""}`} role="group" aria-labelledby="lesson-ruler-name" onClick={handleClick}>
        {marks.map((at) => <span key={at} className="lesson-ruler-mark" style={cssVars({ at, total })} />)}
        {layoutTiles(game).map((tile) => <RulerTile key={tile.id} {...tileProps} tile={tile} />)}
      </div>
    </>
  );
}
