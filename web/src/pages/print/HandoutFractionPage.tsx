// 配られた「分数のたし算・ひき算」の 1 問を、今あるタイルの学習の部品で解く画面（#477）。
// 経験値・すごろくの進み・続きの保存は変えない（useTileLesson の handoutId 指定。game には触れない）
import { Button } from "../../components/Button";
import { Ruby } from "../../components/Ruby";
import { useText } from "../../grade";
import type { LessonDefinition } from "../../lesson/problems";
import { LESSON_COPY } from "../../lesson/wording";
import { ProblemCard } from "../lesson/ProblemCard";
import { TileSupport, TileWork } from "../lesson/TileWork";
import { useTileLesson } from "../lesson/use-tile-lesson";
import { LessonButton } from "../lesson/LessonButton";
import { fractionLessonOf } from "./fraction-addsub";
import { TEMPLATES } from "./templates";
import "../lesson/lesson.css";

export const HANDOUT_FRACTION_COPY = {
  unopenable: "この説明は ひらけませんでした",
  back: "もどる",
} as const;

interface Props {
  handoutId: string;
  questionText: string;
  /** 配られたときの params（server の値。範囲の外・形の違いは開かない） */
  params: unknown;
  onBack: () => void;
}

function FractionLesson({ definition, handoutId, onBack }: { definition: LessonDefinition; handoutId: string; onBack: () => void }) {
  const t = useText();
  const lesson = useTileLesson(definition, 0, { handoutId });
  const { session, refs } = lesson;
  const title = TEMPLATES["sansu-fraction-addsub"].title;
  const isSplit = session.view !== "answer";
  return (
    <main className={isSplit ? "lesson is-split" : session.isCleared ? "lesson is-cleared" : "lesson"} ref={refs.mainRef}>
      <header className="lesson-header">
        <h1 aria-label={t(title)}><Ruby text={title} /></h1>
        {!session.isCleared && <LessonButton text={HANDOUT_FRACTION_COPY.back} variant="text" className="lesson-exit" se={null} onClick={onBack} />}
      </header>
      <ProblemCard lesson={lesson} support={isSplit ? <TileSupport lesson={lesson} /> : undefined} />
      {isSplit && <TileWork lesson={lesson} />}
      {session.isCleared && (
        <section className="lesson-card lesson-clear" ref={refs.clearRef} aria-labelledby="lesson-clear-heading">
          <h2 id="lesson-clear-heading">{LESSON_COPY.clearHeading}</h2>
          <p>{t(LESSON_COPY.clearText(1))}</p>
          <LessonButton text={HANDOUT_FRACTION_COPY.back} variant="primary" se={null} onClick={onBack} />
        </section>
      )}
    </main>
  );
}

export function HandoutFractionPage({ handoutId, questionText, params, onBack }: Props) {
  const definition = fractionLessonOf(questionText, params);
  if (!definition) {
    return (
      <div className="print">
        <main className="print__main">
          <p role="alert">{HANDOUT_FRACTION_COPY.unopenable}</p>
          <Button variant="secondary" onClick={onBack}>{HANDOUT_FRACTION_COPY.back}</Button>
        </main>
      </div>
    );
  }
  return <FractionLesson definition={definition} handoutId={handoutId} onBack={onBack} />;
}
