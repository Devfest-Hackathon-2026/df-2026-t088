import { useState } from "react";
import type { GradeTwoQuestion } from "../../lesson/grade-two";
import { LessonButton } from "./LessonButton";
import { MakeTenLesson } from "./MakeTenLesson";
import { FractionAnswer } from "./FractionAnswer";
import "./lesson.css";
import "./GradeTwoLesson.css";

function normalize(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s/g, "")
    .replace(/[ァ-ヶ]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60))
    .replace(/[−－]/g, "-").replace(/[x*]/g, "×").replace(/かける/g, "×")
    .replace(/個/g, "こ").replace(/本/g, "ほん").replace(/枚/g, "まい").replace(/人/g, "にん")
    .replace(/時間/g, "じかん").replace(/分/g, "ふん").replace(/面/g, "めん").replace(/円/g, "えん");
}
function correctAnswer(input: string, expected: string): boolean {
  const value = normalize(input);
  const normalized = normalize(expected);
  if (value === normalized) return true;
  const count = /^(\d+)(こ|ほん|まい|にん|ふん|じかん|めん|えん|cm|mm|dl)$/.exec(normalized);
  if (count && value === count[1]) return true;
  if (normalized === "おなじ" && ["同じ", "同じです", "おなじです"].some((v) => normalize(v) === value)) return true;
  if (normalized === "あか" && ["赤", "赤い", "あかい", "あかいテープ", "赤いテープ"].some((v) => normalize(v) === value)) return true;
  const shapeNames: Record<string, string[]> = { "さんかくけい": ["三角形", "さんかく"], "しかくけい": ["四角形", "しかく"], "せいほうけい": ["正方形"], "ちょうほうけい": ["長方形"] };
  if ((shapeNames[normalized] ?? []).some((v) => normalize(v) === value)) return true;
  if (normalized === "たいら" && ["たいらなめん", "平ら", "平らな面"].some((v) => normalize(v) === value)) return true;
  const fraction = /^(\d+)\/(\d+)$/.exec(normalized);
  if (fraction && value === `${fraction[2]}ふんの${fraction[1]}`) return true;
  return false;
}
/** 問題とは別の1/4で、分母と分子が表すものを先に見る。 */
function FractionBasicsGuide({ onDone, onExit }: { onDone: () => void; onExit: () => void }) {
  const [step, setStep] = useState(0);
  const descriptions = [
    "水が1Lあります。この1Lを、同じ大きさに分けて考えましょう。",
    "1Lを同じ大きさに4つに分けました。下の数、分母の4は、1を4等分したことを表します。",
    "4つのうち1つ分です。上の数、分子の1は、1つ分を表します。",
  ];
  return <main className="lesson grade-two"><header className="lesson-header"><h1>分数の見方を知ろう</h1><LessonButton text="やめて盤面にもどる" variant="text" onClick={onExit} /></header><section className="lesson-card">
    <p aria-live="polite">{descriptions[step]}</p><div className="fraction-basics"><p>ぜんぶで 1L</p><div className="fraction-basics__bar" role="img" aria-label={step === 0 ? "1L全体" : step === 1 ? "1Lを4等分した図" : "1Lを4等分したうちの1つ分"}>{step === 0 ? <span className="is-whole" /> : Array.from({ length: 4 }, (_, i) => <span key={i} className={step === 2 && i === 0 ? "is-selected" : ""} />)}</div></div>
    {step > 0 && <div className="fraction-basics__formula"><span className="fraction-basics__stack" role="img" aria-label={step === 1 ? "分子がしかく、分母が4" : "4分の1"}><span>{step === 1 ? "□" : "1"}</span><span>4</span></span>{step === 2 && <span>L</span>}<span>{step === 1 ? "下の4：1を4等分" : "上の1：そのうち1つ分"}</span></div>}
    <div className="grade-two__controls">{step > 0 && <button type="button" onClick={() => setStep(step - 1)}>もどる</button>}{step < 2 && <button type="button" onClick={() => setStep(step + 1)}>つぎへ</button>}<button type="button" onClick={onDone}>問題にすすむ</button></div><p>{step + 1} / 3</p>
  </section></main>;
}
/** 別の数で、まとまり・たし算・かけ算の各部分を対応させる。 */
function MultiplicationBasicsGuide({ onDone, onExit }: { onDone: () => void; onExit: () => void }) {
  const [step, setStep] = useState(0);
  const descriptions = [
    "1ふくろに2こずつ あめが入っています。同じふくろが3つあります。",
    "1ふくろの2こを、ふくろの数だけ たすと表せます。",
    "同じ数をくり返したすとき、かけ算で表せます。",
  ];
  return <main className="lesson grade-two"><header className="lesson-header"><h1>かけ算の式を知ろう</h1><LessonButton text="やめて盤面にもどる" variant="text" onClick={onExit} /></header><section className="lesson-card">
    <p aria-live="polite">{descriptions[step]}</p><div className="grade-two__group-list" role="img" aria-label="2こずつのあめが入った、3つのふくろ">{Array.from({ length: 3 }, (_, i) => <div key={i} className="grade-two__group"><span>{i + 1}ふくろ目</span><div className="grade-two__group-items"><span>🍬</span><span>🍬</span></div></div>)}</div>
    {step >= 1 && <p className="multiplication-basics__formula">2 ＋ 2 ＋ 2{step >= 2 && " ＝ 2 × 3"}</p>}
    {step >= 2 && <p><strong>2</strong> は1ふくろの数、<strong>3</strong> はふくろの数です。<br />「1つ分の数 × いくつ分」で表します。</p>}
    <div className="grade-two__controls">{step > 0 && <button type="button" onClick={() => setStep(step - 1)}>もどる</button>}{step < 2 && <button type="button" onClick={() => setStep(step + 1)}>つぎへ</button>}<button type="button" onClick={onDone}>問題にすすむ</button></div><p>{step + 1} / 3</p>
  </section></main>;
}
/** 10この束を1つずつ数え、残りのばらは答えを出さずに示す。 */
function TenBundles({ groups, singles }: { groups: number; singles: number }) {
  const [counted, setCounted] = useState(0);
  return <div className="grade-two__bundles">
    <p>1つの たばに ●が10こ 入っています。</p>
    <div className="grade-two__bundle-list">{Array.from({ length: groups }, (_, group) => <div key={group} className={`grade-two__bundle ${group < counted ? "is-counted" : ""}`} aria-label={`10この たば ${group + 1}つめ${group < counted ? "、かぞえた" : ""}`}>
      <span className="grade-two__bundle-name">10こ</span><span className="grade-two__dots" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <span key={i}>●</span>)}</span>{group < counted && <span className="grade-two__subtotal">ここまで {10 * (group + 1)}こ</span>}
    </div>)}</div>
    <div className="grade-two__singles">ばら：{Array.from({ length: singles }, (_, i) => <span key={i}>●</span>)}</div>
    <div className="grade-two__controls"><button type="button" disabled={counted === groups} onClick={() => setCounted(counted + 1)}>たばを 1つ 数える</button><button type="button" disabled={counted === 0} onClick={() => setCounted(0)}>はじめから</button></div>
    <p role="status">{counted === 0 ? "10こずつ 数えてみよう。" : counted < groups ? `ここまで ${counted * 10}こ。つぎの たばも 数えよう。` : `たばは ${counted * 10}こ。ばらを あわせると？`}</p>
  </div>;
}
function Ruler() {
  return <div className="grade-two__ruler" role="img" aria-label="0から8までのものさし。えんぴつは0から、6のつぎの目もりまで">
    <div className="grade-two__pencil">えんぴつ</div><div className="grade-two__ticks">{Array.from({ length: 9 }, (_, i) => <span key={i} style={{ left: `${i * 12.5}%` }}>{i}</span>)}</div><span>cm</span>
  </div>;
}
function ColumnAddition({ top, bottom, showHint }: { top: number; bottom: number; showHint: boolean }) {
  const [step, setStep] = useState(-1);
  const a = top % 10;
  const b = bottom % 10;
  const ones = a + b;
  const descriptions = [
    `まず、一のくらいの ${a} と ${b} を たそう。`,
    `${a}＋${b}＝${ones}。一のくらいに ${ones % 10} を書き、10のまとまりを 十のくらいへ くり上げよう。`,
    `十のくらいの ${Math.floor(top / 10)} と ${Math.floor(bottom / 10)} に、くり上がった 1 も たそう。`,
  ];
  const focus = (column: "tens" | "ones") => step >= 0 && ((step < 2 && column === "ones") || (step === 2 && column === "tens")) ? "is-focused" : "";
  return <div className="column-add">
    <table className="column-add__table" aria-label={`${top} たす ${bottom} のひっ算`}>
      <thead><tr><td /><th scope="col">十のくらい</th><th scope="col">一のくらい</th></tr></thead>
      <tbody>
        {step >= 1 && <tr className="column-add__carry"><th scope="row">くり上がり</th><td className={focus("tens")}>1</td><td /></tr>}
        <tr><th scope="row"><span className="lesson-hidden">たされる数</span></th><td className={focus("tens")}>{Math.floor(top / 10)}</td><td className={focus("ones")}>{a}</td></tr>
        <tr><th scope="row">＋</th><td className={focus("tens")}>{Math.floor(bottom / 10)}</td><td className={focus("ones")}>{b}</td></tr>
        {step >= 1 && <tr className="column-add__result"><th scope="row">こたえ</th><td>□</td><td>{ones % 10}</td></tr>}
      </tbody>
    </table>
    {showHint && <div className="column-add__guide">
      {step < 0 ? <button type="button" onClick={() => setStep(0)}>ひっ算の やり方を見る</button> : <><p aria-live="polite">{descriptions[step]}</p><div className="grade-two__controls"><button type="button" onClick={() => setStep(step - 1)}>まえへ</button><span>{step + 1} / 3</span><button type="button" disabled={step === 2} onClick={() => setStep(step + 1)}>つぎへ</button><button type="button" onClick={() => setStep(-1)}>とじる</button></div></>}
    </div>}
  </div>;
}
function GroupDiagram({ each, count, item, label, showHint }: { each: number; count: number; item: string; label: string; showHint: boolean }) {
  const [active, setActive] = useState(-1);
  const groupName = (index: number) => label === "人" ? `${index + 1}人目` : `${index + 1}つめの ${label}`;
  return <div className="grade-two__groups"><div className="grade-two__group-list" aria-label={`${each}こずつの ${label}が${count}つ`}>
    {Array.from({ length: count }, (_, group) => <div className={`grade-two__group ${group === active ? "is-focused" : ""}`} key={group}><span>{groupName(group)}</span><div className="grade-two__group-items" aria-label={`${each}こ`}>{Array.from({ length: each }, (_, i) => <span key={i} aria-hidden="true">{item}</span>)}</div></div>)}
  </div>{showHint && <><div className="grade-two__controls"><button type="button" onClick={() => setActive(active < 0 ? 0 : Math.min(active + 1, count - 1))} disabled={active === count - 1}>{active < 0 ? "1つ分を 見る" : "つぎの まとまり"}</button>{active >= 0 && <button type="button" onClick={() => setActive(-1)}>はじめから</button>}</div>{active >= 0 && <p aria-live="polite">{groupName(active)}も {each}こ。おなじ数ずつ あるね。</p>}</>}</div>;
}
function ClockMinutes({ showHint }: { showHint: boolean }) {
  const [moved, setMoved] = useState(false);
  return <div className="grade-two__clock"><div><svg viewBox="0 0 200 200" role="img" aria-label={moved ? "長いはりが12から5目もり進んだ時計" : "長いはりが12をさす時計。小さい目もり1つが1分"}>
    <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" strokeWidth="2" />
    {Array.from({ length: 60 }, (_, i) => <line key={i} x1="100" y1="14" x2="100" y2={i % 5 === 0 ? "25" : "20"} stroke="currentColor" strokeWidth={i % 5 === 0 ? 2 : 1} transform={`rotate(${i * 6} 100 100)`} />)}
    <text x="100" y="42" textAnchor="middle">12</text><text x="157" y="106" textAnchor="middle">3</text><text x="100" y="169" textAnchor="middle">6</text><text x="43" y="106" textAnchor="middle">9</text>
    <line className="grade-two__minute-hand" x1="100" y1="100" x2="100" y2="29" style={{ transform: `rotate(${moved ? 30 : 0}deg)`, transformOrigin: "100px 100px" }} /><circle cx="100" cy="100" r="4" fill="currentColor" />
  </svg></div><div><p>小さい 目もり1つが 1分。長い はりが 1周すると 1時間。</p>{showHint && <><button type="button" onClick={() => setMoved(!moved)}>{moved ? "はりを もどす" : "5目もり うごかす"}</button>{moved && <p aria-live="polite">5目もり すすむと 5分。1周では 何分かな？</p>}</>}</div></div>;
}
function PolygonDiagram({ sides, square, showHint }: { sides: 3 | 4; square?: boolean; showHint: boolean }) {
  const [edge, setEdge] = useState(-1);
  const points = sides === 3 ? [[90, 20], [20, 145], [160, 145]] : square ? [[30, 20], [150, 20], [150, 140], [30, 140]] : [[15, 40], [165, 40], [165, 120], [15, 120]];
  return <div className="grade-two__polygon"><svg viewBox="0 0 180 165" role="img" aria-label={`${sides}本の まっすぐな辺で かこまれた形`}>
    <polygon points={points.map((point) => point.join(",")).join(" ")} fill="var(--color-subject-sansu)" />
    {points.map(([x, y], index) => { const next = points[(index + 1) % points.length]; return <line key={index} x1={x} y1={y} x2={next[0]} y2={next[1]} className={edge === index ? "is-focused" : ""} />; })}
    {points.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="4" fill="currentColor" />)}
  </svg>{showHint && <div><button type="button" onClick={() => setEdge(edge < 0 ? 0 : (edge + 1) % sides)}>{edge < 0 ? "辺を たどる" : "つぎの 辺へ"}</button>{edge >= 0 && <p aria-live="polite">太い線が 1本の 辺だよ。</p>}</div>}</div>;
}
function ArrayComparison({ each, rows, showHint }: { each: number; rows: number; showHint: boolean }) {
  const [rotated, setRotated] = useState(false);
  const dots = (columns: number, rowCount: number) => Array.from({ length: columns * rowCount }, (_, index) => <circle key={index} cx={90 + (index % columns - (columns - 1) / 2) * 28} cy={90 + (Math.floor(index / columns) - (rowCount - 1) / 2) * 28} r="7" />);
  return <div className="array-compare"><div className="array-compare__figures">
    <div className="array-compare__card"><strong>{each} × {rows} の図</strong><p>{rotated ? "図を まわしたところ" : `${each}こずつ ${rows}れつ`}</p><svg viewBox="0 0 180 180" role="img" aria-label={rotated ? `${each}×${rows}の図を回したところ。横に${rows}こずつ、${each}れつ` : `${each}こずつ${rows}れつの図`}><g className="array-compare__turn" style={{ transform: `rotate(${rotated ? 90 : 0}deg)`, transformOrigin: "90px 90px" }}>{dots(each, rows)}</g></svg></div>
    <div className="array-compare__card"><strong>{rows} × {each}</strong><p>{rows}こずつ {each}れつ</p><svg viewBox="0 0 180 180" role="img" aria-label={`${rows}こずつ${each}れつの図`}>{dots(rows, each)}</svg></div>
  </div>{showHint && <div className="grade-two__controls"><button type="button" onClick={() => setRotated(!rotated)}>{rotated ? "図を もどす" : "左の図を まわす"}</button></div>}{rotated && <p aria-live="polite">左の図を まわしたよ。右の図と くらべてみよう。</p>}</div>;
}
function Figures({ question, figures, showHint = false }: { question: GradeTwoQuestion; figures: string[]; showHint?: boolean }) {
  if (question.visual?.type === "ten-bundles") return <TenBundles key={`${question.visual.groups}-${question.visual.singles}`} groups={question.visual.groups} singles={question.visual.singles} />;
  if (question.visual?.type === "column-add") return <ColumnAddition key={`${question.visual.top}-${question.visual.bottom}`} top={question.visual.top} bottom={question.visual.bottom} showHint={showHint} />;
  if (question.visual?.type === "clock-minutes") return <ClockMinutes showHint={showHint} />;
  if (question.visual?.type === "polygon") return <PolygonDiagram key={`${question.visual.sides}-${question.visual.square}`} sides={question.visual.sides} square={question.visual.square} showHint={showHint} />;
  if (question.visual?.type === "array-compare") return <ArrayComparison key={`${question.visual.each}-${question.visual.rows}`} each={question.visual.each} rows={question.visual.rows} showHint={showHint} />;
  if (question.visual?.type === "place-value") {
    const labels = ["千のまとまり", "百のまとまり", "十のまとまり", "1こ"];
    const symbols = ["千", "百", "十", "●"];
    return <div className="grade-two__diagram-scroll"><table className="grade-two__place-table" aria-label="数のまとまり"><thead><tr>{labels.map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody><tr>{question.visual.counts.map((count, col) => <td key={labels[col]} aria-label={`${labels[col]}が${count}こ`}><div className="grade-two__place-pieces" aria-hidden="true">{Array.from({ length: count }, (_, i) => <span key={i}>{symbols[col]}</span>)}</div></td>)}</tr></tbody></table></div>;
  }
  if (question.visual?.type === "place-calculate") {
    const { top, bottom, operator } = question.visual;
    const digits = (n: number) => [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10];
    return <div className="grade-two__diagram-scroll"><table className="grade-two__place-table grade-two__calculation" aria-label={`${top} ${operator} ${bottom} の位ごとの表`}><thead><tr><td /><th scope="col">百のくらい</th><th scope="col">十のくらい</th><th scope="col">一のくらい</th></tr></thead><tbody>{[top, bottom].map((number, row) => <tr key={row}><th scope="row">{row === 0 ? "はじめの数" : operator}</th>{digits(number).map((digit, col) => <td key={col}>{col === 0 && digit === 0 ? "" : digit}</td>)}</tr>)}</tbody></table></div>;
  }
  if (question.visual?.type === "groups") {
    const { each, count, item, label } = question.visual;
    return <GroupDiagram key={`${each}-${count}-${label}`} each={each} count={count} item={item} label={label} showHint={showHint} />;
  }
  if (question.visual?.type === "picture-table") {
    const { rows, unit = "人" } = question.visual;
    const max = Math.max(...rows.map((row) => row.count));
    return <div className="grade-two__diagram-scroll"><p className="grade-two__diagram-caption">{unit === "人" ? "● 1つが 1人" : "絵 1つが 1本"}</p><table className="grade-two__picture-table" aria-label={`1つが1${unit}を表す表`}><tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{Array.from({ length: max }, (_, i) => <td key={i}><span aria-hidden="true">{i < row.count ? row.symbol ?? "●" : ""}</span>{i < row.count && <span className="lesson-hidden">1{unit}</span>}</td>)}</tr>)}</tbody></table></div>;
  }
  if (question.visual?.type === "fraction-parts") {
    const { parts } = question.visual;
    return <div className="grade-two__fraction"><p>ぜんぶで 1まい</p><div className="grade-two__fraction-bar" role="img" aria-label={`1まいを同じ大きさに${parts}つに分け、そのうち1つに色をつけた図`}>{Array.from({ length: parts }, (_, i) => <span key={i} className={i === 0 ? "is-selected" : ""}>{i === 0 ? "1つ分" : ""}</span>)}</div><p>同じ大きさに 分けたうちの、色つきの 1つ分</p></div>;
  }
  if (question.problem.startsWith("ものさしに 合わせた")) return <Ruler />;
  return <div className="grade-two__figures" role="img" aria-label={figures.join("、")}>{figures.map((line, index) => <div key={index}>{line}</div>)}</div>;
}
function Hint({ question }: { question: GradeTwoQuestion }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const steps = !question.visual && question.steps.length ? question.steps : [{ text: question.hint, figures: question.figures }];
  return <div className="grade-two__hint"><button type="button" onClick={() => { setOpen(!open); setIndex(0); }}>{open ? "ヒントを とじる" : "図で かんがえる"}</button>
    {open && <div className="grade-two__hint-body"><p aria-live="polite">{steps[index].text}</p>{!question.visual && <div key={index} className="grade-two__scene"><Figures question={question} figures={steps[index].figures} /></div>}
      {steps.length > 1 && <div className="grade-two__controls"><button type="button" onClick={() => setIndex(index - 1)} disabled={index === 0}>まえへ</button><span>{index + 1} / {steps.length}</span><button type="button" onClick={() => setIndex(index + 1)} disabled={index === steps.length - 1}>つぎの図</button></div>}
    </div>}
  </div>;
}
export function GradeTwoLesson({ practice, summary, onExit, onFinish }: { practice: GradeTwoQuestion; summary?: readonly GradeTwoQuestion[]; onExit: () => void; onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [solved, setSolved] = useState(false);
  const [message, setMessage] = useState("");
  const initialGuide = practice.title === "分数の はじまり" ? "fraction" : ["かけ算で 数を 見よう", "かけ算の 式"].includes(practice.title) ? "multiplication" : null;
  const [guide, setGuide] = useState<"fraction" | "multiplication" | null>(null);
  const question = summary?.[index] ?? practice;
  if (guide === "fraction") return <FractionBasicsGuide onDone={() => setGuide(null)} onExit={onExit} />;
  if (guide === "multiplication") return <MultiplicationBasicsGuide onDone={() => setGuide(null)} onExit={onExit} />;
  if (!summary && question.visual?.type === "make-ten") return <MakeTenLesson onExit={onExit} onFinish={onFinish} />;
  return <main className="lesson grade-two"><header className="lesson-header"><h1>{question.title}</h1><LessonButton text="やめて盤面にもどる" variant="text" onClick={onExit} /></header>
    <section className="lesson-card"><p>{index + 1} / {summary?.length ?? 1} 問</p><p>{question.problem}</p>
      <Figures question={question} figures={question.figures} showHint={!solved && !summary} />
      {!solved ? <form className="grade-two__answer" onSubmit={(event) => { event.preventDefault(); if (!answer.trim()) { setMessage("こたえを 入れてね。"); return; } if (correctAnswer(answer, question.answer)) { setSolved(true); setMessage(""); } else setMessage("もう一度、図や問題を 見てみよう。"); }}>
        {question.visual?.type === "fraction-parts" ? <><p>こたえ</p><FractionAnswer key={index} label="こたえ" value={answer} onChange={setAnswer} /></> : <><label htmlFor="grade-two-answer">こたえ</label><input id="grade-two-answer" type="text" value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" maxLength={32} /></>}<div className="grade-two__controls"><button type="submit">こたえる</button></div><p role="status">{message}</p>
      </form> : <><p role="status">{question.explanation}</p><button type="button" onClick={() => { if (summary && index + 1 < summary.length) { setIndex(index + 1); setAnswer(""); setSolved(false); setMessage(""); } else onFinish(); }}>{summary && index + 1 < summary.length ? "つぎの問題へ" : "ばんめんにもどる"}</button></>}
      {!solved && !summary && initialGuide && <button type="button" onClick={() => setGuide(initialGuide)}>{initialGuide === "fraction" ? "分数の見方の説明を見る" : "かけ算の式の説明を見る"}</button>}
      {!solved && !summary && question.visual?.type !== "ten-bundles" && question.visual?.type !== "column-add" && <Hint key={index} question={question} />}

    </section></main>;
}
