import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { TileDrop } from "../../lesson/session";

const DRAG_START_DISTANCE = 6;
const RULER_DROP_MARGIN_X = 12;
const RULER_DROP_MARGIN_Y = 28;
const TILE_SELECTOR = "[data-tile-id]";

interface DragSource {
  key: string;
  tileId: number | null;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  isMoving: boolean;
  /** 動かさずに離した時の操作 */
  onTap: () => void;
}

/** 指についてくるタイルと、今落とせる場所 */
export interface TileGhost {
  key: string;
  tileId: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  targetTileId: number | null;
  isOverRuler: boolean;
}

function isInsideRuler(ruler: HTMLElement, x: number, y: number): boolean {
  const box = ruler.getBoundingClientRect();
  return x >= box.left - RULER_DROP_MARGIN_X && x <= box.right + RULER_DROP_MARGIN_X
    && y >= box.top - RULER_DROP_MARGIN_Y && y <= box.bottom + RULER_DROP_MARGIN_Y;
}

function tileUnderPointer(ruler: HTMLElement, x: number, y: number, ownTileId: number | null): number | null {
  const tile = document.elementFromPoint(x, y)?.closest<HTMLElement>(TILE_SELECTOR);
  if (!tile || !ruler.contains(tile)) return null;
  const tileId = Number(tile.dataset.tileId);
  return tileId === ownTileId ? null : tileId;
}

// 指を離した位置より左にある、ほかのタイルの数が差し込む位置になる
function insertIndex(ruler: HTMLElement, x: number, ownTileId: number | null): number {
  const tiles = [...ruler.querySelectorAll<HTMLElement>(TILE_SELECTOR)];
  return tiles.filter((tile) => {
    if (Number(tile.dataset.tileId) === ownTileId) return false;
    const box = tile.getBoundingClientRect();
    return x > box.left + box.width / 2;
  }).length;
}

function readDrop(drag: DragSource, ruler: HTMLElement, x: number, y: number): TileDrop {
  return {
    key: drag.key,
    tileId: drag.tileId,
    targetTileId: tileUnderPointer(ruler, x, y, drag.tileId),
    isOnRuler: isInsideRuler(ruler, x, y),
    index: insertIndex(ruler, x, drag.tileId),
  };
}

function readGhost(drag: DragSource, ruler: HTMLElement, x: number, y: number): TileGhost {
  const targetTileId = tileUnderPointer(ruler, x, y, drag.tileId);
  return {
    key: drag.key,
    tileId: drag.tileId,
    x: x - drag.offsetX,
    y: y - drag.offsetY,
    width: drag.width,
    height: drag.height,
    targetTileId,
    isOverRuler: targetTileId === null && isInsideRuler(ruler, x, y),
  };
}

function createDrag(event: ReactPointerEvent<HTMLElement>, key: string, tileId: number | null, onTap: () => void): DragSource {
  const box = event.currentTarget.getBoundingClientRect();
  return {
    key,
    tileId,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - box.left,
    offsetY: event.clientY - box.top,
    width: box.width,
    height: box.height,
    isMoving: false,
    onTap,
  };
}

function capturePointer(event: ReactPointerEvent<HTMLElement>) {
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // 指がすでに離れていると捕まえられない。window の監視で続けられるので止めない
  }
}

export interface TileDragControls {
  ghost: TileGhost | null;
  /** onTap はタッチで動かさずに離した時に呼ぶ。マウスとキーボードの押す操作は click で受ける */
  startDrag: (event: ReactPointerEvent<HTMLElement>, key: string, tileId: number | null, onTap: () => void) => void;
  /** ドラッグの直後に届く click を押した操作として扱わないために、click の先頭で呼ぶ */
  isDragClick: (event: MouseEvent) => boolean;
}

// Pointer Events のドラッグ。判定は lesson/session に任せ、ここは指の位置を読むだけにする
export function useTileDrag(rulerRef: RefObject<HTMLElement | null>, onDrop: (drop: TileDrop) => void): TileDragControls {
  const [ghost, setGhost] = useState<TileGhost | null>(null);
  const dragRef = useRef<DragSource | null>(null);
  const justDraggedRef = useRef(false);
  const onDropRef = useRef(onDrop);
  useEffect(() => { onDropRef.current = onDrop; }, [onDrop]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const ruler = rulerRef.current;
      if (!drag || !ruler || event.pointerId !== drag.pointerId) return;
      const distance = Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY);
      if (!drag.isMoving && distance <= DRAG_START_DISTANCE) return;
      drag.isMoving = true;
      setGhost(readGhost(drag, ruler, event.clientX, event.clientY));
    };
    const finish = (event: PointerEvent, isCancelled: boolean) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      setGhost(null);
      const ruler = rulerRef.current;
      // ドラッグの直後のタップは click が来ないことがある（Chromium で再現）。タッチは指を離した時点で押した操作にする
      if (!drag.isMoving && !isCancelled && event.pointerType === "touch") {
        justDraggedRef.current = true;
        drag.onTap();
      }
      if (!drag.isMoving || !ruler) return;
      justDraggedRef.current = true;
      if (!isCancelled) onDropRef.current(readDrop(drag, ruler, event.clientX, event.clientY));
    };
    const handleUp = (event: PointerEvent) => finish(event, false);
    const handleCancel = (event: PointerEvent) => finish(event, true);
    // タッチのドラッグの後は click が来ない。次に押した時に印を消して、その操作を飲み込まない
    const handleDown = () => { justDraggedRef.current = false; };
    window.addEventListener("pointerdown", handleDown, true);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    return () => {
      window.removeEventListener("pointerdown", handleDown, true);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
    };
  }, [rulerRef]);

  const startDrag = useCallback((event: ReactPointerEvent<HTMLElement>, key: string, tileId: number | null, onTap: () => void) => {
    if (dragRef.current || event.button !== 0) return;
    capturePointer(event);
    dragRef.current = createDrag(event, key, tileId, onTap);
  }, []);

  // キーボードの click は detail が 0 になる。ドラッグの後でも、キーボードの操作は飲み込まない
  const isDragClick = useCallback((event: MouseEvent) => {
    const isAfterDrag = justDraggedRef.current && event.detail !== 0;
    justDraggedRef.current = false;
    return isAfterDrag;
  }, []);

  return { ghost, startDrag, isDragClick };
}
