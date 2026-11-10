import { COPY } from "../../copy";
import { SIDE_TYPES } from "../../data";
import type { Chapter, ChapterProgress, Side } from "../../data";
import { isSideOpen, mainCellStatus } from "../../game/logic";
import type { CellStatus } from "../../game/logic";

export type SideStatus = "done" | "open" | "locked";
export type TestStatus = "done" | "now" | "todo";

export function sideStatus(progress: ChapterProgress, side: Side): SideStatus {
  if (progress.sides.includes(side.id)) return "done";
  return isSideOpen(progress, side) ? "open" : "locked";
}

export function testStatus(chapter: Chapter, progress: ChapterProgress): TestStatus {
  if (progress.test) return "done";
  return progress.done >= chapter.items.length ? "now" : "todo";
}

const STATUS_TEXT: Record<CellStatus, string> = {
  done: COPY.CP_303.done,
  now: COPY.CP_303.now,
  todo: COPY.CP_303.todo,
};

/** 読み上げの名前。`[語|よみ]` のまま返す。画面に出す前に useText() を通す */
export function mainLabel(chapter: Chapter, progress: ChapterProgress, index: number): string {
  const item = chapter.items[index];
  return COPY.CP_208(index + 1, item?.title ?? "", STATUS_TEXT[mainCellStatus(progress, index)]);
}

export function sideLabel(side: Side, status: SideStatus): string {
  const text = status === "done" ? COPY.CP_303.done : status === "open" ? COPY.CP_303.open : COPY.CP_303.locked;
  return COPY.CP_244(SIDE_TYPES[side.type].name, side.title, text);
}

export function testLabel(status: TestStatus): string {
  const text = status === "done" ? COPY.CP_303.done : status === "now" ? COPY.CP_303.now : COPY.CP_303.todo;
  return COPY.CP_248(text);
}
