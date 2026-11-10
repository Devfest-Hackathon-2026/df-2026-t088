import { useState } from "react";
import type { SixVisual } from "../../lesson/grade-six-types";
import "./GradeSixDiagram.css";

const fractionName = ([n, d]: [number, number]) => d === 1 ? `${n}` : `${n}/${d}`;
function Whole({ value, label, parts, unit = "" }: { value: [number, number]; label: string; parts?: number; unit?: string }) {
  const [n, d] = value;
  const divisions = parts ?? d;
  return <div className="six__whole"><p>{label}：{fractionName(value)}{unit}</p><p className="six__bracket">全体の1{unit}</p><div className="six__strip" style={{ gridTemplateColumns: `repeat(${divisions}, 1fr)` }}>{Array.from({ length: divisions }, (_, i) => <span key={i} className={i < n * divisions / d ? "is-filled" : ""}>{i + 1}</span>)}</div></div>;
}
/** 元の色の幅を保ったまま、同じ方向に新しい切れ目を加える。 */
function FractionSubdivision({visual, step}: {visual: Extract<SixVisual,{type:"fraction"}>; step:number}) {
  const {a,b}=visual;
  const parts=a[1]*b[1];
  const cuts=Array.from({length:parts-1},(_,i)=>i+1).filter(i=>i%b[1]!==0);
  const [replay,setReplay]=useState(0);
  const [paused,setPaused]=useState(false);
  const [phase,setPhase]=useState(0);
  const playState = paused ? "paused" : "running";
  const active=step>=0;
  const duration=.5+cuts.length*.65;
  return <div className="six__fraction">
    {visual.baseUnit ? <>
      <table className="six__paint-scale" aria-label="ぬる面積とペンキの量の対応">
        <thead><tr><th scope="col">ぬる面積</th><th scope="col">ペンキの量</th></tr></thead>
        <tbody>
          <tr><td>1{visual.baseUnit}</td><td>{fractionName(a)}{visual.unit}</td></tr>
          <tr><td><strong>↓ × {fractionName(b)}</strong></td><td><strong>↓ × {fractionName(b)}</strong></td></tr>
          <tr><td>{fractionName(b)}{visual.baseUnit}</td><td>？{visual.unit}</td></tr>
        </tbody>
      </table>
      <p>ぬる面積を{fractionName(b)}倍にすると、使うペンキの量も{fractionName(b)}倍になります。</p>
    </> : <p>もとにする部分：{fractionName(a)}{visual.unit}</p>}
    <div className="six__whole six__subdivision" key={replay}>
      <p className="six__bracket">全体の1{visual.unit}{phase === 3 && `（${parts}等分）`}</p>
      <div className="six__cut-strip" role="img" aria-label={active ? `全体を${parts}等分する図。元の${fractionName(a)}の量は変わりません` : `全体を${a[1]}等分したうちの${a[0]}つ分`}>
        <div className={`six__original-fill ${phase>=2?"is-clearing":""}`} style={{width:`${a[0]/a[1]*100}%`,animationPlayState:playState}} />
        {active && phase < 3 && <div className="six__source-outline" style={{width:`${a[0]/a[1]*100}%`}} />}
        {phase>=2 && <div className="six__selected-fill" style={{width:`${a[0]*b[0]/parts*100}%`,animationPlayState:playState}} onAnimationEnd={()=>setPhase(3)} />}
        {phase>=1 && <div className="six__equal-groups" style={{width:`${a[0]/a[1]*100}%`,gridTemplateColumns:`repeat(${b[1]},1fr)`,animationPlayState:playState}} onAnimationEnd={()=>setPhase(current=>Math.max(current,2))}>{Array.from({length:b[1]},(_,i)=><span key={i} />)}</div>}
        {Array.from({length:a[1]-1},(_,i)=><span className="six__old-cut" key={i} style={{left:`${(i+1)/a[1]*100}%`}} />)}
        <div className={`six__cut-labels ${active?"is-subdividing":""}`} style={{gridTemplateColumns:`repeat(${a[1]},1fr)`}}>{Array.from({length:a[1]},(_,i)=><span key={i}>{i+1}</span>)}</div>
        {active && <>
          {cuts.map((cut,i)=><span className="six__new-cut" key={cut} style={{left:`${cut/parts*100}%`,animationDelay:`${.5+i*.65}s`,animationPlayState:paused?"paused":"running"}} />)}
          <div className="six__cut-labels six__fine-labels" onAnimationEnd={()=>setPhase(current=>Math.max(current,1))} style={{gridTemplateColumns:`repeat(${parts},1fr)`,animationDelay:`${duration}s`,animationPlayState:playState}}>{Array.from({length:parts},(_,i)=><span key={i}>{i+1}</span>)}</div>
        </>}
      </div>
    </div>
    {active && <><p aria-live="polite">{phase===0?`もとの${fractionName(a)}の部分を、同じ大きさの${b[1]}組に分けよう。`:phase<3?`${fractionName(b)}は、同じ大きさに${b[1]}つに分けたうちの${b[0]}つ分。その${b[0]}組を赤くします。`:"赤い部分は、全体を同じ大きさに分けたうちの何個分かな？"}</p><div className="upper__controls"><button type="button" aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?"続きを見る":"一時停止"}</button><button type="button" onClick={()=>{setPaused(false);setPhase(0);setReplay(replay+1);}}>もう一度見る</button></div></>}
  </div>;
}
function DivisionFormula({a,b,onBack}: {a:[number,number];b:[number,number];onBack:()=>void}) {
  const [stage,setStage]=useState(0);
  const [doubled,setDoubled]=useState(false);
  const reciprocal: [number,number]=[b[1],b[0]];
  const frac=(top:string,bottom:string)=><span className="six__written-fraction"><span>{top}</span><span>{bottom}</span></span>;
  return <div className="six__formula-guide">
    <h3>図の考え方を、式にしよう</h3>
    {stage===0 && <><p>わる数を1にそろえます。{fractionName(b)}に{fractionName(reciprocal)}をかけると1になります。</p><p className="six__formula-line">{frac(`${b[0]}`,`${b[1]}`)} × {frac(`${b[1]}`,`${b[0]}`)} ＝ 1</p><p>分子と分母を入れ替えた数を「逆数」といいます。</p></>}
    {stage===1 && <><p>わられる数とわる数の両方に、同じ数をかけても答えは変わりません。まず、あめで確かめよう。</p>
      <p aria-live="polite">{doubled ? "あめ8個を4個ずつ。袋はやっぱり2つ。" : "あめ4個を2個ずつ入れると、袋は2つ。"}</p>
      <div className={`six__bag-demo ${doubled ? "is-doubled" : ""}`} role="img" aria-label={doubled ? "4個入りの袋が2つ" : "2個入りの袋が2つ"}>
        {[1,2].map(bag=><div className="six__bag" key={bag}>{[1,2,3,4].map(candy=><span key={candy}>🍬</span>)}</div>)}
      </div>
      <button type="button" onClick={()=>setDoubled(!doubled)}>{doubled ? "もとの数に戻す" : "あめの全部の数と、1袋の数を2倍にする"}</button>
      <p>同じ考え方で、今回の式でも、わる数が1になるように両方に{fractionName(reciprocal)}をかけます。</p>
      <p className="six__formula-line">（{frac(`${a[0]}`,`${a[1]}`)} × {frac(`${b[1]}`,`${b[0]}`)}） ÷ （{frac(`${b[0]}`,`${b[1]}`)} × {frac(`${b[1]}`,`${b[0]}`)}）</p><p>右のかっこの中は1。1でわっても数は変わりません。</p></>}
    {stage===2 && <><p><mark>「分数でわる」を「その逆数をかける」に置き換えます。</mark> 最初の分数はそのままです。</p><p className="six__formula-line">{frac(`${a[0]}`,`${a[1]}`)} ÷ {frac(`${b[0]}`,`${b[1]}`)} → {frac(`${a[0]}`,`${a[1]}`)} × {frac(`${b[1]}`,`${b[0]}`)}</p></>}
    {stage===3 && <><p>ここからは分数のかけ算。上の数どうし、下の数どうしをかけます。</p><p className="six__formula-line">{frac(`${a[0]}`,`${a[1]}`)} × {frac(`${b[1]}`,`${b[0]}`)} ＝ {frac(`${a[0]} × ${b[1]}`,`${a[1]} × ${b[0]}`)} ＝ {frac("？","？")}</p><p>計算して、下の答えの欄に入れよう。約分できるときは約分します。</p></>}
    <div className="upper__controls"><button type="button" onClick={onBack}>図にもどる</button><button type="button" disabled={stage===0} onClick={()=>setStage(stage-1)}>前の式</button><span>{stage+1} / 4</span><button type="button" disabled={stage===3} onClick={()=>setStage(stage+1)}>次の式</button></div>
  </div>;
}
function FractionDivision({ visual, active }: { visual: Extract<SixVisual,{type:"fraction"}>; active:boolean }) {
  const {a,b}=visual;
  let gcd=a[1], rest=b[1];
  while(rest) [gcd,rest]=[rest,gcd%rest];
  const parts=a[1]*b[1]/gcd;
  const amount=a[0]*parts/a[1];
  const group=b[0]*parts/b[1];
  const count=Math.ceil(amount/group);
  const [served,setServed]=useState(0);
  const [showFormula,setShowFormula]=useState(false);
  const unit=42;
  const width=Math.max(parts*unit+40,count*(group*unit+24)+16);
  if (showFormula) return <DivisionFormula a={a} b={b} onBack={()=>setShowFormula(false)} />;
  return <div className="six__division-story">
    <p>ジュースで考えよう。{fractionName(a)}Lのジュースを、1杯に{fractionName(b)}L入るコップに注ぐと、何杯分になるかな？</p>
    <div className="six__division-scroll"><svg viewBox={`0 0 ${width} 255`} style={{width}} role="img" aria-label={`${fractionName(a)}Lを${fractionName(b)}Lずつ移し、残りを1杯分のわくと比べる図`}>
      <text x="20" y="22">全体の1L（同じ大きさに{parts}等分）</text>
      {Array.from({length:parts},(_,i)=><rect key={i} x={20+i*unit} y="38" width={unit} height="40" className="six__outline" />)}
      <text x="20" y="105">小さな1マスは1/{parts}L</text>
      {Array.from({length:Math.min(count,served+1)},(_,i)=><g key={i}>
        <text x={20+i*(group*unit+24)} y="154">{i+1}杯目</text>
        <rect x={20+i*(group*unit+24)} y="168" width={group*unit} height="40" className="six__outline" />
        {Array.from({length:group-1},(_,j)=><path key={j} d={`M${20+i*(group*unit+24)+(j+1)*unit} 168v40`} className="six__axis" />)}
        <text x={20+i*(group*unit+24)} y="235">1杯＝{fractionName(b)}L</text>
      </g>)}
      {Array.from({length:amount},(_,i)=>{const cup=Math.floor(i/group); const moved=cup<served; return <rect key={i} x={20+i*unit} y="38" width={unit} height="40" className="six__juice-piece" style={{transform:moved?`translate(${cup*24}px, 130px)`:"translate(0, 0)"}} />;})}
    </svg></div>
    {active && <><p aria-live="polite">{served===0?`上の色の部分を、下の「1杯＝${fractionName(b)}L」のわくへ移してみよう。`:served<count?"1杯分のわくがいっぱいになりました。残りも、次のわくへ移して比べよう。":amount%group?"最後のわくに注目。色の部分は、1杯分のわくの何分のいくつかな？ いっぱいのコップと合わせて考えよう。":"いっぱいになったコップは、いくつあるかな？"}</p>
    <div className="upper__controls"><button type="button" disabled={served===count} onClick={()=>setServed(served+1)}>{served===0?"1杯分を移す":"残りを次のコップへ"}</button><button type="button" onClick={()=>setServed(Math.max(0,served-1))} disabled={served===0}>1つもどす</button><button type="button" onClick={()=>setServed(0)}>はじめから</button>{served===count && <button type="button" onClick={()=>setShowFormula(true)}>式で解く方法を見る</button>}</div></>}
  </div>;
}
function IntegerDivision({visual,active}: {visual: Extract<SixVisual,{type:"fraction"}>;active:boolean}) {
  const {a,b}=visual;
  const people=b[0];
  let gcd=a[0], rem=people;
  while(rem) [gcd,rem]=[rem,gcd%rem];
  const parts=active ? a[1]*people/gcd : a[1];
  const amount=a[0]*parts/a[1];
  const share=amount/people;
  const [served,setServed]=useState(0);
  const [formula,setFormula]=useState(false);
  const cell=300/parts;
  if(formula) return <DivisionFormula a={a} b={b} onBack={()=>setFormula(false)} />;
  return <div className="six__sharing">
    <p>{fractionName(a)}を{people}人で同じ量ずつ分けます。求めるのは、<strong>1人分の量</strong>です。</p>
    <svg viewBox={`0 0 350 ${active?140+people*85:110}`} role="img" aria-label="分ける前の量を一人ずつ配り、全体の1と一人分を比べる図">
      <text x="20" y="22">分ける前：{fractionName(a)} ／ この横幅が全体の1</text>
      {Array.from({length:parts},(_,i)=><rect key={i} x={20+i*cell} y="38" width={cell} height="32" className="six__outline" />)}
      {active && Array.from({length:people},(_,person)=><g key={person}>
        <text x="20" y={128+person*85}>{person+1}人目{person===0 && served===people?"：この1人分を答えよう":""}</text>
        {Array.from({length:parts},(_,i)=><rect key={i} x={20+i*cell} y={140+person*85} width={cell} height="32" className="six__sharing-unit" />)}
        {person===0 && served===people && <rect x="17" y="137" width={share*cell+6} height="38" className="six__share-focus" />}
      </g>)}
      {Array.from({length:amount},(_,i)=>{const person=Math.floor(i/share);const moved=active && person<served;return <rect key={i} x={20+i*cell} y="38" width={cell} height="32" className="six__juice-piece" style={{transform:moved?`translate(${-person*share*cell}px, ${102+person*85}px)`:"translate(0, 0)"}} />;})}
      {active && <text x="20" y={125+people*85}>どの横のわくも、同じ大きさの「全体の1」です。</text>}
    </svg>
    {active && <><p>{served===people?"囲んだ1人分は、全体を何等分したうちの何個分かな？":"色の部分を、1人ずつ同じ量になるように配ろう。"}</p><div className="upper__controls"><button type="button" disabled={served===people} onClick={()=>setServed(served+1)}>{served===people?"配り終わり":`${served+1}人目に配る`}</button><button type="button" onClick={()=>setServed(0)}>はじめから</button>{served===people && <button type="button" onClick={()=>setFormula(true)}>式で解く方法を見る</button>}</div></>}
  </div>;
}
function FractionDiagram({ visual, step }: { visual: Extract<SixVisual, {type:"fraction"}>; step:number }) {
  const { a, b, operation } = visual;
  if (visual.swapFactors) return <div className="six__swap">
    <p className="six__formula-line">
      <span className={step >= 0 ? "six__factor-match" : ""}>{fractionName(a)}</span>
      <span>×</span><span>{fractionName(b)}</span><span>＝</span><span>□</span><span>×</span>
      <span className={step >= 0 ? "six__factor-match" : ""}>{fractionName(a)}</span>
    </p>
    {step >= 0 && <p>色がついた分数は、左の式では先、右の式では後ろにあります。</p>}
    {step >= 1 && <p>左の式のもう一つの分数は、右の式のどこに入るかな？</p>}
  </div>;
  if (operation === "multiply") {
    if (b[1] === 1) return <div className="six__fraction"><div className="six__repeat">{Array.from({length:Math.min(b[0], Math.max(1, step + 2))}, (_, i) => <Whole unit={visual.unit} key={i} value={a} label={`${i + 1}つ目`} />)}</div></div>;
    return <FractionSubdivision key={`${a.join("/")}-${b.join("/")}-${step >= 0}`} visual={visual} step={step} />;
  }
  if (b[1] === 1) return <IntegerDivision key={`${a.join("/")}-${b[0]}-${step>=0}`} visual={visual} active={step>=0} />;
  return <FractionDivision key={`${a.join("/")}-${b.join("/")}-${step >= 0}`} visual={visual} active={step>=0} />;
}
function MeanDiagram({ values, unit, step }: { values: number[]; unit: string; step: number }) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const max = Math.max(...values, 1);
  return <div className="six__mean">
    <p>{step < 0 ? "1人ずつの得点を、同じ幅の棒で表したよ。" : step === 0 ? "でこぼこに注目。高い棒の余りを、低い棒へ移すとどうなるかな？" : "全部の得点はそのままで、棒が同じ高さになったよ。"}</p>
    <div className="six__mean-bars" role="img" aria-label={step >= 1 ? "同じ高さになった棒" : "一人ずつの得点を表した棒"}>
      {values.map((value, i) => <div className="six__mean-column" key={i}>
        <div className="six__mean-track">
          {step >= 0 && <span className="six__mean-level" style={{ bottom: `${mean / max * 100}%` }} />}
          <div className="six__mean-fill" style={{ height: `${(step >= 1 ? mean : value) / max * 100}%` }} />
        </div>
        <span>{i + 1}人目</span>
        <span>{step >= 1 ? `？${unit}` : `${value}${unit}`}</span>
      </div>)}
    </div>
  </div>;
}
function DataDiagram({ visual, step }: { visual: Extract<SixVisual,{type:"stats"}>;step:number }) {
  const {values,measure,unit}=visual;
  if (measure === "mean") return <MeanDiagram values={values} unit={unit} step={step} />;
  if(measure === "histogram") return <div className="six__histogram"><p>得点（点）：{values.join("、")}</p><svg viewBox="0 0 370 225" role="img" aria-label="横軸は10点刻みの得点区間、縦軸は人数の柱状グラフ">{Array.from({length:6},(_,i)=><g key={i}><path d={`M40 ${170-i*25}H340`} className="six__grid-line"/><text x="15" y={175-i*25}>{i}</text></g>)}<text x="8" y="20">人</text>{[0,10,20,30,40].map((low,i)=>{const count=values.filter(v=>v>=low && v<low+10).length;return <g key={low}><rect x={40+i*60} y={170-count*25} width="60" height={count*25} className={step>=0 && low===20?"six__histogram-focus":"six__original"}/><text x={40+i*60} y="193">{low}</text></g>;})}<text x="340" y="193">50</text><text x="120" y="218">得点（点）</text></svg>{step>=0 && <p>色をつけた棒が20点以上30点未満の区間です。上端を左の目盛りと比べます。</p>}</div>;
  if(measure === "frequency") return <div className="six__data"><p>得点（点）：{values.join("、")}</p><table><caption>10点ずつに分けた表（●1つ＝1人）</caption><thead><tr><th>得点の区間</th><th>人数を●で表す</th></tr></thead><tbody>{[0,10,20,30,40].map(low => <tr key={low}><th>{low}以上{low+10}未満</th><td>{step >= 0 ? values.filter(v=>v>=low && v<low+10).map((v,i)=><span className="six__data-dot" key={i} style={{animationDelay:`${i*.3}s`}} title={`${v}点`}>●</span>) : "？"}</td></tr>)}</tbody></table>{step>=1 && <p>区間の左の数は含み、右の数は含みません。30点は「30以上40未満」に入ります。</p>}</div>;
  if (measure === "compare") {
    const rows = [values, visual.other!];
    const limit = Math.ceil(Math.max(...rows.flat()) / 5) * 5;
    const position = (value: number) => `${value / limit * 100}%`;
    return <div className="six__compare"><p>同じ目盛りで、得点の広がりを比べよう。</p>{rows.map((row,i)=><div key={i}>
      <strong>{i===0?"A":"B"}組</strong>
      <div className="six__scatter" role="img" aria-label={`${i===0?"A":"B"}組の得点分布。${row.join("、")}点`}>
        <div className="six__scatter-axis" />
        {row.map((value,j)=><span key={j} style={{left:position(value)}}>●<small>{value}</small></span>)}
        {step>=1 && <div className="six__spread" style={{left:position(Math.min(...row)),width:position(Math.max(...row)-Math.min(...row))}} />}
      </div>
      <p>0点 ←————————→ {limit}点</p>
    </div>)}</div>;
  }
  const ordered=values.map((value,id)=>({value,id})).sort((a,b)=>a.value-b.value);
  const frequencies=values.map(value=>values.filter(v=>v===value).length);
  return <div className="six__data"><p>{step < 0 ? "調べた順の得点" : "小さい順に並べます"}（{unit}）</p><div className="six__sort" style={{width:`${values.length*48}px`}}>{values.map((value,id)=>{const rank=ordered.findIndex(v=>v.id===id);const selected=step>=1 && (measure==="median" ? rank===Math.floor((values.length-1)/2)||rank===Math.floor(values.length/2) : measure==="mode" && frequencies[id]===Math.max(...frequencies));return <span key={id} className={selected?"is-selected":""} style={{transform:`translateX(${(step<0?id:rank)*48}px)`}}>{value}</span>;})}</div>{step>=1 && <p>{measure==="median"?"真ん中に注目。2つなら、その2つの平均を求めます。":measure==="mode"?"同じ数がいちばん多く集まったところに注目。":"全部を合わせ、人数で同じ数ずつ分けます。"}</p>}</div>;
}
export function GradeSixDiagram({ visual, step }: { visual: SixVisual; step:number }) {
  if (visual.type === "fraction") return <FractionDiagram visual={visual} step={step} />;
  if (visual.type === "stats") return <DataDiagram visual={visual} step={step} />;
  if (visual.type === "expression") return <div className="six__expression">
    <div className={step===0?"is-selected":""}><small>1つ分の代金</small><strong>{visual.price}円</strong></div>
    {step>=0 && <span aria-label="かける">×</span>}
    <div className={step===0?"is-selected":""}><small>買う数</small><strong>{visual.count}{visual.countUnit ?? "こ"}</strong></div>
    {visual.extra>0 && <>{step>=1 && <span aria-label="たす">＋</span>}<div className={step>=1?"is-selected":""}><small>もう1つ買うもの</small><strong>{visual.extra}円</strong></div></>}
    {step>=1 && <><span>→</span><div><small>全部の代金</small><strong>？円</strong></div></>}
    {step===0 && <p>{visual.count === "x" ? "同じ値段のものは、1つ分の代金に買う数をかけます。" : `買う数を表すxに${visual.count}を入れ、1つ分の代金にかけます。`}</p>}
  </div>;
  if (visual.type === "survey") return <table className="six__survey"><caption>調べ方を比べよう</caption><thead><tr><th>案</th><th>誰に聞く？</th></tr></thead><tbody>{visual.choices.map((choice,i)=><tr key={i}><th>{i===0?"A":"B"}</th><td>{choice}</td></tr>)}</tbody>{step>=0 && <tfoot><tr><td colSpan={2}>調べたい人たち全体と、聞く相手が合っているかな？</td></tr></tfoot>}</table>;
  if (visual.type === "possibilities") return <div className="six__possibilities">
    <p>候補：{visual.items.join("・")}</p>
    <p>{visual.ordered?"左が委員長、枝の先が副委員長です。":"左の人と枝の先の人を合わせて、1組です。"}</p>
    {step>=0 && <div className="six__tree">{visual.items.slice(0,step===0?1:undefined).map((item,i)=>{
      const others=visual.ordered?visual.items.filter(other=>other!==item):visual.items.slice(i+1);
      return others.length>0 && <div className="six__branch" key={item}><strong>{item}</strong><div>{others.map((other,j)=><p key={other} style={{animationDelay:`${j*.25}s`}}>→ {other}</p>)}</div></div>;
    })}</div>}
    {step>=1 && <p>{visual.ordered?"役割が逆なら別の選び方。枝1本を1通りと数えよう。":"すでに出た2人組をくり返さず、枝1本を1通りと数えよう。"}</p>}
  </div>;
  if (visual.type === "estimate") return <div className="six__estimate"><p>{visual.shape==="rectangle"?"横":"底辺"} {visual.width}m ／ {visual.shape==="rectangle"?"たて":"高さ"} {visual.height}m</p><svg viewBox="0 0 285 170" role="img" aria-label="不規則な形に長方形または三角形を重ねて見立てる図"><path d={visual.shape==="rectangle"?"M28 37 Q70 10 105 30 T225 25 Q248 66 224 92 Q243 135 204 135 Q165 151 127 133 Q65 153 28 132 Q6 92 28 37Z":"M18 140 Q40 110 65 88 Q96 68 130 25 Q163 63 182 84 Q215 111 240 140 Q174 151 130 138 Q76 153 18 140Z"} className="six__original" />{step>=0 && <path d={visual.shape==="rectangle"?"M25 25H235V140H25Z":"M25 140L130 25L235 140Z"} className="six__outline" />}{step>=1 && <><path d={visual.shape==="rectangle"?"M25 145H235 M235 25V140":"M25 145H235 M130 25V140 M130 132H138V140"} className="six__axis" /><text x={visual.shape==="rectangle"?238:142} y="85">{visual.height}m</text><text x="105" y="165">{visual.width}m</text></>}</svg></div>;
  const {mode,width,height,factor}=visual;
  if (mode === "map") return <div className="six__map">
    <p>地図上の道：{width}cm</p>
    <svg viewBox="0 0 320 105" role="img" aria-label={`家から学校まで、地図上で${width}cmの道`}>
      <text x="10" y="25">家</text><text x="255" y="25">学校</text>
      <path d="M25 50H285" className="six__axis" /><circle cx="25" cy="50" r="5" /><circle cx="285" cy="50" r="5" />
      {step < 0 ? <text x="130" y="82">{width}cm</text> : Array.from({length:width},(_,i)=>{
        const segment=260/width;
        const x=25+i*segment;
        return <g key={i} className="six__map-segment" style={{animationDelay:`${i*.18}s`}}><path d={`M${x} 42v16 M${x} 50h${segment}`} className="six__outline" /><text textAnchor="middle" x={x+segment/2} y="78">1cm</text></g>;
      })}
    </svg>
    {step>=0 && <p>地図の1cmごとに、実際の{factor}cmが対応します。</p>}
    {step>=1 && <p>{width}区間あるので、実際は {factor}cm × {width}。100cmずつを1mに直そう。</p>}
  </div>;
  const baseWidth = 90 / Math.max(1, factor);
  const baseHeight = baseWidth * height / width;
  if (mode === "scale") {
    const ratioLabel = factor < 1 ? `1/${1/factor}` : String(factor);
    return <div className="six__scale">
      <svg viewBox="0 0 360 170" role="img" aria-label="もとの図と形を変えずに拡大・縮小した図">
        <g><rect x="15" y="50" width={baseWidth} height={baseHeight} className="six__original" /><text x="25" y="135">横{width}cm</text><text x="8" y="35">たて{height}cm</text></g>
        <text x="120" y="80">→</text>
        <g className="six__scaled" style={{transform:`translate(240px,80px) scale(${step<0?1:factor})`}}><rect x={-baseWidth/2} y={-baseHeight/2} width={baseWidth} height={baseHeight} className="six__original" /></g>
        <text x="215" y="24">たて？cm</text><text x="215" y="135">横？cm</text><text x="150" y="160">どちらの辺も × {ratioLabel}</text>
      </svg>
      {step>=0 && <p>もとの横は新しい図の横に、もとのたては新しい図のたてに対応します。聞かれた辺に {ratioLabel} をかけよう。</p>}
    </div>;
  }
  if(mode==="line") return <div className="six__symmetry"><svg viewBox="0 0 260 160" role="img" aria-label="対称の軸をはさんだ点Aと点B"><path d="M40 30H220V130H40Z" className="six__outline" /><path d="M130 10V150" className="six__axis"/><text x="135" y="17">対称の軸</text><circle cx="60" cy="80" r="5"/><circle cx="200" cy="80" r="5"/><text x="44" y="72">A</text><text x="204" y="72">B</text><path d="M60 83H130" className="six__axis"/><text x="75" y="105">{width}cm</text><g className="six__fold" style={{transform:step>=1?"rotateY(180deg)":"rotateY(0deg)"}}><path d="M40 30H130V130H40Z" className="six__original" /><circle cx="60" cy="80" r="5" className="six__moving-point" /></g></svg>{step>=0 && <p>軸で折ると重なるかな？ 軸からの距離を比べよう。</p>}</div>;
  return <div className="six__symmetry"><svg viewBox="0 0 260 160" role="img" aria-label="長方形ABCDと対称の中心O"><rect x="45" y="30" width="170" height="100" className="six__outline"/><text x="30" y="25">A</text><text x="218" y="25">B</text><text x="218" y="148">C</text><text x="30" y="148">D</text><circle cx="130" cy="80" r="4"/><text x="136" y="77">O</text><g className="six__turn" style={{transform:`rotate(${step>=1?180:0}deg)`}}><path d="M45 30H215V130H45Z" className="six__original"/><circle cx={visual.markedPoint === "B" ? 215 : 45} cy="30" r="7" className="six__moving-point"/></g></svg>{step>=0 && <p>色のついた点を、中心Oのまわりに半回転します。</p>}</div>;
}
