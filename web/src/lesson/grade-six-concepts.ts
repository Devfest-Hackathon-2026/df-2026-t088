import type { Concept } from "./upper-concepts";
import type { SixVisual } from "./grade-six-types";

/** 本題とは異なる数で、言葉→図の操作→式の順に説明する。 */
export function gradeSixConcept(visual: SixVisual): Concept {
  if (visual.type === "fraction") {
    if (visual.swapFactors) {
      const example: SixVisual = {kind:"six",type:"fraction",a:[1,2],b:[1,4],operation:"multiply"};
      return {name:"かける順番",scenes:[
        {text:"まず、1/2のさらに1/4を図で見ます。色の部分は全体の1/8です。",visual:example,step:1,formula:"1/2 × 1/4 ＝ 1/8"},
        {text:"今度は順番を入れ替え、1/4のさらに1/2を図で見ます。色の広さは同じです。",visual:{...example,a:[1,4],b:[1,2]},step:1,formula:"1/4 × 1/2 ＝ 1/8",definition:"分数のかけ算でも、かける順番を入れ替えても答えは同じです。"},
      ]};
    }
    const multiply = visual.operation === "multiply";
    const example: SixVisual = multiply ? { kind:"six",type:"fraction",a:[1,2],b:[1,3],operation:"multiply" } : {kind:"six",type:"fraction",a:[1,2],b:[1,4],operation:"divide"};
    return { name: multiply ? "分数のかけ算" : "分数のわり算と逆数", scenes: multiply ? [
      {text:"全体の1を2等分したうちの1つ分、1/2があります。さらに、その1/3を考えます。",visual:example,step:-1},
      {text:"半分の部分を3等分します。全体にも同じ切れ目を入れると6等分です。",visual:example,step:0},
      {text:"1/3は、同じ大きさに3つに分けたうちの1つ分です。もとの半分は①②③。そのうち①を1つ分として選び、赤くします。",visual:example,step:1},
      {text:"その1つ分は、全体の6等分の1つ分。1/6です。",visual:example,step:1,formula:"1/2 × 1/3 ＝ 1/6",definition:"分数をかけるときは、分子どうし、分母どうしをかけます。かける順序を入れ替えても積は同じです。"},
    ] : [
      {text:"1/2Lのジュースの中に、1/4Lが何杯分入るか考えます。",visual:example,step:-1},
      {text:"同じ大きさに切り分けて、1/4Lの杯と比べます。",visual:example,step:0},
      {text:"1/4Lずつなら2杯分です。両方の量を4倍すると、2L÷1Lになり、杯数は変わりません。",visual:example,step:1,formula:"1/2 ÷ 1/4 ＝ 1/2 × 4 ＝ 2",definition:"わる数を1にするため、その逆数を両方にかけます。分数でわる計算は、その分数の逆数をかける計算に直せます。逆数は、かけると1になる数です。"},
    ] };
  }
  if (visual.type === "expression") {
    const example: SixVisual = {kind:"six",type:"expression",price:30,count:"x",extra:20};
    return {name:"文字を使った式",scenes:[{text:"1こ30円のお菓子を何こか買います。変わるこ数をxと書きます。",visual:example,step:-1},{text:"お菓子の代金は30×x円。さらに20円の袋を買うので、その代金を足します。",visual:example,step:1,formula:"30 × x ＋ 20",definition:"文字は、いろいろな数の代わりに使えます。xが2なら30×2＋20です。数字と文字のかけ算は30xとも書けます。"}]};
  }
  if (visual.type === "transform") {
    if(visual.mode === "map") return {name:"縮尺",scenes:[{text:"縮尺1/100は、実際の長さを100分の1にした図という意味です。",visual:{...visual,width:2,factor:100},step:-1},{text:"地図の1cmは実際の100cm。2cmなら200cmなので2mです。",visual:{...visual,width:2,factor:100},step:1,formula:"2 × 100 ＝ 200cm ＝ 2m",definition:"実際の長さは、縮図の長さをもとの倍率に戻して求めます。単位もそろえましょう。"}]};
    if(visual.mode === "scale") return {name:"拡大図と縮図",scenes:[{text:"同じ形のまま大きくするのが拡大図、小さくするのが縮図です。",visual:{...visual,width:3,height:2,factor:2},step:-1},{text:"2倍の拡大図では、横もたても2倍。角の大きさは変わりません。",visual:{...visual,width:3,height:2,factor:2},step:1,definition:"対応する辺の長さの比がすべて等しく、対応する角の大きさも等しい図が拡大図・縮図です。"}]};
    return {name:visual.mode === "line"?"線対称":"点対称",scenes:[{text:visual.mode === "line"?"軸となる直線で折って、図形が重なるか考えます。":"中心となる点のまわりに、図形を半回転させてみます。",visual:{...visual,width:2},step:-1},{text:visual.mode === "line"?"折ると対応する点が重なります。軸からの距離が同じです。":"半回転は180°です。回すと重なる図形を点対称といいます。",visual:{...visual,width:2},step:1,definition:visual.mode === "line"?"1本の直線で折ると重なる図形が線対称な図形です。":"1つの点を中心に180°回すと重なる図形が点対称な図形です。"}]};
  }
  if(visual.type === "estimate") return {name:"およその面積",scenes:[{text:"身の回りの形には、曲がったところや小さなでこぼこがあります。",visual:{...visual,width:10,height:6},step:-1},{text:"でこぼこをならして、面積を求められる図形を重ねます。",visual:{...visual,width:10,height:6},step:0},{text:visual.shape === "rectangle"?"長方形とみなすと、10×6でおよそ60m²です。":"三角形とみなすと、10×6÷2でおよそ30m²です。",visual:{...visual,width:10,height:6},step:1,definition:"実際の形と完全には同じでないので、求めた値はおよその面積です。"}]};
  if(visual.type === "survey") return {name:"目的に合うデータの集め方",scenes:[{text:"クラス全員の好きな給食を調べたいとします。",visual:{kind:"six",type:"survey",choices:["自分と仲のよい3人だけに聞く","クラス全員に同じ質問をする"]},step:-1},{text:"親しい人だけでは、好みが偏るかもしれません。調べたい集団に合う集め方を考えましょう。",visual:{kind:"six",type:"survey",choices:["自分と仲のよい3人だけに聞く","クラス全員に同じ質問をする"]},step:0,definition:"何を知りたいかを決め、誰から、何を、どう集めるかをそろえます。"}]};
  if (visual.type === "possibilities") {
    const example: SixVisual = {...visual, items: visual.ordered ? ["あき","けん"] : ["あき","けん","みお"]};
    return {name:visual.ordered?"樹形図と順序":"組み合わせ",scenes:[
      {text:visual.ordered?"委員長をあきさんに決めます。副委員長の候補へ、枝を1本ずつのばします。":"2人組を作ります。まず、あきさんと組める相手へ枝をのばします。",visual:example,step:0},
      {text:visual.ordered?"次はけんさんを委員長にします。役割が入れ替わると別の選び方です。":"次はけんさんの相手を考えます。あきさんとの組はもう数えたので、みおさんとの組だけを足します。",visual:example,step:1,
        definition:visual.ordered?"選び方を枝分かれで整理した図を樹形図といいます。枝の先までたどった1本が1通りです。":"同じ2人で作る組は、順番が逆でも1通りです。"}
    ]};
  }
  const measure=visual.measure;
  if (measure === "mean" || measure === "compare") {
    const sample: SixVisual = {kind:"six",type:"stats",measure,unit:"点",values:measure==="mean"?[2,4,6]:[2,3,4],other:measure==="compare"?[1,3,5]:undefined};
    return measure === "mean"
      ? {name:"平均",scenes:[
        {text:"3人の得点は2点、4点、6点。棒の高さをそろえてみよう。",visual:sample,step:-1},
        {text:"6点の棒が高く、2点の棒が低いね。高い方から低い方へ2点分移してみよう。",visual:sample,step:0},
        {text:"3本とも4点の高さになりました。得点の合計は変わりません。",visual:sample,step:1,formula:"（2＋4＋6）÷3＝4点",definition:"全部を合わせて人数でわると、平均が求められます。"}
      ]}
      : {name:"データの散らばり",scenes:[
        {text:"A組は2・3・4点、B組は1・3・5点です。両方とも平均は3点です。",visual:sample,step:-1},
        {text:"両組を同じ目盛りで比べます。点のいちばん左と右に注目しましょう。",visual:sample,step:0},
        {text:"A組の点は2〜4点、B組の点は1〜5点に広がっています。A組の方が、せまい範囲に集まっています。",visual:sample,step:1,definition:"平均が同じでも、得点の広がりは変わることがあります。"}
      ]};
  }
  const sample:SixVisual={kind:"six",type:"stats",values:(measure==="frequency" || measure==="histogram")?[10,20,21,30]:measure==="mode"?[2,5,2,4,2]:[2,5,3],measure,unit:"点"};
  const names={mean:"平均",median:"中央値",mode:"最頻値",frequency:"度数分布",histogram:"柱状グラフ",compare:"データの散らばり"};
  const isInterval = measure === "frequency" || measure === "histogram";
  return {name:names[measure],scenes:[
    {text:"まず、集めた一人一人の得点を見ます。",visual:sample,step:-1},
    {text:isInterval?"10点ごとの区間に分けます。区間ごとの人数を度数といいます。":"値を小さい順に並べると、特徴を調べやすくなります。",visual:sample,step:0},
    {text:measure==="median"?"2、3、5の真ん中は3なので、中央値は3点です。真ん中に2つある場合は、その2つの平均を求めます。":measure==="mode"?"2が3回出て、いちばん多いので最頻値は2点です。":"20点以上30点未満には20点と21点が入ります。30点は次の区間に入ります。",
      visual:sample,step:1,definition:measure==="median"?"中央値は、データを小さい順に並べたときの中央を表す値です。":measure==="mode"?"最頻値は、最も多く出てくる値です。複数ある場合もあります。":"区間ごとの度数をまとめた表が度数分布表です。棒の高さで度数を表す図が柱状グラフです。"}
  ]};
}
