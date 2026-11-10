import { useState } from "react";
import type { Grade } from "../data/kanji-grades";
import { Ruby } from "../components/Ruby";
import { GradeOneLesson } from "../pages/lesson/GradeOneLesson";
import { GradeTwoLesson } from "../pages/lesson/GradeTwoLesson";
import { UpperMathLesson } from "../pages/lesson/UpperMathLesson";
import { FractionIntro } from "../pages/lesson/FractionIntro";
import { MakeTenLesson } from "../pages/lesson/MakeTenLesson";
import { StudioPreview } from "../studio/StudioPreview";
import { PreviewGradeProvider } from "../grade";
import { lessonCatalog, type CatalogEntry } from "./lesson-catalog";
import "./developer-lessons.css";

export default function DeveloperLessons({ onClose }: { onClose: () => void }) {
  const [grade, setGrade] = useState<Grade>(1);
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [index, setIndex] = useState(0);
  const catalog = lessonCatalog(grade);
  const entries = catalog.flatMap((group) => group.entries).filter((entry) => entry.count > 0);
  const position = selected ? entries.findIndex((entry) => entry.chapter.id === selected.chapter.id && entry.key === selected.key) : -1;
  const choose = (entry: CatalogEntry) => { setSelected(entry); setIndex(0); };
  const move = (delta: number) => {
    if (!selected) return;
    const next = index + delta;
    if (next >= 0 && next < selected.count) setIndex(next);
    else {
      const entry = entries[position + delta];
      if (entry) { setSelected(entry); setIndex(delta > 0 ? 0 : entry.count - 1); }
    }
  };
  const back = () => setSelected(null);
  return <PreviewGradeProvider grade={grade}><div className="developer-lessons">
    <header className="developer-lessons__toolbar"><strong>開発者用・算数教材の確認</strong><button onClick={onClose}>通常の学習にもどる</button>
      <label>学年 <select value={grade} onChange={(event) => { setGrade(Number(event.target.value) as Grade); back(); }}>{[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value}年生</option>)}</select></label>
      <span>未回答でも移動できます。学習進捗・経験値は保存しません。</span>
      {selected && <><button onClick={back}>単元一覧</button><button disabled={position === 0 && index === 0} onClick={() => move(-1)}>前の問題（開発者）</button><span>{index + 1} / {selected.count} 問</span><button disabled={position === entries.length - 1 && index === selected.count - 1} onClick={() => move(1)}>次の問題（開発者）</button><label>問題へ移動 <select value={index} onChange={(event) => setIndex(Number(event.target.value))}>{Array.from({ length: selected.count }, (_, i) => <option key={i} value={i}>{i + 1}問目</option>)}</select></label></>}
    </header>
    {selected ? <DeveloperLessonPreview key={`${selected.chapter.id}-${selected.key}-${index}`} entry={selected} index={index} onExit={back} onFinish={() => move(1)} /> : <main className="developer-lessons__catalog">{catalog.map(({ chapter, entries: items }) => <section key={chapter.id}><h2><Ruby text={chapter.title} /></h2><ul>{items.map((entry) => <li key={entry.key}><button disabled={!entry.count} onClick={() => choose(entry)}><Ruby text={entry.title} /> — {entry.count ? `${entry.count}問` : "未実装"}</button></li>)}</ul></section>)}</main>}
  </div></PreviewGradeProvider>;
}

export function DeveloperLessonPreview({ entry, index, onExit, onFinish }: { entry: CatalogEntry; index: number; onExit: () => void; onFinish: () => void }) {
  if (entry.makeTen) return <MakeTenLesson initialStage={index === 0 ? "predict" : "transfer"} onExit={onExit} onFinish={onFinish} />;
  if (entry.ones.length) return <GradeOneLesson topic={entry.ones[index]} topics={entry.test ? [entry.ones[index]] : undefined} onExit={onExit} onFinish={onFinish} />;
  if (entry.twos.length) return <GradeTwoLesson practice={entry.twos[index]} summary={entry.test ? [entry.twos[index]] : undefined} onExit={onExit} onFinish={onFinish} />;
  if (entry.uppers.length) return <UpperMathLesson practice={{ ...entry.uppers[index], followUps: undefined }} summary={entry.test ? [entry.uppers[index]] : undefined} onExit={onExit} onFinish={onFinish} />;
  const lesson = entry.fraction;
  if (!lesson) return null;
  if (lesson.intro) return <FractionIntro intro={lesson.intro} title={entry.title} onExit={onExit} onFinish={onFinish} />;
  return <StudioPreview lessons={[{ label: entry.title, lesson: { ...lesson, problems: [lesson.problems[index]] } }]} />;
}
