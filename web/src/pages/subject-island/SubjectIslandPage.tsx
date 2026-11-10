import type { CSSProperties } from "react";
import { playSe } from "../../audio/use-bgm";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { COPY } from "../../copy";
import { SUBJECTS } from "../../data";
import type { Chapter } from "../../data";
import type { Course } from "../../game/course";
import type { Game } from "../../game/use-game";
import { Ruby } from "../../components/Ruby";
import { useText } from "../../grade";
import type { SubjectId } from "../../data";
import "./SubjectIslandPage.css";

interface SubjectIslandPageProps {
  subjectId: SubjectId;
  /** 島の地図（/）へ戻る */
  onOpenMap: () => void;
  course: Course;
  game: Game;
  onOpenChapter?: (chapter: Chapter) => void;
}

// PG-005 教科の島（D-91）。今の学年のその教科の章を、章札で並べる（D-116、D-117）。
// 章の名前は学習指導要領の言葉。文言は学年に合わせて漢字かかなで出す。
// 問題が1つも無い章は鍵の札にし、押すと選ぶ音と CP-550 のトーストを出して盤面へは入らない（D-133）
export function SubjectIslandPage({ subjectId, onOpenMap, course, game, onOpenChapter }: SubjectIslandPageProps) {
  const t = useText();
  const subject = SUBJECTS.find((s) => s.id === subjectId);
  if (!subject) return null;
  return (
    <div className="subject-island" style={{ "--island-color": subject.color } as CSSProperties}>
      <header className="subject-island__bar">
        <Button variant="secondary" se={null} onClick={onOpenMap}>{t(COPY.CP_215)}</Button>
      </header>
      <main className="subject-island__body">
        <h1 className="subject-island__title">{t(COPY.CP_501(subject.name))}</h1>
        <section className="subject-island__chapters" aria-label={t(COPY.CP_503)}>
          <h2>{t(COPY.CP_503)}</h2>
          <ul>{course.chapters.map((chapter) => {
            const locked = !game.isChapterOpen(chapter);
            const cleared = game.progressOf(chapter).test;
            const press = () => {
              if (!locked) {
                onOpenChapter?.(chapter);
                return;
              }
              playSe("select");
              game.showToast(COPY.CP_550(chapter.title));
            };
            return <li key={chapter.id}><button
              type="button"
              className={`subject-island__chapter${cleared ? " is-done" : ""}${locked ? " is-locked" : ""}`}
              aria-disabled={locked ? "true" : undefined}
              aria-label={locked ? t(COPY.CP_207(chapter.title)) : undefined}
              onClick={press}
            >
              {cleared && <span aria-hidden="true">✓ </span>}
              {locked && <span className="subject-island__lock" aria-hidden="true"><Icon name="lock" /></span>}
              <Ruby text={chapter.title} />
            </button></li>;
          })}</ul>
        </section>
      </main>
    </div>
  );
}
