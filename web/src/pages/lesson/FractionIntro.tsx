import { useEffect, useState } from "react";
import { Ruby } from "../../components/Ruby";
import { LessonButton } from "./LessonButton";
import type { LessonDefinition } from "../../lesson/problems";
import "./FractionIntro.css";

type Intro = NonNullable<LessonDefinition["intro"]>;
const lessons: Record<Intro, { text: string; split: number; filled: number; formula: string }[]> = {
  division: [
    { text: "3 Lのジュースを、4人で同じ量ずつ分けます。1人分は何 Lでしょう？", split: 1, filled: 1, formula: "3 ÷ 4" },
    { text: "1 Lを4等分すると、1つ分は1/4 L。3 Lそれぞれから1つ分ずつもらいます。", split: 4, filled: 1, formula: "1/4 ＋ 1/4 ＋ 1/4" },
    { text: "1/4 Lが3つで3/4 L。3 ÷ 4は3/4と表せます。", split: 4, filled: 3, formula: "3 ÷ 4 ＝ 3/4" },
  ],
  decimal: [
    { text: "1を10等分した1つ分は1/10。小数では0.1です。", split: 10, filled: 1, formula: "0.1 ＝ 1/10" },
    { text: "0.5は0.1が5つ分。だから5/10です。", split: 10, filled: 5, formula: "0.5 ＝ 5/10" },
    { text: "5/10と1/2は同じ大きさ。1は1/1と表すこともできます。", split: 10, filled: 5, formula: "0.5 ＝ 5/10 ＝ 1/2" },
  ],
  equivalent: [
    { text: "1を2等分した1つ分が1/2です。", split: 2, filled: 1, formula: "1/2" },
    { text: "1/2のそれぞれを3つに分けると、全体は6等分。色の部分は3つ分です。", split: 6, filled: 3, formula: "1/2 ＝ 3/6" },
    { text: "分子と分母を同じ数でかけると、分数の大きさは変わりません。", split: 6, filled: 3, formula: "1/2 → 上も下も ×3 → 3/6" },
  ],
};
export function FractionIntro({ intro, title, onExit, onFinish }: { intro: Intro; title: string; onExit: () => void; onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const items = lessons[intro];
  const step = items[index];
  useEffect(() => {
    if (!playing) return;
    if (index === items.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setIndex(index + 1), 11000);
    return () => window.clearTimeout(timer);
  }, [playing, index, items.length]);
  return <main className="lesson fraction-intro">
    <header className="lesson-header"><h1><Ruby text={title} /></h1><LessonButton text="やめる" variant="text" onClick={onExit} /></header>
    <section className="lesson-card"><p>アニメーションで見てみよう　{index + 1} / {items.length}</p><p aria-live="polite">{step.text}</p>
      <div className={`fraction-intro__scene ${intro === "decimal" ? `fraction-decimal fraction-decimal-${index}` : ""}`} key={index} role="img" aria-label={intro === "division" && index < 2 ? "1リットルが3つ。それぞれを4人に等しく分ける" : `全体を${step.split}等分したうちの${step.filled}つ分`}>
        {intro === "equivalent" && index === 1 ? <div className="fraction-intro__split-demo" aria-hidden="true">
          <div className="fraction-intro__half is-filled">1/2</div><div className="fraction-intro__half">1/2</div>
          <div className="fraction-intro__new-cuts"><i /><i /><i /><i /></div>
          <div className="fraction-intro__six-labels"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span></div>
        </div> : Array.from({ length: intro === "division" && index < 2 ? 3 : 1 }, (_, row) => <div className="fraction-intro__portion" key={row}>
          <div className="fraction-intro__bar">
            {Array.from({ length: step.split }, (_, i) => <span key={i} className={i < step.filled ? "is-filled" : ""}>{step.split === 1 ? "1 L" : i + 1}</span>)}
          </div>
          {intro === "division" && index === 1 && <span className={`fraction-intro__receive receive-${row + 1}`} aria-hidden="true">→ 1/4 L</span>}
        </div>)}
        {intro === "decimal" && index === 2 && <div className="fraction-intro__comparison"><div>同じ大きさの 1/2</div><div className="fraction-intro__bar"><span className="is-filled">1/2</span><span>1/2</span></div></div>}
        {intro === "division" && index === 1 && <div className="fraction-intro__recipient">1人分：<span className="receive-1">1/4</span><span className="receive-2"> ＋ 1/4</span><span className="receive-3"> ＋ 1/4 L</span></div>}
      </div><p className="fraction-intro__formula">{step.formula}</p>
      <div className="fraction-intro__controls"><button type="button" disabled={index === 0} onClick={() => { setPlaying(false); setIndex(index - 1); }}>もどる</button><button type="button" onClick={() => { if (index === items.length - 1) setIndex(0); setPlaying(!playing); }}>{playing ? "一時停止" : "再生"}</button>{index < items.length - 1 ? <button type="button" onClick={() => { setPlaying(false); setIndex(index + 1); }}>つぎへ</button> : <button type="button" onClick={onFinish}>おわる</button>}</div>
    </section>
  </main>;
}
