import { useState } from "react";
import { LessonButton } from "./LessonButton";
import "./MakeTenLesson.css";

type Stage = "predict" | "move" | "equation" | "answer" | "correct" | "transfer" | "done";
const number = (value: string) => value.normalize("NFKC").replace(/\s/g, "");

/** 操作と式を対応させる。予想や途中の操作は正誤を判定せずに残す。 */
export function MakeTenLesson({ onExit, onFinish, initialStage = "predict" }: { onExit: () => void; onFinish: () => void; initialStage?: "predict" | "transfer" }) {
  const [stage, setStage] = useState<Stage>(initialStage);
  const [prediction, setPrediction] = useState("");
  const [moved, setMoved] = useState(0);
  const [answer, setAnswer] = useState("");
  const [reason, setReason] = useState("");
  const [transfer, setTransfer] = useState("");
  const [message, setMessage] = useState("");
  const moveOne = () => setMoved((current) => Math.min(2, current + 1));
  const start = () => {
    if (!/^\d+$/.test(number(prediction))) { setMessage("いくつに なりそうか、数字で 入れてね。"); return; }
    setMessage(""); setStage("move");
  };
  return <main className="lesson grade-two make-ten"><header className="lesson-header"><h1>10を つくって 考えよう</h1><LessonButton text="やめて盤面にもどる" variant="text" onClick={onExit} /></header>
    <section className="lesson-card">
      {stage === "transfer" || stage === "done" ? <>
        <p>こんどは、あめが9こ。7こ もらうと、ぜんぶで何こ？</p>
        <p>9こに いくつ たすと、10こに なるかな？</p>
        <div className="make-ten__simple" aria-label="9この あめと 7この あめ"><span>🍬 🍬 🍬 🍬 🍬 🍬 🍬 🍬 🍬</span><span>🍬 🍬 🍬 🍬 🍬 🍬 🍬</span></div>
        {stage === "transfer" ? <form onSubmit={(e) => { e.preventDefault(); if (number(transfer) === "16") { setMessage(""); setStage("done"); } else setMessage("9こに 1こ たすと10こ。7この うち、のこりは いくつかな？"); }}><label htmlFor="make-ten-transfer">こたえ</label><div className="grade-two__controls"><input id="make-ten-transfer" value={transfer} onChange={(e) => setTransfer(e.target.value)} inputMode="numeric" /><button type="submit">こたえる</button></div></form> : <><p>9こに1こを たして10こ。のこり6こを あわせて16こです。</p><button type="button" onClick={onFinish}>ばんめんにもどる</button></>}
      </> : <>
        <p>あめが8こあります。5こ もらうと、ぜんぶで何こに なりそう？</p>
        <div className="make-ten__groups">
          <div><strong>はじめの 8こ</strong><div className="make-ten__frame" aria-label={`10この ます。はじめの8こと、うつした${moved}こ`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.getData("text/plain") === "candy") moveOne(); }}>
            {Array.from({ length: 10 }, (_, i) => <span key={i} className={`make-ten__slot ${i >= 8 && i < 8 + moved ? "is-moved" : ""}`}>{i < 8 + moved ? "●" : ""}</span>)}
          </div></div>
          <div><strong>もらった 5こ</strong><div className="make-ten__candy">{Array.from({ length: 5 }, (_, i) => i < moved ? <span key={i} className="make-ten__empty" aria-hidden="true" /> : stage === "move" ? <button key={i} type="button" className="make-ten__piece" aria-label={`${i + 1}こめの あめを ひだりへ うつす`} disabled={moved === 2} draggable={moved < 2} onDragStart={(e) => e.dataTransfer.setData("text/plain", "candy")} onClick={moveOne}>●</button> : <span key={i} className="make-ten__piece make-ten__piece--still">●</span>)}</div></div>
        </div>
        {stage === "predict" && <form onSubmit={(e) => { e.preventDefault(); start(); }}><label htmlFor="make-ten-predict">ぜんぶで なんこに なりそう？</label><div className="grade-two__controls"><input id="make-ten-predict" inputMode="numeric" value={prediction} onChange={(e) => setPrediction(e.target.value)} /><button type="submit">よそうして すすむ</button></div><p>まだ せいかいは 分からなくても だいじょうぶ。</p></form>}
        {stage === "move" && <><p>ひだりを10こに するには？ あめを おすか、ひだりの ますへ はこぼう。</p><p aria-live="polite">{moved === 0 ? "あいている ますに 注目。" : moved === 1 ? "1こ うつしたよ。ますは いっぱいに なったかな？" : "10この ますが いっぱい！ 5こから 2こを うつしたよ。"}</p><div className="grade-two__controls"><button type="button" onClick={() => setMoved(Math.max(0, moved - 1))} disabled={moved === 0}>1こ もどす</button><button type="button" onClick={() => setStage("equation")} disabled={moved !== 2}>つぎへ</button><button type="button" onClick={() => setStage("predict")}>よそうに もどる</button></div></>}
        {stage === "equation" && <><p>5こを、うつした2こと、のこりの3こに 分けたね。</p><p className="make-ten__equation">8 ＋ 5 ＝ 8 ＋ <strong>2</strong> ＋ <strong>3</strong></p><p>はじめの8こと、うつした2こで10こ。のこりは3こ。</p><div className="grade-two__controls"><button type="button" onClick={() => setStage("move")}>うごきに もどる</button><button type="button" onClick={() => setStage("answer")}>こたえを 考える</button></div></>}
        {stage === "answer" && <><p className="make-ten__equation">8 ＋ 5 ＝ 10 ＋ 3 ＝ □</p><p>よそうは {prediction}こ。10こと のこりを あわせると？</p><form onSubmit={(e) => { e.preventDefault(); if (number(answer) === "13") { setMessage(""); setStage("correct"); } else setMessage("10この まとまりと、のこりの3こを いっしょに 数えてみよう。"); }}><label htmlFor="make-ten-answer">こたえ</label><div className="grade-two__controls"><input id="make-ten-answer" inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value)} /><button type="submit">こたえる</button><button type="button" onClick={() => setStage("equation")}>まえへ</button></div></form></>}
        {stage === "correct" && <><p>10こと、のこりの3こで 13こだね。</p><p className="make-ten__equation">8 ＋ 5 ＝ 8 ＋ 2 ＋ 3 ＝ 10 ＋ 3 ＝ 13</p><div className="make-ten__reflection"><label htmlFor="make-ten-reason">どうやって 考えた？（かかなくても いいよ）</label><input id="make-ten-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div><button type="button" onClick={() => setStage("transfer")}>ちがう 数でも やってみる</button></>}
      </>}
      {message && <p role="status">{message}</p>}
    </section></main>;
}
