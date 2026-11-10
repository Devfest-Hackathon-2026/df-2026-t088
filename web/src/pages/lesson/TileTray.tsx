import type { MouseEvent } from "react";
import { findPiece, pieceSize, remainingCount, rulerLength } from "../../lesson/tiles";
import type { Piece, TileGame } from "../../lesson/tiles";
import { LESSON_COPY, remainingLabel, trayTileName } from "../../lesson/wording";
import { useText } from "../../grade";
import { cssVars } from "./css-vars";
import { FractionText } from "./FractionText";
import type { TileDragControls, TileGhost } from "./use-tile-drag";

interface TrayTileProps {
  game: TileGame;
  piece: Piece;
  isSelected: boolean;
  drag: TileDragControls;
  onSelect: (key: string) => void;
}

// 押すと選ぶ。使い切ったタイルも押せるようにして、押した後の文で理由を伝える（CMP-001）
function TrayTile({ game, piece, isSelected, drag, onSelect }: TrayTileProps) {
  const t = useText();
  const remaining = remainingCount(game, piece.key);
  const classes = [
    "lesson-tile",
    `lesson-piece-${piece.colorIndex}`,
    remaining < 1 && "is-used-up",
    isSelected && "is-selected",
  ].filter(Boolean).join(" ");
  const handleClick = (event: MouseEvent) => {
    if (!drag.isDragClick(event)) onSelect(piece.key);
  };
  return (
    <div className="lesson-tray-row" style={cssVars({ size: pieceSize(game, piece), total: rulerLength(game) })}>
      {/* 細いタイルにも入りきるように、残りの枚数はタイルの外に書く */}
      <span className="lesson-tile-count">{remainingLabel(remaining)}</span>
      <button
        type="button"
        className={classes}
        aria-label={t(trayTileName(piece, remaining))}
        aria-pressed={isSelected}
        onPointerDown={(event) => { if (remaining > 0) drag.startDrag(event, piece.key, null, () => onSelect(piece.key)); }}
        onClick={handleClick}
      >
        <FractionText value={piece} spaced />
      </button>
    </div>
  );
}

interface TileTrayProps {
  game: TileGame;
  selectedKey: string | null;
  drag: TileDragControls;
  onSelect: (key: string) => void;
}

export function TileTray({ game, selectedKey, drag, onSelect }: TileTrayProps) {
  const t = useText();
  return (
    <div className="lesson-tray" role="group" aria-label={t(LESSON_COPY.trayName)}>
      {game.pieces.map((piece) => (
        <TrayTile key={piece.key} game={game} piece={piece} isSelected={selectedKey === piece.key} drag={drag} onSelect={onSelect} />
      ))}
    </div>
  );
}

/** 指についてくるタイル */
export function DragGhost({ game, ghost }: { game: TileGame; ghost: TileGhost }) {
  const piece = findPiece(game, ghost.key);
  const style = { width: ghost.width, height: ghost.height, transform: `translate(${ghost.x}px, ${ghost.y}px)` };
  return (
    <div className={`lesson-tile lesson-ghost lesson-piece-${piece.colorIndex}`} style={style} aria-hidden="true">
      <FractionText value={piece} spaced />
    </div>
  );
}
