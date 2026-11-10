import { useRef, useState } from "react";
import type { GradeOneTopic } from "../../lesson/grade-one";
import "./GradeOneGuide.css";

type Scene = { label: string; lines: string[]; kind?: "clock" | "length" | "measure" };
const scenes: Record<GradeOneTopic, Scene[]> = {
  compare: [{label:"1こずつ ならべて みよう。",lines:["🍎　🍎　🍎", "🍊　🍊"]},{label:"2くみ できて、りんごが 1こ あまるよ。",lines:["🍎　🍎　🍎", "↕　 ↕", "🍊　🍊"]}],
  count: [{label:"ほしを ひとつずつ かぞえよう。",lines:["⭐　⭐　⭐　⭐"]},{label:"1つめ。",lines:["⭐　⭐　⭐　⭐","1"]},{label:"つぎは2つめ。",lines:["⭐　⭐　⭐　⭐","1　 2"]},{label:"つぎは3つめ。",lines:["⭐　⭐　⭐　⭐","1　 2　 3"]},{label:"さいごは4つめ。ぜんぶで4こ。",lines:["⭐　⭐　⭐　⭐","1　 2　 3　 4"]}],
  order: [{label:"1ずつ ふえると、つぎは どの かず？",lines:["1 → 2 → □ → 4"]},{label:"2の つぎは3、3の つぎは4。",lines:["1 → 2 → 3 → 4"]}],
  compose: [{label:"5こを 2こ と のこりに わけよう。",lines:["🍎 🍎 🍎 🍎 🍎"]},{label:"2この ほかに 3こ あるよ。",lines:["🍎 🍎 ｜ 🍎 🍎 🍎"," 2こ　｜　3こ"]}],
  tens: [{label:"10この まとまりが 1つ。",lines:["［● ● ● ● ● ● ● ● ● ●］"]},{label:"そこへ 4こ。10と4で14。",lines:["［10こ］ ＋ ● ● ● ●","10 ＋ 4 ＝ 14"]}],
  hundred: [{label:"10こで 1つの たばを つくるよ。",lines:["［10こ］"]},{label:"その たばが 10こで 100。",lines:["［10］［10］［10］［10］［10］","［10］［10］［10］［10］［10］"]}],
  "tens-unit": [{label:"10こずつ たばに するよ。",lines:["［10］"]},{label:"10、20、30と 10ずつ かぞえよう。",lines:["［10］ ［10］ ［10］"," 10 → 20 → 30"]}],
  groups: [{label:"6この あめを、2にんに 1こずつ わけよう。",lines:["🍬 🍬 🍬 🍬 🍬 🍬"]},{label:"おなじかずずつ わけると、ひとり3こ。",lines:["ひとりめ　🍬 🍬 🍬","ふたりめ　🍬 🍬 🍬"]}],
  "compare-groups": [{label:"10この たばが2つで20。",lines:["［10］ ［10］ → 20"]},{label:"ばらの3こを あわせると23。",lines:["［10］ ［10］ ＋ ● ● ●","20 ＋ 3 ＝ 23"]}],
  addition: [{label:"はじめに 3こ あるよ。",lines:["🍎 🍎 🍎"]},{label:"もらった 2こを あわせよう。",lines:["🍎 🍎 🍎　＋　🍎 🍎"]},{label:"あわせて 5こ。",lines:["🍎 🍎 🍎 🍎 🍎","3 ＋ 2 ＝ 5"]}],
  subtraction: [{label:"はじめに 5こ あるよ。",lines:["🍎 🍎 🍎 🍎 🍎"]},{label:"2こ たべると、3こ のこるよ。",lines:["🍎 🍎 🍎　｜　🍎 🍎","のこり3こ　　　たべた2こ"]}],
  carry: [{label:"8こに 5こを たそう。",lines:["● ● ● ● ● ● ● ●　＋　● ● ● ● ●"]},{label:"5を2と3に わけ、8に2を たして10。",lines:["8 ＋ （2 ＋ 3）","（8 ＋ 2） ＋ 3"]},{label:"10と のこりの3で13。",lines:["［10この まとまり］ ＋ ● ● ●","10 ＋ 3 ＝ 13"]}],
  "two-digit": [{label:"20は10が2つ。",lines:["［10］ ［10］"]},{label:"3こを あわせると23。",lines:["［10］ ［10］ ＋ ● ● ●","20 ＋ 3 ＝ 23"]}],
  borrow: [{label:"13を10と3に わけるよ。",lines:["［10こ］ ＋ ● ● ●"]},{label:"10から5を とると5こ。",lines:["10 − 5 ＝ 5"]},{label:"のこりの3こも あわせて8こ。",lines:["● ● ● ● ●　＋　● ● ●","5 ＋ 3 ＝ 8"]}],
  shape: [{label:"ボールと はこを みくらべよう。",lines:["⚽ ボール　　📦 はこ"]},{label:"ボールは まるく、いろいろな むきに ころがるよ。",lines:["⚽ → →　　📦"]}],
  "shape-build": [{label:"おなじ さんかくが 2まい あるよ。",lines:["◢　 ◤"]},{label:"2まいを あわせると、もとの しかく。",lines:["◢ ＋ ◤ → ■"]}],
  position: [{label:"えを みている ひとから みて みぎを さがそう。",lines:["🐱　🐶　🐰"]},{label:"いぬから みぎへ → うさぎ。",lines:["🐱　🐶 → 🐰"]}],
  "shape-parts": [{label:"つみきが 1こと1こ。",lines:["🟦　 🟦"]},{label:"よこに ならべると、よこに ながい かたち。",lines:["🟦🟦"]}],
  length: [{label:"テープの ひだりの はしを そろえて くらべよう。",lines:[],kind:"length"},{label:"はしを そろえると、あかい テープが ながいね。",lines:[],kind:"length"}],
  measure: [{label:"えんぴつの はしから ブロックを ならべよう。",lines:[],kind:"measure"},{label:"おなじ ながさの ブロックが4こぶん。",lines:[],kind:"measure"}],
  volume: [{label:"おなじ コップを いっぱいに して はかるよ。",lines:["おなじ コップ　🥛"]},{label:"Aは3ばい、Bは2はい。Aが おおい。",lines:["A　🥛 🥛 🥛","B　🥛 🥛"]}],
  clock: [{label:"ながい はりは12を さしているよ。",lines:[],kind:"clock"},{label:"みじかい はりは3。3じ です。",lines:[],kind:"clock"}],
  "daily-time": [{label:"おやつは3じ。とけいを よもう。",lines:[],kind:"clock"},{label:"みじかい はりが3、ながい はりが12。3じです。",lines:[],kind:"clock"}],
  chart: [{label:"ひとりに ●ひとつを ならべるよ。",lines:["りんご　● ● ●","みかん　● ●"]},{label:"ひだりから 1つずつ くらべると、りんごが1つ おおい。",lines:["りんご　● ● ●","みかん　● ●"]}],
  "chart-read": [{label:"●ひとつが ひとりぶん。",lines:["おにごっこ　● ● ● ●","なわとび　　● ●"]},{label:"おにごっこの ●を かぞえると4つ。4にん。",lines:["おにごっこ　● ● ● ●","　　　　　　1　2　3　4"]}],
};
// 問題に取り組む前は、数量の関係だけを示し、答えの数や選択肢を言わない。
const thinking: Record<GradeOneTopic, Scene[]> = {
  compare: [scenes.compare[0], {label:"ひだりから 1こずつ ペアに しよう。",lines:[]}],
  count: scenes.count.slice(0, 4),
  order: [scenes.order[0], {label:"2の つぎを ひとつ すすめて みよう。",lines:["1 → 2 → □ → 4"]}],
  compose: [scenes.compose[0], {label:"2こを わけて、のこりを かぞえよう。",lines:["🍎 🍎 ｜ 🍎 🍎 🍎", "2こ　｜　□こ"]}],
  tens: [scenes.tens[0], {label:"10の まとまりと、ばらを あわせよう。",lines:["［10こ］ ＋ ● ● ● ●"]}],
  hundred: [scenes.hundred[0], {label:"10の たばを じゅんに かぞえよう。",lines:["［10］［10］［10］［10］［10］", "［10］［10］［10］［10］［10］"]}],
  "tens-unit": [scenes["tens-unit"][0], {label:"10が いくつ あるかな？",lines:["［10］ ［10］ ［10］"]}],
  groups: [scenes.groups[0]],
  "compare-groups": [scenes["compare-groups"][0], {label:"20と ばらの3こを あわせよう。",lines:["［10］ ［10］ ＋ ● ● ●"]}],
  addition: scenes.addition.slice(0, 2),
  subtraction: [scenes.subtraction[0], {label:"2こを とりのぞいて、のこりを みよう。",lines:["🍎 🍎 🍎　｜　🍎 🍎", "のこり　　　たべる2こ"]}],
  carry: scenes.carry.slice(0, 2),
  "two-digit": [scenes["two-digit"][0], {label:"そこに3こを あわせよう。",lines:["［10］ ［10］ ＋ ● ● ●"]}],
  borrow: scenes.borrow.slice(0, 2),
  shape: [scenes.shape[0], {label:"それぞれの かたちを くらべよう。",lines:["⚽ ボール　　📦 はこ"]}],
  "shape-build": [scenes["shape-build"][0], {label:"2まいの ななめの へんを あわせると？",lines:["◢　 ◤"]}],
  position: [scenes.position[0], {label:"えを みている ひとからの みぎは → の ほう。",lines:["🐱　🐶　🐰", "　　　　→"]}],
  "shape-parts": [scenes["shape-parts"][0], {label:"よこは ひだりから みぎの むき。",lines:["←　よこ　→"]}],
  length: [scenes.length[0], {label:"ひだりを そろえて、みぎの はしを くらべよう。",lines:[],kind:"length"}],
  measure: [scenes.measure[0], {label:"はしから ブロックを ひとつずつ かぞえよう。",lines:[],kind:"measure"}],
  volume: [scenes.volume[0], {label:"おなじ コップで はかった かずを くらべよう。",lines:["A　🥛 🥛 🥛", "B　🥛 🥛"]}],
  clock: [scenes.clock[0], {label:"みじかい はりは どの かずを さしている？",lines:[],kind:"clock"}],
  "daily-time": [scenes["daily-time"][0], {label:"みじかい はりは どの かずを さしている？",lines:[],kind:"clock"}],
  chart: [scenes.chart[0], {label:"ひだりから 1つずつ くらべよう。",lines:[]}],
  "chart-read": [scenes["chart-read"][0], {label:"おにごっこの ●を ひとつずつ かぞえよう。",lines:[]}],
};

function Illustration({ scene, topic, index }: { scene: Scene; topic: GradeOneTopic; index: number }) {
  if (topic === "carry" && index > 0) return <div className="grade-guide__ten-demo" role="img" aria-label="8こと2こで10、のこり3こ"><div className="grade-guide__ten">{Array.from({ length: 10 }, (_, i) => <span key={i} className={i >= 8 ? "is-moved" : ""}>●</span>)}</div><div>10この まとまり</div><div>のこり　● ● ●</div></div>;
  if (topic === "borrow" && index === 1) return <div className="grade-guide__ten-demo" role="img" aria-label="10こから5こを とって、5このこる"><div className="grade-guide__ten">{Array.from({ length: 10 }, (_, i) => <span key={i} className={i >= 5 ? "is-removed" : ""}>●</span>)}</div><div>5こ のこる　／　5こ とる</div></div>;
  if (topic === "shape-build") return <div className={`grade-guide__triangles ${index > 0 ? "is-joined" : ""}`} role="img" aria-label="おなじ かたちの さんかく2まい"><span /><span /></div>;
  if (topic === "chart" || topic === "chart-read") {
    const first = topic === "chart" ? 3 : 4;
    return <div className="grade-guide__chart" role="img" aria-label={topic === "chart" ? "りんご ● ● ●、みかん ● ●" : "おにごっこ ● ● ● ●、なわとび ● ●"}>
      <span>{topic === "chart" ? "りんご" : "おにごっこ"}</span><div>{Array.from({ length: first }, (_, i) => <b key={i} className="grade-guide__mark" style={{ animationDelay: `${i * 0.45}s` }}>{"●"}</b>)}</div>
      <span>{topic === "chart" ? "みかん" : "なわとび"}</span><div>{Array.from({ length: 2 }, (_, i) => <b key={i} className="grade-guide__mark" style={{ animationDelay: `${i * 0.45}s` }}>●</b>)}</div>
    </div>;
  }
  if (topic === "compare") return <div className="grade-guide__pairs" aria-label={index === 0 ? "りんご3こ、みかん2こ" : "りんごと みかんを 1こずつ ならべた ず"}><div>🍎</div><div>🍎</div><div>🍎</div><div>{index > 0 ? "↕" : "　"}</div><div>{index > 0 ? "↕" : "　"}</div><div>　</div><div>🍊</div><div>🍊</div></div>;
  if (scene.kind === "clock") {
    const hour = topic === "daily-time" ? 8 : 3;
    return <div className="grade-guide__clock-wrap"><div className={`grade-guide__clock grade-guide__clock--${index}`} role="img" aria-label={`ながい はりが12、みじかい はりが${hour}を さす とけい`}>
      {Array.from({ length: 12 }, (_, i) => { const number = i + 1; const angle = number * Math.PI / 6; return <span key={number} className="clock-face-number" style={{ left: `${50 + 40 * Math.sin(angle)}%`, top: `${50 - 40 * Math.cos(angle)}%` }}>{number}</span>; })}
      <i className="clock-long"/><i className="clock-short" style={{ transform: `rotate(${hour * 30 - 90}deg)` }} /><b className="clock-center"/></div><span>{index === 0 ? "ながい はり → 12" : "みじかい はりを みよう"}</span></div>;
  }
  if (scene.kind === "length") return <div className="grade-guide__length" aria-label="あかい テープと あおい テープの ひだりを そろえた ず"><div>あか <span /></div><div>あお <span /></div></div>;
  if (scene.kind === "measure") return <div className="grade-guide__measure" aria-label="えんぴつの したに、ブロックが すきまなく ならんでいます"><div>えんぴつ</div><div className="measure-pencil"/><div>ブロック</div><div className="measure-blocks"><span>■</span><span>■</span><span>■</span><span>■</span></div></div>;
  return <div className="grade-guide__lines">{scene.lines.map((line, i) => <div key={i}>{line}</div>)}</div>;
}
/** 問題画面でも、幅や針の向きがずれない図を使う。 */
export function GradeOneProblemVisual({ topic }: { topic: GradeOneTopic }) {
  if (topic === "clock" || topic === "daily-time") return <Illustration scene={{ label: "", lines: [], kind: "clock" }} topic={topic} index={0} />;
  if (topic === "length") return <Illustration scene={{ label: "", lines: [], kind: "length" }} topic={topic} index={0} />;
  if (topic === "measure") return <Illustration scene={{ label: "", lines: [], kind: "measure" }} topic={topic} index={0} />;
  return null;
}
/** 問題とは別の時刻で、短い針と「何時」の対応を試す。 */
function ClockPractice() {
  const [hour, setHour] = useState<1 | 2>(1);
  return <div className="clock-practice">
    <p>まずは べつの とけいで れんしゅうしよう。</p>
    <p>ながい はりが12の とき、みじかい はりの かずに「じ」を つけて よむよ。</p>
    <div className="clock-practice__row">
      <div className="clock-practice__face" role="img" aria-label={`ながい はりは12、みじかい はりは${hour}を さす とけい`}>
        {Array.from({ length: 12 }, (_, i) => { const number = i + 1; const angle = number * Math.PI / 6; return <span key={number} className="clock-practice__number" style={{ left: `${50 + 41 * Math.sin(angle)}%`, top: `${50 - 41 * Math.cos(angle)}%` }}>{number}</span>; })}
        <span className="clock-practice__long" /><span className="clock-practice__short" style={{ transform: `rotate(${hour * 30 - 90}deg)` }} /><span className="clock-practice__center" />
      </div>
      <div aria-live="polite"><p>みじかい はり → {hour}</p><p>よみかた → <strong>{hour}じ</strong></p></div>
    </div>
    <p>はりを うごかして、かずと よみかたが どう かわるか みよう。</p>
    <div className="grade-guide__controls"><button type="button" onClick={() => setHour(hour === 1 ? 2 : 1)}>みじかい はりを うごかす</button><button type="button" onClick={() => setHour(1)} disabled={hour === 1}>はじめから</button></div>
  </div>;
}
export function GradeOneGuide({ topic }: { topic: GradeOneTopic }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [distributed, setDistributed] = useState(0);
  const items = thinking[topic];
  return <div className="grade-guide"><button type="button" onClick={() => { setIndex(0); setDistributed(0); dialog.current?.showModal(); }}>ずの うごきを みる</button>
    <dialog ref={dialog} className="grade-guide__dialog" aria-labelledby="grade-guide-title"><div className="grade-guide__header"><h2 id="grade-guide-title">ずで かんがえよう</h2><button type="button" onClick={() => dialog.current?.close()}>とじる</button></div>
      <div className="grade-guide__body">{topic === "clock" || topic === "daily-time" ? <ClockPractice /> : <><p aria-live="polite">{items[index].label}</p>{topic === "groups" ? <><div className="grade-guide__distribution" aria-label="あめを ふたりに じゅんばんに わける ず"><div>まだの あめ　{"🍬 ".repeat(6 - distributed)}</div><div>ひとりめ　{Array.from({ length: Math.ceil(distributed / 2) }, (_, i) => <span className="grade-guide__candy" key={i}>🍬</span>)}</div><div>ふたりめ　{Array.from({ length: Math.floor(distributed / 2) }, (_, i) => <span className="grade-guide__candy" key={i}>🍬</span>)}</div></div><div className="grade-guide__controls"><button type="button" disabled={distributed === 6} onClick={() => setDistributed(distributed + 1)}>1こ くばる</button><button type="button" onClick={() => setDistributed(0)}>はじめから</button></div></> : <><div key={index} className="grade-guide__scene"><Illustration scene={items[index]} topic={topic} index={index} /></div><div className="grade-guide__controls"><button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>まえへ</button><span>{index + 1} / {items.length}</span><button type="button" disabled={index === items.length - 1} onClick={() => setIndex(index + 1)}>つぎの ず</button></div></>}</>}</div>
    </dialog></div>;
}
