import { GradeSixDiagram } from "./GradeSixDiagram";
import { FractionAnswer } from "./FractionAnswer";
import { useState } from "react";
import type { UpperQuestion, UpperVisual } from "../../lesson/upper-math";
import { conceptFor } from "../../lesson/upper-concepts";
import type { Concept } from "../../lesson/upper-concepts";
import { LessonButton } from "./LessonButton";
import "./lesson.css";
import "./UpperMathLesson.css";

function normalize(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[\s,，]/g, "").replace(/対/g, ":")
    .replace(/[ァ-ヶ]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60))
    .replace(/平方せんちめーとる/g, "cm2").replace(/立方せんちめーとる/g, "cm3").replace(/立方めーとる/g, "m3").replace(/km\/(?:h|時間)/g, "km/時");
}
export function isUpperAnswerCorrect(input: string, question: UpperQuestion): boolean {
  const {answer, unit} = question;
  const value = normalize(input);
  const expected = normalize(answer);
  const suffix = normalize(unit);
  const aliases: Record<string, string[]> = { 奇数: ["きすう"], 偶数: ["ぐうすう"], はい: ["はいです"], いいえ: ["いいえです"] };
  if (question.answerFormat === "fraction") {
    const read = (text: string): [bigint, bigint] | null => {
      if (/^\d+$/.test(text)) return [BigInt(text), 1n];
      const match = /^(?:(\d+)と)?(\d+)\/(\d+)$/.exec(text);
      if (!match || BigInt(match[3]) === 0n) return null;
      return [BigInt(match[2]) + BigInt(match[1] ?? "0") * BigInt(match[3]), BigInt(match[3])];
    };
    const actual = read(value); const target = read(expected);
    return actual !== null && target !== null && actual[0] * target[1] === target[0] * actual[1];
  }
  if (question.acceptedAnswers?.some((candidate) => normalize(candidate) === value.replace(/\*/g, "×"))) return true;
  return value === expected || (aliases[expected] ?? []).includes(value) || (suffix !== "" && value === expected + suffix);
}
function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

/** 本題と異なる小さな数で「2こ組」とあまりの関係を確かめる。 */
function ParityGuide({ onDone, onExit }: { onDone: () => void; onExit: () => void }) {
  const [step, setStep] = useState(0);
  const count = step < 2 ? 4 : 5;
  const grouped = step % 2 === 1;
  const text = [
    "まず、おはじきが4こあります。2こずつ組を作ってみましょう。",
    "2こずつ組にすると、あまりはありません。4のような数を偶数といいます。",
    "今度は、おはじきが5こ。もう一度、2こずつ組を作りましょう。",
    "2こずつ組にすると、1こあまります。5のような数を奇数といいます。",
  ];
  return <main className="lesson upper"><header className="lesson-header"><h1>偶数と奇数を知ろう</h1><LessonButton text="やめて盤面にもどる" variant="text" onClick={onExit} /></header><section className="lesson-card">
    <p aria-live="polite">{text[step]}</p>
    <div className="parity__figure" role="img" aria-label={grouped ? `${count}こを2こずつの組に分けた図` : `おはじきが${count}こある図`}>
      {!grouped ? <div className="parity__loose">{Array.from({ length: count }, (_, i) => <span key={i}>●</span>)}</div> : Array.from({ length: Math.ceil(count / 2) }, (_, group) => <div key={group} className={`parity__pair ${group === Math.floor(count / 2) ? "is-leftover" : ""}`} style={{ animationDelay: `${group * .15}s` }}>{Array.from({ length: Math.min(2, count - group * 2) }, (_, i) => <span key={i}>●</span>)}</div>)}
    </div>
    {grouped && <><p className="parity__result">{count === 4 ? "2こ組ができて、あまりなし → 偶数" : "2こ組にして、1こあまる → 奇数"}</p><p>{count === 4 ? <>4 ÷ 2 ＝ 2 あまり 0。<mark className="parity__marker">2で割り切れる数を偶数といいます。</mark></> : <>5 ÷ 2 ＝ 2 あまり 1。<mark className="parity__marker">2で割ると1あまる数を奇数といいます。</mark></>}</p></>}
    <div className="upper__controls">{step > 0 && <button type="button" onClick={() => setStep(step - 1)}>もどる</button>}{step < 3 && <button type="button" onClick={() => setStep(step + 1)}>{grouped ? "つぎへ" : "2こずつ組にする"}</button>}<button type="button" onClick={onDone}>問題にすすむ</button></div>
    <p>{step + 1} / 4</p>
  </section></main>;
}

function ConceptGuide({ concept, onDone, onExit }: { concept: Concept; onDone: () => void; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const scene = concept.scenes[index];
  return <main className="lesson upper"><header className="lesson-header"><h1>{concept.name}を知ろう</h1><LessonButton text="やめて盤面にもどる" variant="text" onClick={onExit} /></header><section className="lesson-card">
    <p aria-live="polite">{scene.text}</p><Diagram visual={scene.visual} step={scene.step} />
    {scene.formula && <p className="upper__concept-formula" aria-live="polite">{scene.formula}</p>}
    {scene.definition && <p aria-live="polite"><mark className="parity__marker">{scene.definition}</mark></p>}
    <div className="upper__controls">{index > 0 && <button type="button" onClick={() => setIndex(index - 1)}>もどる</button>}{index + 1 < concept.scenes.length && <button type="button" onClick={() => setIndex(index + 1)}>つぎへ</button>}<button type="button" onClick={onDone}>問題にすすむ</button></div>
    <p>{index + 1} / {concept.scenes.length}</p>
  </section></main>;
}

function InverseArrows({ values, step, reverse = false }: { values: number[]; step: number; reverse?: boolean }) {
  const pairs: [number, number][] = step < 1 ? [[1, 2]] : [[1, 3], [2, 4]];
  const visiblePairs = pairs.filter(([from, to]) => values.includes(from) && values.includes(to));
  return <tr className="upper__arrow-row">
    <th scope="row">{reverse ? "1人分の変化" : "人数の変化"}</th>
    <td colSpan={values.length}>
      {visiblePairs.map(([from, to]) => {
        const factor = to / from;
        const change = reverse ? `÷${factor}` : `×${factor}`;
        const start = 50 + values.indexOf(from) * 100;
        const end = 50 + values.indexOf(to) * 100;
        const middle = (start + end) / 2;
        return <svg key={from} viewBox={`0 0 ${values.length * 100} 48`} preserveAspectRatio="none"
          role="img" aria-label={`${from}人と${to}人を比べると${change}`}>
          <path d={`M ${start + 3} 38 Q ${middle} 0 ${end - 4} 38`} />
          <polygon points={`${end - 9},32 ${end + 1},32 ${end - 4},42`} />
          <text x={middle} y="15" textAnchor="middle">{change}</text>
        </svg>;
      })}
    </td>
  </tr>;
}

function Diagram({ visual, step }: { visual: UpperVisual; step: number }) {
  if (visual.kind === "function-table" && visual.operation === "divide") {
    const targetPeople = visual.xs[visual.ys.indexOf(null)];
    return <div className="upper__table-scroll">
      <table className="upper__function-table" aria-label="人数と1人分の対応を示す表">
        <colgroup><col className="upper__function-header" />{visual.xs.map((_, i) => <col key={i} />)}</colgroup>
        <tbody>
          {step >= 0 && <InverseArrows values={visual.xs} step={step} />}
          <tr><th scope="row">{visual.xLabel}</th>{visual.xs.map((value, i) => <td key={i}>{value}</td>)}</tr>
          {step >= 0 && <InverseArrows values={visual.xs} step={step} reverse />}
          <tr><th scope="row">{visual.yLabel}</th>{visual.ys.map((value, i) => <td key={i}>{value ?? "？"}</td>)}</tr>
        </tbody>
      </table>
      {step >= 1 && <>
        <p><mark>人数 × 1人分 ＝ 全部の{visual.factor}こ</mark></p>
        <p>人数を x 人とすると、1人分は {visual.factor} ÷ x で求められます。</p>
        {targetPeople !== undefined && <p>{targetPeople}人で分けるときは、x に {targetPeople} を入れて、<strong>{visual.factor} ÷ {targetPeople}</strong> を計算しよう。</p>}
      </>}
    </div>;
  }
  if (visual.kind === "six") return <GradeSixDiagram visual={visual} step={step} />;
  if (visual.kind === "bundles") return <div className="upper__bundles" aria-label="数のまとまり">{visual.groups.map((group, index) => <div key={group.label} className={`upper__bundle-group ${step === index ? "is-focused" : ""}`}><strong>{group.label}のまとまり</strong><div>{Array.from({ length: group.count }, (_, i) => <span key={i}>{group.label}</span>)}</div></div>)}</div>;
  if (visual.kind === "rectangles") return <div className="upper__rectangles" aria-label="面積を考える図">{visual.rectangles.map((rect, i) => <div key={i} className="upper__rectangle"><p>{visual.rectangles.length > 1 ? `${i + 1}つめ：` : ""}横 {rect.width}cm・たて {rect.height}cm</p><div className="upper__grid" role="img" aria-label={`横${rect.width}cm、たて${rect.height}cmの長方形`} style={{ gridTemplateColumns: `repeat(${rect.width}, 1.4em)` }}>{Array.from({ length: rect.width * rect.height }, (_, cell) => <span key={cell} className={step >= 1 || (step === 0 && cell < rect.width) ? "is-unit" : ""} />)}</div>{step >= 0 && <p>横に{rect.width}まいずつ。{rect.height}列あります。1まいは1cm²です。</p>}</div>)}</div>;
  if (visual.kind === "volume") {
    const { width, height, depth, unit } = visual;
    const x = 28 + height * 9, y = 110, w = width * 20, h = depth * 20, dx = height * 9, dy = height * 6;
    return <div className="upper__volume"><p>横 {width}{unit}・奥行き {height}{unit}・高さ {depth}{unit}</p><svg viewBox={`0 ${Math.min(0, y-h-dy-8)} ${Math.max(180, x+w+dx+12)} ${Math.max(135, h+dy+30)}`} role="img" aria-label={`横${width}${unit}、奥行き${height}${unit}、高さ${depth}${unit}の箱`}><polygon points={`${x},${y-h} ${x+dx},${y-h-dy} ${x+w+dx},${y-h-dy} ${x+w},${y-h}`} className="upper__box-top" /><polygon points={`${x+w},${y-h} ${x+w+dx},${y-h-dy} ${x+w+dx},${y-dy} ${x+w},${y}`} className="upper__box-side" /><polygon points={`${x},${y-h} ${x+w},${y-h} ${x+w},${y} ${x},${y}`} className="upper__box-front" /></svg>{step >= 0 && <div className="upper__layers"><p><strong>底面積（長方形）＝ 横 × 奥行き</strong></p>
      <p>この箱の底面積は {width} × {height} で求められます。</p>
      {step >= 1 && <p><strong>体積 ＝ 底面積 × 高さ</strong>。求めた底面積に {depth} をかけよう。</p>}<div className="upper__layer-list">{Array.from({ length: step >= 1 ? depth : 1 }, (_, layer) => <div key={layer}><small>{layer + 1}段目</small><div className="upper__grid" role="img" aria-label={`横${width}こ、奥行き${height}この1段`} style={{ gridTemplateColumns: `repeat(${width}, 1.1em)` }}>{Array.from({ length: width * height }, (_, i) => <span key={i} className="is-unit" />)}</div></div>)}</div></div>}</div>;
  }
  if (visual.kind === "bars") {
    const max = Math.max(...visual.values);
    const mean = visual.values.reduce((sum, value) => sum + value, 0) / visual.values.length;
    return <div className="upper__average"><div className="upper__bars" aria-label="それぞれの数量を表す図">{visual.values.map((value, i) => <div key={i} className="upper__bar-item"><strong>{step >= 1 ? "同じ量" : `${value}${visual.unit}`}</strong><div className="upper__bar-track"><div className="upper__bar" style={{ height: `${(step >= 1 ? mean : value) / max * 100}%` }} /></div><span>{visual.labels[i]}</span></div>)}</div>{step >= 0 && <div className="upper__average-action"><span>合わせる</span><div className="upper__combined" aria-label="それぞれの数を1つにまとめた図">{visual.values.map((value, i) => <span key={i} style={{ flexGrow: value }} aria-label={`${visual.labels[i]}の${value}${visual.unit}`} />)}</div>{step >= 1 && <><span>同じ数ずつ分ける</span><div className="upper__equal-groups">{visual.values.map((_, i) => <span key={i}>{visual.labels[i]}</span>)}</div></>}</div>}</div>;
  }
  if (visual.kind === "number-lines") return <div className="upper__number-lines">{visual.lines.map((line, i) => <div key={i} className="upper__number-line" role="img" aria-label={`${line.low}から${line.high}までの数直線。${line.value}の位置`}><div className="upper__number-track"><span className="upper__number-mark" style={{ left: `${(line.value - line.low) / (line.high - line.low) * 100}%` }}>{line.value}</span>{step >= 0 && <span className="upper__number-middle" style={{ left: "50%" }}>まん中 { (line.low + line.high) / 2 }</span>}</div><div className="upper__number-ends"><span>{line.low}</span><span>{line.high}</span></div></div>)}</div>;
  if (visual.kind === "prism") {
    const triangle = visual.shape === "triangle";
    return <div className="upper__prism">
      <div><p>{visual.baseDimensions ?? `底面積 ${visual.baseArea}cm²`}・柱の高さ {visual.height}cm</p>
        <svg viewBox="0 0 220 145" role="img" aria-label={triangle ? "三角柱の底面と高さ" : "円柱の底面と高さ"}>
          {triangle ? <><polygon points="40,35 125,35 125,105 40,105" className="upper__box-front" /><polygon points="40,35 80,12 125,35" className="upper__box-top" /><polygon points="40,105 80,82 125,105" className="upper__prism-base" /><line x1="80" y1="12" x2="80" y2="82" className="upper__prism-back" /></> : <><path d="M35 35 L35 105 Q90 135 145 105 L145 35" className="upper__box-front" /><ellipse cx="90" cy="105" rx="55" ry="18" className="upper__prism-base" /><ellipse cx="90" cy="35" rx="55" ry="18" className="upper__box-top" /></>}
          <path d="M159 35h12 m-6 0v70 m-6 0h12" className="upper__sector-measure" />
          <text x="174" y="75">{visual.height}cm</text>
          <text x="36" y="139">{visual.baseDimensions ? "色のついた面が底面" : `底面積 ${visual.baseArea}cm²`}</text>
        </svg>
      </div>
      {step >= 0 && <div className="upper__prism-stack">
        <p><strong>底面積（{triangle ? "三角形" : "円"}）＝ {triangle ? "底辺 × 底面の三角形の高さ ÷ 2" : "半径 × 半径 × 3.14"}</strong></p>
        {step === 0 && !visual.baseDimensions && <p>この問題では、底面積は {visual.baseArea}cm² と分かっています。</p>}
        {step >= 1 && <p><strong>体積 ＝ 底面積 × 柱の高さ</strong>。求めた底面積に {visual.height} をかけよう。</p>}
        <p>{step === 0 ? "まず、厚さ1cmの1段を考えよう。" : "同じ1段を、高さの分だけ重ねよう。"}</p>
        <svg viewBox="0 0 220 145" role="img" aria-label={step === 0 ? "厚さ1cmの1段" : `厚さ1cmの層が${visual.height}段`}>
          {Array.from({ length: step >= 1 ? visual.height : 1 }, (_, i) => <g key={i} transform={`translate(0,${104 - i * 15})`}>
            <g className="upper__prism-stack-layer" style={{ animationDelay: `${i * .2}s` }}>
              {triangle ? <><path d="M40 0L80 -15L125 0V15H40Z" className="upper__box-front" /><path d="M40 0L80 -15L125 0Z" className="upper__box-top" /></> : <><path d="M35 0V15Q90 41 145 15V0Z" className="upper__box-front" /><ellipse cx="90" cy="0" rx="55" ry="13" className="upper__box-top" /></>}
            </g>
          </g>)}
          <path d="M159 104h12 m-6 0v15 m-6 0h12" className="upper__sector-measure" />
          <text x="174" y="117">1cm</text>
        </svg>
        <p>{step === 0 ? "1段の体積は、底面積 × 1cm。" : "1段の体積 × 段の数で、全体の体積を求めよう。"}</p>
      </div>}
    </div>;
  }
  if (visual.kind === "collection") return <div className="upper__collection" role="img" aria-label={step < 0 ? "ものを並べた図" : `${visual.size}こずつに分けた図`}>{step < 0 ? <div className="upper__collection-items">{Array.from({ length: visual.count }, (_, i) => <span key={i}>●</span>)}</div> : Array.from({ length: Math.ceil(visual.count / visual.size) }, (_, group) => { const size = Math.min(visual.size, visual.count - group * visual.size); const remainder = size < visual.size; return <div key={group} className={`upper__collection-group ${remainder ? "is-remainder" : ""}`}>{Array.from({ length: size }, (_, i) => <span key={i}>●</span>)}{remainder && <small>あまり</small>}</div>; })}</div>;
  if (visual.kind === "number-lists") {
    const shared = visual.rows[0].values.filter((value) => visual.rows[1].values.includes(value));
    return <div className="upper__number-lists">{visual.rows.map((row) => <div key={row.label} className="upper__number-list"><strong>{row.label}</strong><div>{row.values.map((value) => <span key={value} className={step >= 1 && shared.includes(value) ? "is-common" : ""}>{value}</span>)}</div></div>)}</div>;
  }
  if (visual.kind === "area-shape") {
    const { shape, base, height, top } = visual;
    const label = shape === "trapezoid" ? `上底 ${top}cm・下底 ${base}cm・高さ ${height}cm` : shape === "rhombus" ? `対角線 ${base}cm と ${height}cm` : `底辺 ${base}cm・高さ ${height}cm`;
    return <div className="upper__area-shape"><p>{label}</p><svg viewBox="0 0 240 130" role="img" aria-label={`${label}の面積を考える図`}>
      {shape === "parallelogram" && <>{step < 1 ? <polygon points="50,20 170,20 140,110 20,110" className="upper__area-original" /> : <><polygon points="50,20 170,20 140,110 50,110" className="upper__area-original" /><polygon points="50,20 50,110 20,110" className="upper__area-moved" /></>}{step === 0 && <line x1="50" y1="20" x2="50" y2="110" className="upper__area-cut" />}</>}
      {shape === "triangle" && <>{step >= 0 && <rect x="20" y="20" width="120" height="90" className="upper__area-outline" />}<polygon points="20,110 140,110 20,20" className="upper__area-original" />{step >= 1 && <polygon points="140,110 140,20 20,20" className="upper__area-copy" />}</>}
      {shape === "trapezoid" && <><polygon points="40,20 100,20 130,100 10,100" className="upper__area-original" />{step >= 1 && <polygon points="100,20 220,20 190,100 130,100" className="upper__area-trapezoid-copy" />}</>}
      {shape === "rhombus" && <>{step >= 0 && <rect x="30" y="25" width="120" height="80" className="upper__area-outline" />}{step >= 1 && <g className="upper__area-corners"><polygon points="30,25 90,25 30,65" /><polygon points="90,25 150,25 150,65" /><polygon points="30,65 30,105 90,105" /><polygon points="150,65 150,105 90,105" /></g>}<polygon points="90,25 150,65 90,105 30,65" className="upper__area-original" /><line x1="30" y1="65" x2="150" y2="65" className="upper__area-cut" /><line x1="90" y1="25" x2="90" y2="105" className="upper__area-cut" /></>}
    </svg></div>;
  }
  if (visual.kind === "function-table") return <div className="upper__table-scroll"><table className="upper__function-table" aria-label="数量の対応を示す表"><colgroup><col className="upper__function-header" />{visual.xs.map((_, i) => <col key={i} />)}</colgroup><tbody><tr><th scope="row">{visual.xLabel}</th>{visual.xs.map((value, i) => <td key={i}>{value}</td>)}</tr>{step >= 0 && visual.increment && <tr className="upper__arrow-row"><th scope="row">{visual.yLabel}の変化</th><td colSpan={visual.xs.length}><svg viewBox={`0 0 ${visual.xs.length * 100} 48`} role="img" aria-label={`1つ増えるごとに${visual.increment}`} preserveAspectRatio="none">{visual.xs.slice(1).map((_, i) => { const start = 50 + i * 100; const end = start + 100; return <g key={i}><path d={`M ${start + 3} 38 Q ${start + 50} 0 ${end - 4} 38`} /><polygon points={`${end - 9},32 ${end + 1},32 ${end - 4},42`} /><text x={start + 50} y="15" textAnchor="middle">{visual.increment}</text></g>; })}</svg></td></tr>}<tr><th scope="row">{visual.yLabel}</th>{visual.ys.map((value, i) => <td key={i}>{value === null ? "？" : value}</td>)}</tr></tbody></table></div>;
  if (visual.kind === "circle-area") {
    const sectors = 16;
    const angle = Math.PI / sectors;
    const radius = 44;
    const halfChord = radius * Math.sin(angle);
    const altitude = radius * Math.cos(angle);
    return <div className="upper__circle-area">
      <div><p>半径 {visual.radius}cm</p><svg viewBox="0 0 120 120" role="img" aria-label={`半径${visual.radius}cmの円`}>
        <circle cx="60" cy="60" r={radius} className="upper__circle" />
        {step >= 0 && Array.from({ length: sectors }, (_, i) => {
          const start = i * 2 * angle;
          const end = start + 2 * angle;
          return <path key={i} d={`M60 60L${60 + radius * Math.cos(start)} ${60 + radius * Math.sin(start)} A${radius} ${radius} 0 0 1 ${60 + radius * Math.cos(end)} ${60 + radius * Math.sin(end)}Z`} className={`upper__sector-piece ${i % 2 ? "is-second" : ""}`} />;
        })}
        <line x1="60" y1="60" x2={60 + radius} y2="60" className="upper__circle-radius" />
      </svg></div>
      {step >= 1 && <div className="upper__sector-figure">
        <p>弧の色が上と下に分かれるように並べよう</p>
        <svg viewBox="0 0 235 118" role="img" aria-label="おうぎ形を上下交互に並べた図。横は円周の半分、たては半径">
          {Array.from({ length: sectors }, (_, i) => <g key={i} transform={`translate(${17 + i * halfChord},${i % 2 ? 22 : 22 + altitude}) rotate(${i % 2 ? 180 : 0})`}>
            <path d={`M0 0 L${-halfChord} ${-altitude} A${radius} ${radius} 0 0 1 ${halfChord} ${-altitude} Z`} className={`upper__sector-piece upper__sector-enter ${i % 2 ? "is-second" : ""}`} style={{ animationDelay: `${i * .08}s` }} />
          </g>)}
          <path d={`M17 77v6 m0 -3h${sectors * halfChord} m0 -3v6 M176 22h8 m-4 0v${altitude} m-4 0h8`} className="upper__sector-measure" />
          <text x="13" y="105">円周の半分＝半径×3.14</text>
          <text x="188" y="49">半径</text>
        </svg>
        <p>細かく切るほど長方形に近づきます。面積は横×たてです。</p>
      </div>}
    </div>;
  }
  if (visual.kind === "part-whole") return <div className="upper__part-whole" role="img" aria-label={`全体${visual.whole}${visual.unit}を${visual.showPercent === false ? "1" : "100％"}として、${visual.partLabel}と残りに分けた図`}><p>全体 {visual.whole}{visual.unit} ＝ {visual.showPercent === false ? "1" : "100％"}</p><div className="upper__part-bracket" /><div className="upper__part-bar"><div className="upper__part-fill" style={{ width: `${visual.part / visual.whole * 100}%` }} /><div className="upper__part-rest" /></div><div className="upper__part-labels"><span>{visual.partLabel}</span><span>{step >= 1 && visual.revealRestPercent ? `残り ${100 - visual.part / visual.whole * 100}％` : "残り"}</span></div></div>;
  if (visual.kind === "split-bars") {
    const maximum = Math.max(...visual.rows.map((row) => row.total));
    return <div className="upper__split-bars" aria-label="量を同じ大きさに分けて考える図">{visual.rows.map((row) => <div key={row.label}><p>{row.label}：全体 {row.total}{row.unit}・{row.parts}つ分</p><div className="upper__split-track"><div className="upper__split-fill" style={{ width: `${row.total / maximum * 100}%` }}>{step >= 0 && Array.from({ length: row.parts }, (_, i) => <span key={i} />)}</div></div></div>)}</div>;
  }
  if (visual.kind === "area-parts") {
    const points = visual.shape === "parallelogram" ? "65,20 165,20 135,100 35,100" : visual.shape === "triangle" ? "35,100 155,100 65,20" : visual.shape === "trapezoid" ? "65,20 125,20 155,100 35,100" : "100,15 165,60 100,105 35,60";
    return <div className="upper__area-parts"><svg viewBox="0 0 210 135" role="img" aria-label={visual.shape === "rhombus" ? "ひし形の対角線を示す図" : "図形の底辺と高さを示す図"}><polygon points={points} className="upper__area-original" />{visual.shape === "rhombus" ? <><line x1="35" y1="60" x2="165" y2="60" className="upper__parts-line" /><text x="72" y="56">対角線</text>{step >= 1 && <><line x1="100" y1="15" x2="100" y2="105" className="upper__parts-line" /><text x="105" y="29">対角線</text></>}</> : <><line x1="35" y1="100" x2={visual.shape === "parallelogram" ? 135 : 155} y2="100" className="upper__parts-line" /><text x="75" y="120">{visual.shape === "trapezoid" ? "下底" : "底辺"}</text>{visual.shape === "trapezoid" && <><line x1="65" y1="20" x2="125" y2="20" className="upper__parts-line" /><text x="80" y="15">上底</text></>}{step >= 1 && <><line x1="65" y1="20" x2="65" y2="100" className="upper__parts-height" /><path d="M65 90 L75 90 L75 100" className="upper__area-outline" /><text x="71" y="63">高さ</text></>}</>}</svg></div>;
  }
  if (visual.kind === "circle-parts") return <div className="upper__circle-parts"><svg viewBox="0 0 180 145" role="img" aria-label={step >= 1 ? "円周と直径を示す図" : "円の中心から端までの半径を示す図"}><circle cx="80" cy="72" r="48" className={step >= 1 ? "upper__circle is-circumference" : "upper__circle"} /><circle cx="80" cy="72" r="3" fill="currentColor" />{step >= 1 ? <><line x1="32" y1="72" x2="128" y2="72" className="upper__parts-line" /><text x="65" y="67">直径</text><text x="132" y="39">円周</text></> : <><line x1="80" y1="72" x2="128" y2="72" className="upper__parts-line" /><text x="87" y="67">半径</text></>}</svg></div>;
  const max = Math.max(...visual.values);
  const divisor = gcd(...visual.values);
  return <div className="upper__ratios" aria-label="2つの量を比べる図">{visual.unit === "mL" && <p><strong>1 L ＝ 1000 mL</strong>。この問題では、ジュースも水も mL で表されています。</p>}{visual.values.map((value, i) => <div key={i} className="upper__ratio-row"><span>{visual.labels[i]} {value}{visual.unit}{visual.showBase && i === 0 && step >= 0 && <strong>（もとにする量＝1）</strong>}</span><div className="upper__ratio-track"><div className="upper__ratio-fill" style={{ width: `${value / max * 100}%` }}>{step >= 1 && Array.from({ length: value / divisor }, (_, n) => <span key={n} />)}</div></div></div>)}{step >= 1 && <p>同じ大きさの区切りは {divisor}{visual.unit} ずつ。{divisor}{visual.unit} を1つ分として、両方の帯の区切りを数えよう。</p>}</div>;
}

export function UpperMathLesson({ practice, summary, onExit, onFinish }: { practice: UpperQuestion; summary?: readonly UpperQuestion[]; onExit: () => void; onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(-1);
  const [answer, setAnswer] = useState("");
  const [solved, setSolved] = useState(false);
  const [baseSolved, setBaseSolved] = useState(false);
  const [message, setMessage] = useState("");
  const questions = summary ?? [practice, ...(practice.followUps ?? [])];
  const question = questions[index];
  const visual = question.visual;
  const baseArea = summary ? undefined : visual.kind === "volume" ? visual.width * visual.height
    : visual.kind === "prism" && visual.baseDimensions ? visual.baseArea : undefined;
  const areaUnit = visual.kind === "volume" ? `${visual.unit}²` : "cm²";
  const needsBase = baseArea !== undefined && !baseSolved;
  const concept = conceptFor(question);
  const hasIntro = question.title === "偶数と奇数" || concept !== undefined;
  const [introFinished, setIntroFinished] = useState(true);

  const finish = () => {
    if (index + 1 < questions.length) { setIndex(index + 1); setStep(-1); setAnswer(""); setSolved(false); setBaseSolved(false); setMessage(""); }
    else onFinish();
  };
  if (!introFinished && question.title === "偶数と奇数") return <ParityGuide onDone={() => setIntroFinished(true)} onExit={onExit} />;
  if (!introFinished && concept) return <ConceptGuide concept={concept} onDone={() => setIntroFinished(true)} onExit={onExit} />;
  const guide = !solved && <div className="upper__guide">
    {hasIntro && <button type="button" onClick={() => setIntroFinished(false)}>{question.title === "偶数と奇数" ? question.title : concept!.name}の説明を見る</button>}
    {step < 0
      ? <button type="button" onClick={() => setStep(0)}>図を使って考える</button>
      : <>
        <p aria-live="polite">{question.hints[step]}</p>
        <div className="upper__controls">
          <button type="button" onClick={() => setStep(step - 1)}>もどる</button>
          <span>{step + 1} / 2</span>
          <button type="button" onClick={() => setStep(step + 1)} disabled={step === 1}>次へ</button>
        </div>
      </>}
  </div>;
  return <main className="lesson upper"><header className="lesson-header"><h1>{question.title}</h1><LessonButton text="やめて盤面にもどる" variant="text" onClick={onExit} /></header><section className="lesson-card">
    <p>{index + 1} / {questions.length} 問</p>
    <p>{question.problem}</p><Diagram visual={visual} step={step} />

    {baseSolved && <p>底面積は {baseArea}{areaUnit}。次は体積を求めよう。</p>}
    {needsBase ? <form className="upper__answer" onSubmit={(event) => {
      event.preventDefault();
      if (isUpperAnswerCorrect(answer, {...question, answer: String(baseArea), unit: areaUnit})) {
        setBaseSolved(true);
        setAnswer("");
        setMessage("");
      } else setMessage(answer.trim() ? "底面の形と、面積の公式を確かめよう。" : "底面積を入力しましょう。");
    }}>
      <label htmlFor="upper-base-answer">底面積（{areaUnit}）</label>
      <input id="upper-base-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} inputMode="decimal" />
      <button type="submit">底面積を答える</button><p role="status">{message}</p>
    </form> : !solved ? <form className="upper__answer" onSubmit={(event) => { event.preventDefault(); if (!answer.trim()) setMessage("答えを入力しましょう。"); else if (isUpperAnswerCorrect(answer, question)) { setSolved(true); setMessage(""); } else setMessage(question.retry); }}>{question.answerFormat === "fraction" ? <><p>答え{question.unit && `（${question.unit}）`}</p><FractionAnswer key={index} label="答え" value={answer} onChange={setAnswer} allowMixed /></> : <><label htmlFor="upper-answer">答え{question.unit && `（${question.unit}）`}</label><input id="upper-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" maxLength={32} /></>}<button type="submit">答える</button><p role="status">{message}</p></form> : <><p role="status">{question.explanation}</p><button type="button" onClick={finish}>{index + 1 < questions.length ? "つぎの問題へ" : "ばんめんにもどる"}</button></>}
    {!summary && guide}
  </section></main>;
}
