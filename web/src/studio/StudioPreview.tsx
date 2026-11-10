import { ProblemCard } from "../pages/lesson/ProblemCard";
import { TileSupport, TileWork } from "../pages/lesson/TileWork";
import { useTileLesson } from "../pages/lesson/use-tile-lesson";
import type { LessonDefinition } from "../lesson/problems";
import "../pages/lesson/lesson.css";

export interface StudioPreviewItem {
  label: string;
  lesson: LessonDefinition;
}

export interface StudioPreviewProps {
  /** 2案の Before / After や、3案の比較に使う */
  lessons: readonly StudioPreviewItem[];
}

function PreviewLesson({ label, lesson: definition }: StudioPreviewItem) {
  const lesson = useTileLesson(definition, 0, { preview: true });
  const { session, refs } = lesson;
  const isSplit = session.view !== "answer";

  return (
    <section className="lesson studio-preview__lesson" role="region" aria-label={label}>
      <header className="lesson-header">
        <h2>{label}</h2>
        <p className="lesson-progress">見本データのプレビュー</p>
      </header>
      <div
        className={isSplit ? "lesson is-split" : "lesson"}
        ref={(node) => { refs.mainRef.current = node; }}
        style={isSplit ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}
      >
        <header className="lesson-header">
          <h3>{definition.problems.length > 1 ? "問題" : definition.problems[0]?.kind === "calculate" ? "分数の計算" : "分数の問題"}</h3>
          <p className="lesson-progress">{session.problemIndex + 1} / {definition.problems.length} 問</p>
        </header>
        <ProblemCard lesson={lesson} support={isSplit ? <TileSupport lesson={lesson} /> : undefined} />
        {isSplit && <TileWork lesson={lesson} />}
      </div>
    </section>
  );
}

/** Lesson IR から変換した教材を既存の分数タイルで試せるプレビュー */
export function StudioPreview({ lessons }: StudioPreviewProps) {
  return (
    <div
      className="studio-preview"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
        gap: "var(--space-3)",
        alignItems: "start",
      }}
    >
      {lessons.map(({ label, lesson }) => (
        <PreviewLesson key={label} label={label} lesson={lesson} />
      ))}
    </div>
  );
}
