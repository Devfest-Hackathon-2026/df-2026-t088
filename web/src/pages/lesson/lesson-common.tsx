import type { RefObject } from "react";
import { Avatar } from "../../components/Avatar";
import { Icon } from "../../components/Icon";
import { COPY } from "../../copy";
import type { Chapter, ChapterProgress } from "../../data";
import { isSideOpen } from "../../game/logic";
import type { LessonTarget } from "../../game/logic";
import type { Game } from "../../game/use-game";
import { LESSON_COPY } from "../../lesson/wording";
import { useText } from "../../grade";
import { LessonButton } from "./LessonButton";

export function targetOf(key: string, chapter: Chapter): LessonTarget | null {
  const main = /^main-(\d+)$/.exec(key);
  if (main) return { kind: "main", index: Number(main[1]) };
  if (key === "test") return { kind: "test" };
  return chapter.sides.some((side) => side.id === key) ? { kind: "side", sideId: key } : null;
}

export function canStart(chapter: Chapter, progress: ChapterProgress, target: LessonTarget): boolean {
  if (target.kind === "main") return target.index === progress.done;
  if (target.kind === "test") return progress.done >= chapter.items.length && !progress.test;
  const side = chapter.sides.find((candidate) => candidate.id === target.sideId);
  return side !== undefined && isSideOpen(progress, side);
}

export function titleOf(chapter: Chapter, target: LessonTarget): string {
  if (target.kind === "main") return chapter.items[target.index]?.title ?? "";
  if (target.kind === "test") return COPY.CP_238(chapter.title);
  return chapter.sides.find((side) => side.id === target.sideId)?.title ?? "";
}

export function LessonClear({ game, total, isRepeat, onFinish, sectionRef, buttonText = LESSON_COPY.clearButton }: {
  game?: Game;
  total: number;
  isRepeat: boolean;
  onFinish: () => void;
  sectionRef: RefObject<HTMLElement | null>;
  buttonText?: string;
}) {
  const t = useText();
  return (
    <section className="lesson-card lesson-clear" ref={sectionRef} aria-labelledby="lesson-clear-heading">
      <div className="lesson-clear-art" aria-hidden="true">
        <Avatar gear={game?.wornGear ?? []} size="side" />
        <span className="lesson-clear-mark"><Icon name="hanamaru" /></span>
      </div>
      <h2 id="lesson-clear-heading">{LESSON_COPY.clearHeading}</h2>
      <p>{t(LESSON_COPY.clearText(total))}</p>
      {isRepeat && <p>{t(LESSON_COPY.clearRepeat)}</p>}
      <LessonButton text={buttonText} variant="primary" se={null} onClick={onFinish} />
    </section>
  );
}
