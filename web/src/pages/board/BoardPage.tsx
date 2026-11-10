import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { playSe } from "../../audio/use-bgm";
import { defaultCardTarget } from "../../game/logic";
import type { LessonTarget } from "../../game/logic";
import type { Game } from "../../game/use-game";
import { Card } from "./Card";
import { sameTarget } from "./card-content";
import { mainAnchor, Road, sideAnchor, TEST_ANCHOR } from "./Road";
import { TopBar } from "./TopBar";
import { BoardDialogs } from "./dialogs/BoardDialogs";
import type { BoardDialog } from "./dialogs/types";
import "./board.css";

export interface BoardPageProps {
  game: Game;
  /** 章をえらぶ（PG-004）へ移る */
  onOpenChapters: () => void;
  /** 初めの説明を出すか（既定は true） */
  showIntro?: boolean;
}

// カードの高さを CSS の変数へ渡す。狭い画面ではカードを画面の下に固定するので、道の下の余白とトーストの位置に使う。
// トーストは盤面の外に出すので、ページ全体の変数にして、盤面を離れたら消す
function useCardHeight() {
  const cardRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const card = cardRef.current;
    if (!card) return undefined;
    const write = () => root.style.setProperty("--card-height", `${card.offsetHeight}px`);
    write();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(write);
    observer?.observe(card);
    return () => {
      observer?.disconnect();
      root.style.removeProperty("--card-height");
    };
  }, []);
  return cardRef;
}

// PG-002。学習（/sansu/lesson/…）は App が直接出すので、ここは盤面だけ。盤面へ戻ると今のマスへスクロールし直す
export function BoardPage({ game, onOpenChapters, showIntro = true }: BoardPageProps) {
  // 最初の1回だけ、途中から始まる理由と「分かんない」を説明する（D-08 は変えない）
  const [dialog, setDialog] = useState<BoardDialog | null>(showIntro && !game.state.introSeen ? { type: "intro" } : null);
  // カードに出す物。無ければ今のマス。章が変わるか、終えたマスの数が変わったら今のマスに戻す
  const [selected, setSelected] = useState<LessonTarget | null>(null);
  const [selectedFor, setSelectedFor] = useState("");
  const cardRef = useCardHeight();
  const { chapter, chapterProgress: progress, walkingTo, isEntryLocked } = game;

  useEffect(() => {
    if (showIntro && !game.state.introSeen) setDialog((current) => current?.type === "intro" ? current : { type: "intro" });
    else if (!showIntro) setDialog((current) => current?.type === "intro" ? null : current);
  }, [showIntro, game.state.introSeen]);

  const pickKey = `${chapter.id}:${progress.done}`;
  if (selectedFor !== pickKey) {
    setSelectedFor(pickKey);
    setSelected(null);
  }
  const defaultTarget = defaultCardTarget(chapter, progress);
  const target = selected ?? defaultTarget;
  const isOffNow = selected !== null && !sameTarget(selected, defaultTarget);

  // アバターは今のマスに立つ。寄り道を終えた直後は、その寄り道の行まで歩く
  const anchorKey = walkingTo?.kind === "side"
    ? sideAnchor(walkingTo.sideId)
    : progress.done < chapter.items.length ? mainAnchor(progress.done) : TEST_ANCHOR;

  // 章を開いた時と、進んだ時に今のマスが盤面の上下の中央に来るよう動かす（盤面の欄だけが動く）。767px 以下で固定したカードに隠れないよう、余白は CSS の scroll-margin で取る
  useEffect(() => {
    document.querySelector("[data-walker-anchor]")?.scrollIntoView?.({ block: "center" });
  }, [chapter.id, progress.done]);

  const closeDialog = () => {
    if (dialog?.type === "intro") game.dismissIntro();
    setDialog(null);
  };

  // 今のマス（受けられる章のテストも）を押すと学習へ入り、ほかは押した物をカードに出す（D-75）
  const press = (next: LessonTarget) => {
    if (isEntryLocked) return;
    // 終えた章のテストは、もう受けられないので学習へ入らない
    const isNow = sameTarget(next, defaultTarget) && !(next.kind === "test" && progress.test);
    if (isNow && game.hasLesson(next)) {
      playSe("enter");
      game.startLesson(next);
      return;
    }
    playSe("select");
    setSelected(next);
  };

  return (
    <div className="board-page">
      <TopBar chapter={chapter} done={progress.done} onOpenChapters={onOpenChapters} />
      <main className="board-body">
        <Road
          key={chapter.id}
          game={game}
          anchorKey={anchorKey}
          onPress={press}
        />
        <div className="card-slot" ref={cardRef}>
          <Card game={game} target={target} onReturn={isOffNow ? () => setSelected(null) : null} />
        </div>
      </main>
      <BoardDialogs game={game} dialog={dialog} onClose={closeDialog} />
    </div>
  );
}
