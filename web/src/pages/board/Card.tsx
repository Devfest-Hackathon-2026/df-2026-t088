import { Button } from "../../components/Button";
import { Ruby } from "../../components/Ruby";
import { COPY } from "../../copy";
import type { LessonTarget } from "../../game/logic";
import type { Game } from "../../game/use-game";
import { useText } from "../../grade";
import { cardContent } from "./card-content";
import type { CardContent } from "./card-content";

interface CardProps {
  game: Game;
  /** 選んでいる物 */
  target: LessonTarget;
  /** 今のマス以外を選んでいる時だけ、今のマスへ戻るボタンを出す */
  onReturn: (() => void) | null;
}

// CMP-014。選んだ物の学ぶことを見せ、主ボタンを1つだけ置く。中身が替わっても focus は動かさず、aria-live で読み上げる
export function Card({ game, target, onReturn }: CardProps) {
  const t = useText();
  const content: CardContent | null = cardContent(game, target);
  if (!content) return null;

  const handlePrimary = () => {
    if (game.isEntryLocked || !content.button) return;
    if (content.button.action === "next-chapter") {
      if (game.nextChapter) game.openChapter(game.nextChapter.id);
      return;
    }
    game.startLesson(target);
  };

  return (
    <aside className="card" aria-labelledby="card-title">
      <div className="card-body" aria-live="polite">
        <p className="card-eyebrow"><Ruby text={content.eyebrow} /></p>
        <h2 id="card-title" aria-label={t(content.title)}><Ruby text={content.title} /></h2>
        {content.body.map((text) => <p key={text} className="card-text"><Ruby text={text} /></p>)}
      </div>
      {content.button && (
        <Button variant="primary" className="card-primary" se={game.isEntryLocked ? null : "enter"} aria-label={t(content.button.text)} onClick={handlePrimary}>
          <Ruby text={content.button.text} />
        </Button>
      )}
      {onReturn && <Button variant="text" onClick={onReturn}>{t(COPY.CP_261)}</Button>}
    </aside>
  );
}
