import { Button } from "../../components/Button";
import { Ruby } from "../../components/Ruby";
import { COPY } from "../../copy";
import type { Chapter } from "../../data";
import { useText } from "../../grade";

interface TopBarProps {
  chapter: Chapter;
  /** 終えたマスの数 */
  done: number;
  /** PG-004（章をえらぶ）を開く */
  onOpenChapters: () => void;
}

// SEC-002-01。章をえらぶ、章の名前（h1）と進み。音と顔は右上の CMP-043（D-245）に移したので、帯の右に --corner-reserve を空ける。ここだけ紙の色で塗り、下に線を引く
export function TopBar({ chapter, done, onOpenChapters }: TopBarProps) {
  const t = useText();
  const progress = COPY.CP_214(done, chapter.items.length);
  return (
    <header className="top-bar">
      <Button variant="secondary" className="top-chapters" se={null} onClick={onOpenChapters}>{t(COPY.CP_266)}</Button>
      {/* ふりがなを二重に読ませない */}
      <h1 className="top-title" aria-label={t(`${chapter.title} ${progress}`)}>
        <span className="top-title-name"><Ruby text={chapter.title} /></span>
        <span className="top-title-progress">{progress}</span>
      </h1>
    </header>
  );
}
