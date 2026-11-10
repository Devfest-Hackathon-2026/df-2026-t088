import { GRADE_ONE_SUMMARY } from "../../lesson/grade-one-summary";
import { MeasurementActivity } from "./MeasurementActivity";
import { GradeOneGuide, GradeOneProblemVisual } from "./GradeOneGuide";
import { useState } from "react";
import type { GradeOneTopic } from "../../lesson/grade-one";
import { LessonButton } from "./LessonButton";
import "./lesson.css";
import "./GradeOneLesson.css";

const content: Record<GradeOneTopic, { title: string; problem: string; clue: string; diagram: string[]; question: string; options: string[]; correct: number; explanation: string }> = {
  compare: { title: "かずを くらべよう", problem: "りんごが3こ、みかんが2こ あります。どちらが おおいかな？", clue: "1こずつ ペアにして くらべよう。", diagram: ["🍎 🍎 🍎", "🍊 🍊"], question: "どちらが おおい？", options: ["りんご", "みかん"], correct: 0, explanation: "1こずつ ペアにすると、りんごが1こ あまります。" },
  count: { title: "かずを かぞえよう", problem: "ほしは ぜんぶで なんこ あるかな？", clue: "ひだりから 1こずつ かぞえよう。", diagram: ["⭐ ⭐ ⭐ ⭐"], question: "ほしは なんこ？", options: ["4こ", "3こ"], correct: 0, explanation: "1、2、3、4。ほしは ぜんぶで 4こ です。" },
  subtraction: { title: "ひきざんを みつけよう", problem: "りんごが5こ あります。2こ たべると、のこりは なんこ？", clue: "たべた 2こを とりのぞこう。", diagram: ["🍎 🍎 🍎 🍎 🍎", "2こ たべる"], question: "どの しきに なるかな？", options: ["5 − 2", "5 ＋ 2"], correct: 0, explanation: "たべると へるので、5 − 2 ＝ 3こ です。" },
  addition: { title: "たしざんを みつけよう", problem: "りんごが3こ あります。2こ もらうと、ぜんぶで なんこ？", clue: "もらった 2こを あわせよう。", diagram: ["🍎 🍎 🍎", "🍎 🍎"], question: "どの しきに なるかな？", options: ["3 ＋ 2", "3 − 2"], correct: 0, explanation: "もらうと ふえるので、3 ＋ 2 ＝ 5こ です。" },
  shape: { title: "かたちを みつけよう", problem: "どの むきにも ころがる ものは どれ？", clue: "かたちを よく みてみよう。", diagram: ["⚽ ボール", "📦 はこ"], question: "どちらが ころがる？", options: ["ボール", "はこ"], correct: 0, explanation: "ボールは まるく、いろいろな むきに ころがります。" },
  length: { title: "ながさを くらべよう", problem: "あかい テープと あおい テープ。どちらが ながいかな？", clue: "ひだりの はしを そろえて くらべよう。", diagram: ["🔴 🔴 🔴 🔴", "🔵 🔵 🔵"], question: "どちらが ながい？", options: ["あかい テープ", "あおい テープ"], correct: 0, explanation: "はしを そろえると、あかい テープの ほうが ながいね。" },
  clock: { title: "とけいを よもう", problem: "とけいを みて、なんじか よもう。", clue: "ながい はりが12の とき、みじかい はりの かずが なんじかを あらわすよ。", diagram: ["🕒", "みじかい はり → 3　ながい はり → 12"], question: "なんじ？", options: ["3じ", "12じ"], correct: 0, explanation: "みじかい はりが3を さしているので、3じ です。" },
  order: { title: "かずの じゅんばん", problem: "1、2、□、4。□に はいる かずは？", clue: "1ずつ ふえる じゅんばんを みよう。", diagram: ["1 → 2 → □ → 4"], question: "□は いくつ？", options: ["3", "5"], correct: 0, explanation: "2の つぎ、4の まえは 3です。" },
  compose: { title: "かずを わけよう", problem: "5こを 2こと □こに わけます。□は なんこ？", clue: "2この あとに のこる かずを かぞえよう。", diagram: ["🍎 🍎 ｜ 🍎 🍎 🍎", "2こ と □こで 5こ"], question: "□は なんこ？", options: ["3こ", "2こ"], correct: 0, explanation: "5は 2と3に わけられます。" },
  tens: { title: "10の まとまり", problem: "10この たばが1つと、ばらが4こ。ぜんぶで なんこ？", clue: "10と4を あわせよう。", diagram: ["［10この たば］　● ● ● ●"], question: "ぜんぶで？", options: ["14こ", "4こ"], correct: 0, explanation: "10と4で 14。14は 10が1つと 1が4つです。" },
  hundred: { title: "10の たばを かぞえよう", problem: "10この たばが10こ あります。ぜんぶで なんこ？", clue: "10ずつ じゅんに かぞえよう。", diagram: ["10　10　10　10　10", "10　10　10　10　10"], question: "ぜんぶで？", options: ["100こ", "10こ"], correct: 0, explanation: "10の まとまりが10こで、100こです。" },
  "tens-unit": { title: "10を たんいに みよう", problem: "10この たばが3つ。ぜんぶで なんこ？", clue: "10ずつ じゅんに かぞえよう。", diagram: ["［10］ ［10］ ［10］"], question: "ぜんぶで？", options: ["30こ", "3こ"], correct: 0, explanation: "10が3つで 30です。" },
  groups: { title: "おなじかずに わけよう", problem: "あめ6こを 2にんに おなじかずずつ わけます。ひとり なんこ？", clue: "1こずつ じゅんばんに わけよう。", diagram: ["わける あめ　🍬 🍬 🍬 🍬 🍬 🍬", "ひとりめ　□　　ふたりめ　□"], question: "ひとり なんこ？", options: ["3こ", "2こ"], correct: 0, explanation: "6こを おなじかずずつ わけると、ひとり3こです。" },
  "compare-groups": { title: "まとまりで かぞえよう", problem: "10この たばが2つと ばらが3こ。ぜんぶで？", clue: "10ずつ かぞえてから、ばらを あわせよう。", diagram: ["［10］ ［10］　● ● ●"], question: "ぜんぶで？", options: ["23こ", "13こ"], correct: 0, explanation: "10が2つで20、あと3こで23です。" },
  carry: { title: "くりあがりの たしざん", problem: "8 ＋ 5は いくつ？", clue: "8に2を たして10に しよう。5は2と3に わけられるよ。", diagram: ["● ● ● ● ● ● ● ●", "● ● ● ● ●"], question: "こたえは？", options: ["13", "12"], correct: 0, explanation: "8に2を たすと10。のこりの3を たして13です。" },
  "two-digit": { title: "おおきい かずの けいさん", problem: "20 ＋ 3は いくつ？", clue: "10の まとまりと ばらを あわせよう。", diagram: ["［10］ ［10］ ＋ ● ● ●"], question: "こたえは？", options: ["23", "203"], correct: 0, explanation: "20と3を あわせて23です。" },
  borrow: { title: "くりさがりの ひきざん", problem: "13こから 5こ とると、のこりは？", clue: "13を10と3に わけ、10から5を ひこう。", diagram: ["● ● ● ● ● ● ● ● ● ● ● ● ●"], question: "のこりは？", options: ["8こ", "9こ"], correct: 0, explanation: "10から5を ひくと5。のこりの3と あわせて8こです。" },
  "shape-build": { title: "かたちを つくろう", problem: "おなじ かたちの さんかく2まいを、ななめの へんで あわせると？", clue: "さんかくを あわせて できる かたちを かんがえよう。", diagram: ["◢　◤"], question: "なにが できる？", options: ["しかく", "まる"], correct: 0, explanation: "さんかくを2まい あわせると、しかくが できます。" },
  position: { title: "みぎと ひだり", problem: "えを みている ひとから みて、いぬの みぎに いるのは どっち？", clue: "えを みた じぶんの みぎがわを みよう。", diagram: ["🐱　🐶　🐰"], question: "いぬの みぎは？", options: ["うさぎ", "ねこ"], correct: 0, explanation: "えで いぬの みぎに いるのは うさぎです。" },
  "shape-parts": { title: "かたちを みつけよう", problem: "つみきが 2こ あります。ひだりから みぎに ならべるのは、どんな ならび？", clue: "ひだりから みぎの むきを かんがえよう。", diagram: ["🟦　🟦"], question: "なんと いう ならび？", options: ["よこ", "たて"], correct: 0, explanation: "2こを よこに ならべると、よこに ながい かたちです。" },
  measure: { title: "いくつぶんの ながさ", problem: "えんぴつは おなじ ながさの ブロック なんこぶん？", clue: "はしから すきまなく ならべよう。", diagram: ["えんぴつ　━━━━━━━━", "ブロック　🟦 🟦 🟦 🟦"], question: "なんこぶん？", options: ["4こぶん", "3こぶん"], correct: 0, explanation: "おなじ ブロックを4こ ならべた ながさです。" },
  volume: { title: "みずの かさを くらべよう", problem: "おなじ コップに いっぱいずつ いれると、Aは3ばい、Bは2はい。どちらが おおい？", clue: "おなじ コップの はいすうを くらべよう。", diagram: ["A　🥛 🥛 🥛", "B　🥛 🥛"], question: "どちらが おおい？", options: ["A", "B"], correct: 0, explanation: "おなじ コップで3はいの Aが おおいです。" },
  "daily-time": { title: "とけいと せいかつ", problem: "がっこうが はじまる ときの とけいです。なんじかな？", clue: "ながい はりが12の とき、みじかい はりの かずを よもう。", diagram: ["🕗"], question: "なんじ？", options: ["8じ", "12じ"], correct: 0, explanation: "ながい はりが12、みじかい はりが8を さしているので、8じ です。" },
  "chart-read": { title: "ずから かんがえよう", problem: "すきな あそびを しらべました。おにごっこが すきな ひとは なんにん？", clue: "●ひとつが ひとりぶんです。", diagram: ["おにごっこ　● ● ● ●", "なわとび　　● ●"], question: "おにごっこは？", options: ["4にん", "2にん"], correct: 0, explanation: "●が4こ あるので、4にんです。" },
  chart: { title: "えを よみとろう", problem: "すきな くだものを しらべました。りんごと みかん、どちらが おおい？", clue: "え 1こは、ひとりぶん です。", diagram: ["りんご　● ● ●", "みかん　● ●"], question: "どちらが おおい？", options: ["りんご", "みかん"], correct: 0, explanation: "りんごは3にん、みかんは2にん。りんごが おおいね。" },
};
/** 全角数字や記号・空白の違いを吸収する。 */
function normalizeAnswer(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s/g, "")
    .replace(/[ァ-ヶ]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60))
    .replace(/[−－]/g, "-").replace(/たす/g, "+").replace(/ひく/g, "-")
    .replace(/個分/g, "こぶん").replace(/個/g, "こ").replace(/人/g, "にん").replace(/時/g, "じ");
}
/** 本題とは別の小さな数で、記号とものの動きを結びつける。 */
function OperationGuide({ topic, onDone, onExit }: { topic: "addition" | "subtraction"; onDone: () => void; onExit: () => void }) {
  const [step, setStep] = useState(0);
  const addition = topic === "addition";
  return <main className="lesson grade-one"><header className="lesson-header"><h1>{addition ? "たしざんを しろう" : "ひきざんを しろう"}</h1><LessonButton text="やめて盤面にもどる" variant="text" onClick={onExit} /></header><section className="lesson-card">
    <p>{addition ? step === 0 ? "りんごが1こ。もう1こ もらうと、どうなるかな？" : "2つを あわせる ときは、＋（たす）を つかうよ。" : step === 0 ? "りんごが4こ。1こ たべると、どうなるかな？" : "ある かずから とりのぞく ときは、−（ひく）を つかうよ。"}</p>
    <div className={`grade-one__operation ${step === 1 && addition ? "is-joined" : ""}`} role="img" aria-label={addition ? step === 0 ? "りんご1こと1こ" : "あわせたりんご2こ" : step === 0 ? "りんご4こ" : "りんご4このうち1こをとりのぞく図"}>
      {addition ? step === 0 ? <><span>🍎</span><span>＋</span><span>🍎</span></> : <><span>🍎</span><span>🍎</span></> : Array.from({ length: 4 }, (_, i) => <span key={i} className={step === 1 && i === 3 ? "is-removed" : ""}>🍎</span>)}
    </div>
    {step === 1 && <p className="grade-one__operation-formula">{addition ? "1 ＋ 1 ＝ 2" : "4 − 1 ＝ 3"}</p>}
    <div className="grade-one__buttons">{step > 0 && <button type="button" onClick={() => setStep(0)}>もどる</button>}{step === 0 && <button type="button" onClick={() => setStep(1)}>{addition ? "あわせる" : "1こ とりのぞく"}</button>}<button type="button" onClick={onDone}>もんだいに すすむ</button></div><p>{step + 1} / 2</p>
  </section></main>;
}
export function GradeOneLesson({ topic, topics, onExit, onFinish }: { topic: GradeOneTopic; topics?: readonly GradeOneTopic[]; onExit: () => void; onFinish: () => void }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const currentTopic = topics?.[questionIndex] ?? topic;
  const data = topics ? GRADE_ONE_SUMMARY[currentTopic] : content[currentTopic];
  const [answer, setAnswer] = useState("");
  const expected = normalizeAnswer(data.options[data.correct]);
  const numericAnswer = /^(\d+)(こぶん|こ|にん|じ)$/.exec(expected);
  const alternativeAnswers: Partial<Record<GradeOneTopic, string[]>> = {
    addition: topics ? [] : ["3+2=5"], subtraction: topics ? [] : ["5-2=3"],
    length: topics ? ["あおい", "あおいテープ", "青", "青い", "青いテープ"] : ["あか", "あかい", "赤", "赤い", "赤いテープ"],
    "shape-build": topics ? [] : ["四角", "しかくけい"],
    "shape-parts": topics ? ["縦", "たてならび"] : ["横", "よこならび"],
  };
  const isNumber = /^\d+$/.test(expected) || numericAnswer !== null;
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState("");
  const operation = !topics && (topic === "addition" || topic === "subtraction") ? topic : null;
  const [operationGuide, setOperationGuide] = useState(false);
  if (operationGuide && operation) return <OperationGuide topic={operation} onDone={() => setOperationGuide(false)} onExit={onExit} />;
  return <main className="lesson grade-one"><header className="lesson-header"><h1>{data.title}</h1><LessonButton text="やめて盤面にもどる" variant="text" onClick={onExit} /></header>
    <section className="lesson-card"><p>{questionIndex + 1} / {topics?.length ?? 1} 問</p><p>{data.problem}</p>
      {(currentTopic === "length" || currentTopic === "measure") ? <MeasurementActivity key={currentTopic} kind={currentTopic} unitCount={topics ? 3 : 4} /> : <div className={`grade-one__diagram grade-one__diagram--${currentTopic}`} role="img" aria-label={(currentTopic === "clock" || currentTopic === "daily-time") ? `ながい はりが12、みじかい はりが${(currentTopic === "daily-time") !== Boolean(topics) ? 8 : 3}を さす とけい` : data.diagram.join("、")}>
        {["clock", "daily-time", "length", "measure"].includes(currentTopic)
          ? <GradeOneProblemVisual topic={topics && (currentTopic === "clock" || currentTopic === "daily-time") ? (currentTopic === "clock" ? "daily-time" : "clock") : currentTopic} />
          : data.diagram.map((line, i) => <div key={i} className={`grade-one__line grade-one__line--${i}`}>{line}</div>)}
      </div>}
      {step === 0 ? <form className="grade-one__answer" onSubmit={(event) => { event.preventDefault(); const value = normalizeAnswer(answer); if (!value) { setFeedback("こたえを いれてね。"); return; } if (value === expected || (numericAnswer !== null && value === numericAnswer[1]) || (alternativeAnswers[currentTopic] ?? []).some((candidate) => normalizeAnswer(candidate) === value)) { setStep(1); setFeedback(""); } else setFeedback("もういちど えを みてみよう。"); }}><label htmlFor="grade-one-answer">{data.question}</label><div className="grade-one__buttons"><input id="grade-one-answer" type="text" inputMode={isNumber ? "numeric" : "text"} autoComplete="off" maxLength={30} value={answer} onChange={(event) => setAnswer(event.target.value)} /><button type="submit">こたえる</button></div><p role="status">{feedback}</p></form> : <><p role="status">{data.explanation}</p><button type="button" onClick={() => { if (topics && questionIndex + 1 < topics.length) { setQuestionIndex(questionIndex + 1); setStep(0); setAnswer(""); setFeedback(""); } else onFinish(); }}>{topics && questionIndex + 1 < topics.length ? "つぎの問題へ" : "ばんめんにもどる"}</button></>}
      {!topics && step === 0 && <details className="grade-one__hint"><summary>ヒント</summary><p>{data.clue}</p></details>}
      {operation && step === 0 && <button type="button" onClick={() => setOperationGuide(true)}>{operation === "addition" ? "たしざん" : "ひきざん"}の せつめいを みる</button>}
      {step === 0 && !topics && currentTopic !== "length" && currentTopic !== "measure" && <GradeOneGuide key={currentTopic} topic={currentTopic} />}

    </section></main>;
}
