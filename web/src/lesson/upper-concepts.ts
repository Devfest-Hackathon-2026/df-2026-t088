import { gradeSixConcept } from "./grade-six-concepts";
import type { UpperVisual } from "./upper-math";

export interface ConceptScene { text: string; visual: UpperVisual; step: number; formula?: string; definition?: string }
export interface Concept { name: string; scenes: ConceptScene[] }
const objects = (count: number, size: number): UpperVisual => ({ kind: "collection", count, size });
const lists = (a: string, av: number[], b: string, bv: number[]): UpperVisual => ({ kind: "number-lists", rows: [{ label: a, values: av }, { label: b, values: bv }] });
const line = (value: number, low: number, high: number): UpperVisual => ({ kind: "number-lines", lines: [{ value, low, high }] });
const tape = (whole: number, part: number, label: string, showPercent = true): UpperVisual => ({ kind: "part-whole", whole, part, unit: "こ", partLabel: label, showPercent });
const table = (xLabel: string, yLabel: string, xs: number[], ys: number[], operation: "multiply" | "divide", factor: number, increment?: string): UpperVisual => ({ kind: "function-table", xLabel, yLabel, xs, ys, operation, factor, increment });
const box: UpperVisual = { kind: "volume", width: 1, height: 1, depth: 1, unit: "cm" };
const metreBox: UpperVisual = { kind: "volume", width: 1, height: 1, depth: 1, unit: "m" };
const square: UpperVisual = { kind: "rectangles", rectangles: [{ width: 1, height: 1 }] };

const divisor: Concept = { name: "約数", scenes: [
  { text: "あめが6こあります。2こずつ分けてみましょう。", visual: objects(6, 2), step: -1 },
  { text: "2こずつにすると、3組できて、あまりはありません。", visual: objects(6, 2), step: 0, formula: "6 ÷ 2 ＝ 3 あまり 0", definition: "あまりなく割り切れる数を約数といいます。6をあまりなく割れる2は、6の約数です。" },
  { text: "次は同じ6こを、4こずつ分けてみましょう。", visual: objects(6, 4), step: -1 },
  { text: "4こずつにすると、1組できて2こあまります。", visual: objects(6, 4), step: 0, formula: "6 ÷ 4 ＝ 1 あまり 2", definition: "あまりが出る4は、6の約数ではありません。" },
] };
const multiple: Concept = { name: "倍数", scenes: [
  { text: "2このまとまりを3つ作ります。", visual: objects(6, 2), step: -1 },
  { text: "2こずつの3組で、2を3倍した数になります。", visual: objects(6, 2), step: 0, formula: "2 ＋ 2 ＋ 2 ＝ 2 × 3 ＝ 6", definition: "2を1倍、2倍、3倍…してできる2、4、6…を、2の倍数といいます。" },
] };
const commonDivisor: Concept = { name: "最大公約数", scenes: [
  { text: "8と10を、それぞれあまりなく割れる数を並べます。", visual: lists("8の約数", [1, 2, 4, 8], "10の約数", [1, 2, 5, 10]), step: 0 },
  { text: "両方にある数は1と2です。", visual: lists("8の約数", [1, 2, 4, 8], "10の約数", [1, 2, 5, 10]), step: 1, definition: "共通する約数を公約数、その中でいちばん大きい数を最大公約数といいます。この例では2です。" },
] };
const commonMultiple: Concept = { name: "最小公倍数", scenes: [
  { text: "3と4を、それぞれ1倍、2倍、3倍…して並べます。", visual: lists("3の倍数", [3, 6, 9, 12, 15, 18, 21, 24], "4の倍数", [4, 8, 12, 16, 20, 24, 28, 32]), step: 0 },
  { text: "12も24も、両方にある数です。", visual: lists("3の倍数", [3, 6, 9, 12, 15, 18, 21, 24], "4の倍数", [4, 8, 12, 16, 20, 24, 28, 32]), step: 1, definition: "共通する倍数を公倍数、その中でいちばん小さい数を最小公倍数といいます。この例では12です。" },
] };
const approximate: Concept = { name: "概数と四捨五入", scenes: [
  { text: "23は20と30の間にあります。20に近いか、30に近いか見てみましょう。", visual: line(23, 20, 30), step: -1 },
  { text: "真ん中は25。23は20に近いので、およそ20です。", visual: line(23, 20, 30), step: 0, definition: "このように、およその大きさを表した数を概数といいます。" },
  { text: "十の位までにするときは、一の位を見ます。23の一の位は3です。", visual: line(23, 20, 30), step: 0, formula: "23 → 20", definition: "0〜4は切り捨て、5〜9はくり上げる方法を四捨五入といいます。" },
] };
const fractionOfWhole: Concept = { name: "割合", scenes: [
  { text: "ビー玉が全部で8こ。そのうち赤は4こです。", visual: tape(8, 4, "赤 4こ", false), step: -1 },
  { text: "全部をもとにして、赤がどれくらいか考えます。", visual: tape(8, 4, "赤 4こ", false), step: 0, formula: "赤 4 ÷ 全部 8 ＝ 0.5", definition: "もとにする量に対して、比べる量がどれくらいかを割合といいます。" },
] };
const percent: Concept = { name: "百分率", scenes: [
  { text: "10このうち赤が2こ。全部を1とすると、赤の割合は0.2です。", visual: tape(10, 2, "赤 2こ", false), step: -1, formula: "2 ÷ 10 ＝ 0.2" },
  { text: "全部を100％とすると、赤の部分は20％と表せます。", visual: tape(10, 2, "赤 2こ"), step: 0, formula: "0.2 × 100 ＝ 20％", definition: "全体を100として表す割合を百分率といいます。" },
] };
const wari: Concept = { name: "歩合", scenes: [
  { text: "全体を10等分して、その2つ分を考えます。", visual: { kind: "part-whole", whole: 10, part: 2, unit: "等分", partLabel: "2つ分" }, step: 0 },
  { text: "1つ分が1割。2つ分は2割です。全体を100％とすると2割は20％です。", visual: { kind: "part-whole", whole: 10, part: 2, unit: "等分", partLabel: "2割" }, step: 0, formula: "1割 ＝ 10％", definition: "割合を「割」などを使って表す方法を歩合といいます。" },
] };
const unitAmount: Concept = { name: "1あたりの量", scenes: [
  { text: "えんぴつ12本を3人に同じ数ずつ分けます。", visual: { kind: "split-bars", rows: [{ label: "えんぴつ", total: 12, parts: 3, unit: "本" }] }, step: -1 },
  { text: "全体を3人に同じ数ずつ分けると、1人分は4本です。", visual: { kind: "split-bars", rows: [{ label: "えんぴつ", total: 12, parts: 3, unit: "本" }] }, step: 0, formula: "12 ÷ 3 ＝ 4", definition: "同じ量ずつのときは、全体の量を人数や個数でわると、1あたりの量が分かります。" },
] };
const proportion: Concept = { name: "比例", scenes: [
  { text: "1袋にあめが2こずつ。袋の数を増やすと、あめの数も増えます。", visual: table("袋の数", "あめの数", [1, 2, 3], [2, 4, 6], "multiply", 2, "+2こ"), step: -1 },
  { text: "袋が2倍、3倍になると、あめの数も2倍、3倍になります。", visual: table("袋の数", "あめの数", [1, 2, 3], [2, 4, 6], "multiply", 2, "+2こ"), step: 0, definition: "一方が2倍、3倍…になると、もう一方も2倍、3倍…になる関係を比例といいます。" },
] };
const inverse: Concept = { name: "反比例", scenes: [
  { text: "あめ20こを、人数に合わせて同じ数ずつ分けます。", visual: table("人数", "1人分", [1, 2, 4, 5], [20, 10, 5, 4], "divide", 20), step: -1 },
  { text: "人数が1人から2人に2倍になると、1人分は20こから10こに半分になります。", visual: table("人数", "1人分", [1, 2, 4, 5], [20, 10, 5, 4], "divide", 20), step: 0, definition: "一方が2倍、3倍…になると、もう一方が1/2、1/3…になる関係を反比例といいます。" },
] };
const rate: Concept = { name: "時速", scenes: [
  { text: "同じ速さで、1時間に3km歩く人がいます。", visual: table("時間（時間）", "道のり（km）", [1, 2, 3], [3, 6, 9], "multiply", 3, "+3km"), step: -1 },
  { text: "1時間ごとに3kmずつ進むので、2時間では6km、3時間では9km進みます。", visual: table("時間（時間）", "道のり（km）", [1, 2, 3], [3, 6, 9], "multiply", 3, "+3km"), step: 0, definition: "時速3kmは、1時間に3km進む速さという意味です。" },
] };
const ratio: Concept = { name: "比", scenes: [
  { text: "赤い水200mLと青い水300mLを比べます。", visual: { kind: "ratio", values: [200, 300], labels: ["赤", "青"], unit: "mL" }, step: 0 },
  { text: "どちらも100mLずつに分けると、赤は2つ分、青は3つ分です。", visual: { kind: "ratio", values: [200, 300], labels: ["赤", "青"], unit: "mL" }, step: 1, formula: "赤 : 青 ＝ 2 : 3", definition: "2つの量の関係を、順序を決めて2 : 3のように表したものを比といいます。" },
] };
const areaUnit: Concept = { name: "面積の単位", scenes: [
  { text: "1辺が1cmの正方形を考えます。", visual: square, step: -1 },
  { text: "この正方形1まいを、面積を数える1つ分にします。", visual: square, step: 1, definition: "1辺が1cmの正方形の面積を1cm²といいます。" },
] };
const volumeUnit: Concept = { name: "体積の単位", scenes: [
  { text: "たて・横・高さがそれぞれ1cmの立方体を考えます。", visual: box, step: -1 },
  { text: "この小さな立方体1こを、体積を数える1つ分にします。", visual: box, step: 0, definition: "1辺が1cmの立方体の体積を1cm³といいます。" },
] };
const metreVolume: Concept = { name: "m³", scenes: [
  { text: "たて・横・高さがそれぞれ1mの立方体を考えます。", visual: metreBox, step: -1 },
  { text: "この立方体1こを、大きな体積を数える1つ分にします。", visual: metreBox, step: 0, definition: "1辺が1mの立方体の体積を1m³といいます。" },
] };
const largeUnit = (small: string, big: string): Concept => ({ name: `${big}のまとまり`, scenes: [
  { text: `${small}を10こ集めることを考えます。`, visual: { kind: "bundles", groups: [{ label: small, count: 10 }] }, step: 0 },
  { text: `${small}が10こ集まると、${big}のまとまりになります。`, visual: { kind: "bundles", groups: [{ label: small, count: 10 }, { label: big, count: 1 }] }, step: 1, formula: `${small} × 10 ＝ ${big}` },
] });
const areaParts = (shape: "parallelogram" | "triangle" | "trapezoid"): Concept => ({ name: shape === "trapezoid" ? "上底・下底と高さ" : "底辺と高さ", scenes: [
  { text: shape === "trapezoid" ? "平行な2つの辺を、上底と下底として見ます。" : "面積を考えるとき、まず基準にする辺を底辺とします。", visual: { kind: "area-parts", shape }, step: 0 },
  { text: "高さは、底辺から向かい側までの、底辺に垂直な長さです。斜めの辺の長さとは限りません。", visual: { kind: "area-parts", shape }, step: 1, definition: "高さは、底辺に垂直にはかった長さです。" },
] });
const diagonals: Concept = { name: "対角線", scenes: [
  { text: "向かい合う2つの頂点を直線で結びます。", visual: { kind: "area-parts", shape: "rhombus" }, step: 0 },
  { text: "もう一組の向かい合う頂点も結びます。ひし形には2本の対角線があります。", visual: { kind: "area-parts", shape: "rhombus" }, step: 1, definition: "多角形で、となり合わない2つの頂点を結ぶ線を対角線といいます。" },
] };
const circleConcept: Concept = { name: "半径・直径・円周率", scenes: [
  { text: "円の中心から端までの長さを半径といいます。", visual: { kind: "circle-parts" }, step: 0 },
  { text: "中心を通って端から端まで結んだ長さが直径、円のまわりの長さが円周です。", visual: { kind: "circle-parts" }, step: 1, definition: "円周を直径でわった数を円周率といい、計算では約3.14を使います。" },
] };
const prismConcept = (shape: "triangle" | "cylinder"): Concept => ({ name: shape === "triangle" ? "角柱の底面と高さ" : "円柱の底面と高さ", scenes: [
  { text: "柱の上と下には、形も大きさも同じ面があります。この面を底面といいます。", visual: { kind: "prism", shape, baseArea: 3, height: 2 }, step: -1 },
  { text: "高さは2つの底面の間の、垂直な長さです。同じ底面の層が高さの分だけ続きます。", visual: { kind: "prism", shape, baseArea: 3, height: 2 }, step: 1, definition: "角柱や円柱の体積は、底面積×高さで求められます。" },
] });

/** 学習で初めて使う言葉を、実際の問題とは別の例で説明する。章末テストでは使わない。 */
export const UPPER_CONCEPTS: Record<string, Concept> = {
  "約数": divisor, "倍数": multiple, "最大公約数": commonDivisor, "最小公倍数": commonMultiple,
  "およその数": approximate,
  "割合を小数で表す": fractionOfWhole, "百分率": percent,
  "比例": proportion, "比例の関係": proportion, "反比例の関係": inverse,
  "時速の意味": rate, "比で表そう": ratio,
  "1人分の量": unitAmount, "歩合": wari,
  "面積の単位": areaUnit, "体積の単位": volumeUnit,
  "大きな数のまとまり": largeUnit("1000", "1万"), "億のまとまり": largeUnit("1000万", "1億"), "大きな体積の単位": metreVolume,
  "平行四辺形の面積": areaParts("parallelogram"), "三角形の面積": areaParts("triangle"), "台形の面積": areaParts("trapezoid"), "ひし形の面積": diagonals,
  "角柱の体積": prismConcept("triangle"), "円柱の体積": prismConcept("cylinder"),
  "円の面積": circleConcept,
};

const average: Concept = { name: "平均", scenes: [
  { text: "3つの箱に、積み木が2こ、5こ、8こ入っています。同じ数ずつにできるかな？", visual: { kind: "bars", values: [2, 5, 8], labels: ["箱A", "箱B", "箱C"], unit: "こ" }, step: -1 },
  { text: "まず、3つの箱の積み木を合わせます。", visual: { kind: "bars", values: [2, 5, 8], labels: ["箱A", "箱B", "箱C"], unit: "こ" }, step: 0, formula: "2 ＋ 5 ＋ 8 ＝ 15" },
  { text: "15こを3つの箱に同じ数ずつ分けると、1箱5こです。", visual: { kind: "bars", values: [2, 5, 8], labels: ["箱A", "箱B", "箱C"], unit: "こ" }, step: 1, formula: "15 ÷ 3 ＝ 5", definition: "いくつかの量を同じ大きさにならした量を平均といいます。平均は、合計÷個数で求めます。" },
] };
const rectangle: Concept = { name: "長方形の面積", scenes: [
  { text: "横3cm、たて2cmの長方形です。中に1cm²の正方形が何まい入るか考えます。", visual: { kind: "rectangles", rectangles: [{ width: 3, height: 2 }] }, step: -1 },
  { text: "横1列には3まい入ります。まず1列に注目しましょう。", visual: { kind: "rectangles", rectangles: [{ width: 3, height: 2 }] }, step: 0 },
  { text: "3まいの列が2列あります。1つ分の数×いくつ分で数えられます。", visual: { kind: "rectangles", rectangles: [{ width: 3, height: 2 }] }, step: 1, formula: "3 × 2 ＝ 6cm²", definition: "長方形の面積は、横×たてで求められます。" },
] };

/** 応用や練習でも、同じ考え方の説明へ戻れるようにする。 */
export function conceptFor(question: { title: string; visual: UpperVisual }): Concept | undefined {
  if (UPPER_CONCEPTS[question.title]) return UPPER_CONCEPTS[question.title];
  switch (question.visual.kind) {
    case "six": return gradeSixConcept(question.visual);
    case "bars": return average;
    case "rectangles": return rectangle;
    case "volume": return question.visual.unit === "m" ? metreVolume : volumeUnit;
    case "number-lines": return approximate;
    case "split-bars": return unitAmount;
    case "ratio": return ratio;
    case "circle-area": return circleConcept;
    case "area-shape": return question.visual.shape === "rhombus" ? diagonals : areaParts(question.visual.shape);
    case "prism": return prismConcept(question.visual.shape);
    case "function-table": return question.visual.operation === "divide" ? inverse : proportion;
    case "part-whole": return percent;
    case "number-lists": return question.visual.rows[0].label.includes("倍数") ? commonMultiple : commonDivisor;
    case "collection": return question.title === "偶数と奇数" ? undefined : divisor;
    default: return undefined;
  }
}
