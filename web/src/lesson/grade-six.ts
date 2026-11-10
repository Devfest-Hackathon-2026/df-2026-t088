import type { UpperChapter, UpperQuestion } from "./upper-math";
import type { SixVisual } from "./grade-six-types";

const q = (title: string, problem: string, visual: SixVisual, hints: [string, string], answer: string, explanation: string, unit = ""): UpperQuestion => ({ title, problem, visual, hints, answer, explanation, unit, retry: "問題の数と図の対応を、もう一度確かめましょう。必要なら説明も開けます。" });
export const pair = (practice: UpperQuestion, test: UpperQuestion) => ({ practice, test });
export const series = (first: UpperQuestion, ...followUps: UpperQuestion[]): UpperQuestion => ({ ...first, followUps });
const f = ([n, d]: [number, number]) => d === 1 ? `${n}` : `${n}/${d}`;
export function fraction(a: [number, number], b: [number, number], operation: "multiply" | "divide", answer: string, problem?: string, unit = "", baseUnit?: string): UpperQuestion {
  const multiply = operation === "multiply";
  let numerator = a[0] * b[0];
  let denominator = a[1] * b[1];
  while (denominator !== 0) [numerator, denominator] = [denominator, numerator % denominator];
  const multiplicationGuide = b[1] === 1
    ? "分母はそのままで、分子に整数をかけます。"
    : "分子どうし、分母どうしをかけます。";
  const reductionGuide = numerator > 1 ? "最後に約分します。" : "";
  return { ...q(multiply ? "分数のかけ算" : "分数のわり算", problem ?? `${f(a)} ${multiply ? "×" : "÷"} ${f(b)} を計算しましょう。`, { kind: "six", type: "fraction", a, b, operation, unit, baseUnit }, multiply
    ? [b[1] === 1 ? `${f(a)}が${b[0]}つ分あると考えましょう。` : `${f(a)}のうち、さらに${b[1]}等分した${b[0]}つ分を考えます。`, `色の部分が、全体を何等分したうちの何個分か確かめましょう。${multiplicationGuide}${reductionGuide}`]
    : [`${f(a)}の中に、${f(b)}がいくつ分あるか考えましょう。`, b[1] === 1 ? `色の部分を${b[0]}つに同じ大きさで分けます。整数でわるときも、その逆数をかけられます。` : `わる数${f(b)}を1にするには${b[1]}/${b[0]}倍します。わられる数も同じ倍率にすると、商は変わりません。`], answer, `${f(a)} ${multiply ? "×" : "÷"} ${f(b)} ＝ ${answer}${unit}。${multiply ? multiplicationGuide + reductionGuide : "わる数の分子と分母を入れ替えた逆数をかけます。"}`, unit), answerFormat: "fraction" };
}
export const expression = (price: number, count: number | "x", extra = 0, countUnit = "こ") => ({ kind: "six", type: "expression", price, count, extra, countUnit } as const);
export const transform = (mode: "scale" | "line" | "point" | "map", width: number, height: number, factor = 1, markedPoint: "A" | "B" = "A"): Extract<SixVisual, {type:"transform"}> => ({ kind: "six", type: "transform", mode, width, height, factor, markedPoint });
const stats = (values: number[], measure: "mean" | "median" | "mode" | "frequency" | "histogram" | "compare", other?: number[]): SixVisual => ({ kind: "six", type: "stats", values, measure, other, unit: "点" });
export function median(values: number[], answer: string): UpperQuestion {
  const sorted = [...values].sort((a, b) => a - b);
  const left = sorted[Math.floor((sorted.length - 1) / 2)];
  const right = sorted[Math.floor(sorted.length / 2)];
  const even = sorted.length % 2 === 0;
  return q("中央値", `${values.length}人の得点は${values.join("、")}点です。中央値は何点ですか？`, stats(values, "median"), ["まず、得点を小さい順に並べます。", even ? "真ん中に2つ残ります。その2つの平均を求めましょう。" : "両はしから同じ個数ずつ見ると、真ん中に1つ残ります。"], answer, `小さい順に並べると ${sorted.join("、")}。 ${even ? `真ん中の${left}点と${right}点の平均を求めます。（${left}＋${right}）÷2＝${answer}点です。` : `真ん中の${answer}点が中央値です。`}`, "点");
}
export function mode(values: number[], answer: string): UpperQuestion {
  return q("最頻値", `得点は${values.join("、")}点です。最頻値は何点ですか？`, stats(values, "mode"), ["最頻値は、いちばん多く出てくる値です。", "同じ得点を隣に並べ、出てくる回数を比べましょう。"], answer, `いちばん多く出てくる得点は${answer}点なので、最頻値は${answer}点です。`, "点");
}
export function frequency(values: number[], answer: string): UpperQuestion {
  return q("度数分布", `得点は${values.join("、")}点です。20点以上30点未満の人は何人ですか？`, stats(values, "frequency"), ["度数は、その区間に入る人数や個数です。「20以上」は20を含み、「30未満」は30を含みません。", "10点ごとの区間に分け、20点から29点までに入った人を数えましょう。"], answer, `20点以上30点未満に入るのは${values.filter(v => v >= 20 && v < 30).join("、")}点の人で、${answer}人です。`, "人");
}
export const possibilities = (items: string[], ordered: boolean, answer: string) => q(ordered ? "順序よく数える" : "重なりなく数える", ordered
  ? `${items.join("・")}の${items.length}人から、委員長と副委員長を1人ずつ選びます。同じ人は兼ねられません。選び方は何通りですか？`
  : `${items.join("・")}の${items.length}人から2人組を作ります。AとB、BとAは同じ組です。何通りありますか？`, { kind: "six", type: "possibilities", items, ordered }, ordered
    ? ["まず委員長を1人に決め、副委員長にできる人へ枝を伸ばします。", "委員長を順に変えて調べます。役割が違うので、A→BとB→Aは別の選び方です。"]
    : ["まずAと組む人を調べます。次にBと組む人を調べます。", "A・Bを数えたら、B・Aは数えません。順番を逆にした同じ組を除きましょう。"], answer, `落ちや重なりなく数えると${answer}通りです。${ordered ? "役割の順序を区別します。" : "同じ2人の組は1回だけ数えます。"}`, "通り");

/** 6年生の未接続だった6章。章のマス順は学習指導要領から生成されたデータに対応。 */
export const GRADE_SIX_ADDITIONS: Record<string, UpperChapter> = {
  "sansu-6-01": { main: [
    pair(series(fraction([2,3],[1,2],"multiply","1/3"), fraction([2,5],[3,1],"multiply","6/5")), series(fraction([3,4],[2,3],"multiply","1/2"), fraction([3,8],[2,1],"multiply","3/4"))),
    pair(series(fraction([3,4],[1,2],"divide","3/2"), fraction([3,5],[3,1],"divide","1/5")), series(fraction([2,3],[1,4],"divide","8/3"), fraction([4,5],[2,1],"divide","2/5"))),
    pair({ ...q("分数の計算のきまり", "2/3 × 3/5 ＝ □ × 2/3。□に入る分数は？", { kind:"six",type:"fraction",a:[2,3],b:[3,5],operation:"multiply",swapFactors:true }, ["かける順番を入れ替えても、かけ算の答えは同じです。", "色のついた同じ分数が、左の式と右の式でどこにあるか見てみよう。"], "3/5", "かける順序を入れ替えられるので、□は3/5です。"), answerFormat:"fraction" }, { ...q("分数の計算のきまり", "3/4 × 2/5 ＝ □ × 3/4。□に入る分数は？", {kind:"six",type:"fraction",a:[3,4],b:[2,5],operation:"multiply",swapFactors:true}, ["かける順番を入れ替えて考えます。", "左と右にある同じ分数を見つけて、残りの分数を考えます。"], "2/5", "□に2/5を入れると、かける順序だけが変わった式になります。"), answerFormat:"fraction" }),
    pair(fraction([2,3],[3,4],"multiply","1/2","1m²をぬるのに2/3Lのペンキを使います。3/4m²をぬるには何L必要ですか？","L","m²"), fraction([3,5],[5,6],"multiply","1/2","1m²をぬるのに3/5Lのペンキを使います。5/6m²をぬるには何L必要ですか？","L","m²")),
  ] },
  "sansu-6-02": { main: [
    pair(q("文字に数を当てはめる", "1冊120円のノートをx冊買うと、代金は120×x円です。4冊買うと何円ですか？", expression(120,4,0,"冊"), ["xは、買う冊数を表す文字です。今回はxに4を入れます。", "1冊の代金×冊数が、全部の代金になります。"], "480", "xに4を入れて120×4＝480円です。", "円"), q("文字に数を当てはめる", "1冊90円のノートをx冊買う代金は90×x円です。5冊では何円ですか？", expression(90,5,0,"冊"), ["xに5を入れます。", "1冊の代金×冊数を計算します。"], "450", "90×5＝450円です。", "円")),
    pair({ ...q("文章を文字の式にする", "1本80円の鉛筆をx本と、50円の消しゴムを1こ買います。合計金額を表す式を書きましょう。", expression(80,"x",50,"本"), ["鉛筆は、1本80円がx本分あります。", "鉛筆の代金に、消しゴム1こ分の50円を足します。"], "80x+50", "鉛筆は80×x円。それに50円を足し、80×x＋50、または80x＋50です。"), acceptedAnswers:["80×x+50","50+80x","50+80×x"] }, { ...q("文章を文字の式にする", "1こ60円のパンをxこと、100円の飲み物を1本買います。合計金額を表す式を書きましょう。", expression(60,"x",100), ["パン1こ分にこ数をかけます。", "飲み物1本分を加えます。"], "60x+100", "60×x＋100、または60x＋100です。"), acceptedAnswers:["60×x+100","100+60x","100+60×x"] }),
  ] },
  "sansu-6-03": { main: [
    pair(series(q("拡大図", "横4cm、たて3cmの長方形を2倍に拡大します。拡大した図のたては何cmですか？", transform("scale",4,3,2), ["拡大図は、形を変えずに大きくした図です。対応する辺を同じ倍率にします。", "横だけでなく、たての辺も2倍にします。角の大きさは変わりません。"], "6", "たても2倍なので、3×2＝6cmです。", "cm"), q("縮図", "横8cm、たて6cmの長方形を1/2の縮図にします。横は何cmですか？", transform("scale",8,6,.5), ["縮図は、形を変えずに小さくした図です。", "対応する辺をどちらも1/2にします。"], "4", "8×1/2＝4cmです。", "cm")), series(q("拡大図", "横3cm、たて2cmの長方形を3倍に拡大します。たては何cmですか？", transform("scale",3,2,3), ["対応する辺の長さを同じ倍率にします。", "たても3倍です。"], "6", "2×3＝6cmです。", "cm"), q("縮図", "横12cm、たて8cmの長方形を1/4の縮図にします。横は何cmですか？", transform("scale",12,8,.25), ["対応する辺を1/4にします。", "横12cmを4等分して考えます。"], "3", "12×1/4＝3cmです。", "cm"))),
    pair(series(q("線対称", "線対称な図形で、点Aは対称の軸から3cm離れています。対応する点Bは軸から何cm離れていますか？", transform("line",3,2), ["線対称は、1本の直線で折るとぴったり重なる形です。この直線を対称の軸といいます。", "対応する点は、軸をはさんで同じ距離にあります。折って確かめましょう。"], "3", "折るとAとBが重なるので、軸からBまでも3cmです。", "cm"), q("点対称", "図の長方形ABCDを、中心Oのまわりに半回転します。点Aと重なる頂点は？ A〜Dで答えましょう。", transform("point",4,2), ["点対称は、1つの点を中心に180°回すと重なる形です。", "Aを中心の反対側まで半回転させて確かめます。"], "C", "中心Oをはさんで反対側の点Cと重なります。")), series(q("線対称", "線対称な図形の点Aは、軸から4cmの位置です。対応する点Bと軸の距離は何cm？", transform("line",4,2), ["軸で折り返します。", "対応する点と軸の距離を比べます。"], "4", "対応する点の距離は同じなので4cmです。", "cm"), q("点対称", "図の長方形ABCDを、中心Oのまわりに半回転します。点Bと重なる頂点は？", transform("point",4,2,1,"B"), ["180°回して考えます。", "中心の反対側の頂点を調べます。"], "D", "点Bは中心Oをはさんで反対の点Dと重なります。"))),
    pair(q("縮図を生活に使う", "実際の長さを1/1000にした地図で、道の長さが3cmでした。実際の道は何mですか？", transform("map",3,2,1000), ["縮尺1/1000は、地図の1cmが実際の1000cmを表すという意味です。", "地図の長さを1000倍してcmで求めてから、100でわってmに直します。"], "30", "3×1000＝3000cm。100cm＝1mなので、30mです。", "m"), q("縮図を生活に使う", "実際の長さを1/2000にした地図で、道の長さが4cmでした。実際は何mですか？", transform("map",4,2,2000), ["地図の1cmは実際の2000cmです。", "cmで求めた長さをmに直します。"], "80", "4×2000＝8000cm＝80mです。", "m")),
  ] },
};
