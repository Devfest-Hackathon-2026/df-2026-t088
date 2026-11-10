import type { LessonTarget } from "../game/logic";

export interface GradeTwoQuestion {
  title: string; problem: string; hint: string; figures: string[]; answer: string; explanation: string;
  /** 最初の図と、子どもが進める途中の図。答えそのものは表示しない。 */
  steps: { text: string; figures: string[] }[];
  visual?: { type: "ten-bundles"; groups: number; singles: number } | { type: "make-ten" } | { type: "column-add"; top: number; bottom: number }
    | { type: "place-value"; counts: number[] }
    | { type: "place-calculate"; top: number; bottom: number; operator: "+" | "−" }
    | { type: "groups"; each: number; count: number; item: string; label: string }
    | { type: "picture-table"; rows: { label: string; count: number; symbol?: string }[]; unit?: string }
    | { type: "fraction-parts"; parts: number }
    | { type: "clock-minutes" }
    | { type: "polygon"; sides: 3 | 4; square?: boolean }
    | { type: "array-compare"; each: number; rows: number };
}
export interface GradeTwoLesson { practice: GradeTwoQuestion; test: GradeTwoQuestion }
export function question(title: string, problem: string, hint: string, figures: string[], answer: string, explanation: string, steps: GradeTwoQuestion["steps"] = []): GradeTwoQuestion {
  return { title, problem, hint, figures, answer, explanation, steps };
}
export function pair(practice: GradeTwoQuestion, test: GradeTwoQuestion): GradeTwoLesson { return { practice, test }; }
export function tenBundles(item: GradeTwoQuestion, groups: number, singles: number): GradeTwoQuestion {
  return { ...item, visual: { type: "ten-bundles", groups, singles } };
}
export function columnAdd(item: GradeTwoQuestion, top: number, bottom: number): GradeTwoQuestion {
  return { ...item, visual: { type: "column-add", top, bottom } };
}

/** 各配列の順番は既存の学習マスの順番に対応する。 */
export const GRADE_TWO_LESSONS: Record<string, GradeTwoLesson[]> = {
  "sansu-2-01": [
    pair(tenBundles(question("まとめて 数えよう", "10この まとまりが 3つと、ばらが 4こ。ぜんぶで 何こ？", "10ずつ 数えてから、ばらを あわせよう。", ["［10］ ［10］ ［10］　● ● ● ●"], "34こ", "10が3つで30、あと4こで34こです。", [{text:"10この まとまりを 1つずつ 見よう。",figures:["［10］ ［10］ ［10］"]},{text:"まとまりの 数と、ばらの4こを あわせよう。",figures:["［10］ ［10］ ［10］ ＋ ● ● ● ●"]}]), 3, 4),
         tenBundles(question("まとめて 数えよう", "10この まとまりが 4つと、ばらが 2こ。ぜんぶで 何こ？", "10ずつ 数えよう。", ["［10］ ［10］ ［10］ ［10］　● ●"], "42こ", "10が4つで40、あと2こで42こです。"), 4, 2)),
    pair(question("大きい 数の くらい", "千が2こ、百が3こ、十が4こ、一が5こ。どんな 数？", "千・百・十・一の じゅんに 数字を ならべよう。", ["千［2］　百［3］　十［4］　一［5］"], "2345", "千の位から2、3、4、5を ならべて2345です。"), question("大きい 数の くらい", "千が3こ、百が2こ、十が1こ、一が4こ。どんな 数？", "大きい くらいから ならべよう。", ["千［3］　百［2］　十［1］　一［4］"], "3214", "千、百、十、一の順に ならべて3214です。")),
    pair(question("100を たんいに 見よう", "100が 6こ あつまると、いくつ？", "100を 6回 数えてみよう。", ["［100］［100］［100］", "［100］［100］［100］"], "600", "100が6こで600です。"), question("100を たんいに 見よう", "100が 8こ あつまると、いくつ？", "100ずつ 数えよう。", ["［100］が8こ"], "800", "100が8こで800です。")),
    pair(question("かけ算で 数を 見よう", "4こずつの はこが3つ。4＋4＋4を、かけ算の式にすると？", "1はこの数 × はこの数で 表そう。", ["［● ● ● ●］ ［● ● ● ●］ ［● ● ● ●］"], "4×3", "4こが3つなので、4×3と 表せます。"), question("かけ算で 数を 見よう", "5こずつの はこが2つ。かけ算の式は？", "1はこの数 × はこの数だよ。", ["［● ● ● ● ●］ ［● ● ● ● ●］"], "5×2", "5こが2つなので5×2です。")),
    pair(question("なかま分け", "赤い はなと 白い はなを 数えました。赤い はなは 何本？", "色ごとに 分けて 数えよう。", ["赤　🌷 🌷 🌷 🌷", "白　🌼 🌼 🌼"], "4ほん", "赤い はなを 数えると4本です。"), question("なかま分け", "赤い はなと 白い はなを 数えました。白い はなは 何本？", "白い はなを 数えよう。", ["赤　🌷 🌷", "白　🌼 🌼 🌼 🌼 🌼"], "5ほん", "白い はなは5本です。")),
    pair(question("分数の はじまり", "1まいの ピザを 同じ大きさに2つに分けました。1つ分は もとの 何分のいくつ？", "1まいを 何とう分したかな。", ["1まい → 同じ大きさに2つ", "［1つ分］［1つ分］"], "1/2", "1を2等分した1つ分は1/2です。"), question("分数の はじまり", "1まいを 同じ大きさに3つに分けました。1つ分は もとの 何分のいくつ？", "全体を 何とう分したかな。", ["［1つ分］［1つ分］［1つ分］"], "1/3", "1を3等分した1つ分は1/3です。")),
    pair(question("大きな数を くらべよう", "320円と 280円。大きい ほうの 数を かこう。", "百のくらいを 見よう。", ["320円　と　280円"], "320円", "320は百が3こ、280は百が2こ。320のほうが大きいです。"), question("大きな数を くらべよう", "450円と 510円。大きい ほうの 数を かこう。", "百のくらいを くらべよう。", ["450円　と　510円"], "510円", "百のくらいをくらべると510のほうが大きいです。")),
  ],
  "sansu-2-02": [
    pair(columnAdd(question("たし算の ひっ算", "27 ＋ 15 は いくつ？", "一のくらい、つぎに十のくらいを 計算しよう。", [], "42", "7＋5＝12。2を書き、10を十のくらいへ。2＋1＋1＝4で42です。"), 27, 15), columnAdd(question("たし算の ひっ算", "36 ＋ 27 は いくつ？", "一のくらいから 計算しよう。", [], "63", "6＋7＝13。10をくり上げ、十のくらいは3＋2＋1。答えは63です。"), 36, 27)),
    pair(question("3けたの 計算", "120 ＋ 30 は いくつ？", "百・十・一に 分けて 考えよう。", ["100 ＋ 20", "　　　　＋ 30"], "150", "100と、20＋30＝50を あわせて150です。"), question("3けたの 計算", "240 − 30 は いくつ？", "十のまとまりに 注目。", ["200 ＋ 40", "　　　　− 30"], "210", "40から30をひいて10。200と10で210です。")),
    pair(question("たし算の きまり", "6＋4と 4＋6。答えは 同じ？ 『おなじ』か『ちがう』で 答えよう。", "2つの式を くらべよう。", ["● ● ● ● ● ● ＋ ○ ○ ○ ○", "○ ○ ○ ○ ＋ ● ● ● ● ● ●"], "おなじ", "たす数の順番を入れかえても、和は同じです。"), question("たし算の きまり", "2＋7と 7＋2。答えは 同じ？", "じゅんばんを 入れかえて くらべよう。", ["2 ＋ 7", "7 ＋ 2"], "おなじ", "順番を入れかえても、たした数は同じです。")),
    pair(question("たし算と ひき算", "□＋5＝12。12−5は いくつ？", "12から、あとで足した5を とりのぞそう。", ["［□］ ＋ ［5］ → ［12］", "［12］ − ［5］ → □"], "7", "12から5をひくと、もとの7に もどります。"), question("たし算と ひき算", "□＋4＝12。12−4は いくつ？", "足した4を とりのぞそう。", ["［□］ ＋ ［4］ → ［12］"], "8", "12から4をひくと8です。")),
    pair({ ...question("計算を 工夫しよう", "あめが8こあります。5こもらうと、ぜんぶで何こ？", "まず10この まとまりを つくろう。", [], "13", "8に2をたすと10。のこりの3をたして13です。"), visual: { type: "make-ten" } }, question("計算を 工夫しよう", "8＋6は いくつ？", "6を分けて、先に10をつくろう。", ["8 ＋ 6"], "14", "8＋2で10、のこり4をたして14です。")),
  ],
  "sansu-2-03": [
    pair(question("かけ算の いみ", "1ふくろに あめが3こずつ。4ふくろでは 何こ？", "1ふくろ分が いくつあるかな。", ["［🍬 🍬 🍬］ ［🍬 🍬 🍬］", "［🍬 🍬 🍬］ ［🍬 🍬 🍬］"], "12こ", "3こが4ふくろ。3×4＝12こです。", [{text:"まず、1ふくろに3こ 入っているよ。",figures:["［🍬 🍬 🍬］"]},{text:"同じ ふくろが4つ。まとまりを 数えよう。",figures:["［🍬 🍬 🍬］ ［🍬 🍬 🍬］", "［🍬 🍬 🍬］ ［🍬 🍬 🍬］"]}]), question("かけ算の いみ", "1さら4こずつの いちごが、3さら。ぜんぶで 何こ？", "1さら分が 3つあるよ。", ["［🍓🍓🍓🍓］ ［🍓🍓🍓🍓］ ［🍓🍓🍓🍓］"], "12こ", "4×3＝12こです。")),
    pair(question("かけ算の 式", "1箱に5こずつ えんぴつが入り、箱が3つ。式を 書こう。", "1箱分の数 × 箱の数だよ。", ["［えんぴつ5こ］ ［えんぴつ5こ］ ［えんぴつ5こ］"], "5×3", "5こが3箱なので5×3です。"), question("かけ算の 式", "1さら2こずつの おかしが4さら。式を 書こう。", "1さらの数 × さらの数だよ。", ["［2こ］ ［2こ］ ［2こ］ ［2こ］"], "2×4", "2こが4さらなので2×4です。")),
    pair(question("かけ算の きまり", "3×4と 4×3。答えは 同じ？", "3こずつ4列と、4こずつ3列を くらべよう。", ["● ● ●", "● ● ●", "● ● ●", "● ● ●"], "おなじ", "並べ方を入れかえても全体の数は同じです。"), question("かけ算の きまり", "2×5と 5×2。答えは 同じ？", "2つの式を くらべよう。", ["2 × 5", "5 × 2"], "おなじ", "かける数を入れかえても答えは同じです。")),
    pair(question("九九を 使おう", "6 × 7 は いくつ？", "6のだんの九九を 思い出そう。", ["6が 7つ分"], "42", "6のだんの『しち』は42です。"), question("九九を 使おう", "7 × 8 は いくつ？", "7のだんの九九を 思い出そう。", ["7が 8つ分"], "56", "7×8＝56です。")),
    pair(question("大きい数の かけ算", "12 × 3 は いくつ？", "12を10と2に 分けよう。", ["［10と2］ ［10と2］ ［10と2］"], "36", "10×3＝30、2×3＝6。あわせて36です。"), question("大きい数の かけ算", "11 × 4 は いくつ？", "11を10と1に 分けよう。", ["［10と1］が4つ"], "44", "10×4＝40、1×4＝4。あわせて44です。")),
    pair(question("かけ算を 工夫", "5 × 6 は いくつ？", "5×5に、もう1つ分の5を たして考えよう。", [], "30", "5×5＝25、あと5をたして30です。"), question("かけ算を 工夫", "4 × 6 は いくつ？", "4×5に、もう1つ分の4を たして考えよう。", [], "24", "4×5＝20、あと4をたして24です。")),
    pair(question("かけ算を 生活に", "1人に 2まいずつ カードをくばります。5人では 何まい？", "1人分 × 人数で 考えよう。", ["［2まい］ ［2まい］ ［2まい］ ［2まい］ ［2まい］"], "10まい", "2×5＝10まいです。"), question("かけ算を 生活に", "1人に 3まいずつ。4人では 何まい？", "1人分と 人数に 注目。", ["［3まい］ ［3まい］ ［3まい］ ［3まい］"], "12まい", "3×4＝12まいです。")),
  ],
  "sansu-2-04": [
    pair(question("かたちの 名前", "3本の まっすぐな 辺で かこまれた形の 名前は？", "辺の数を かぞえよう。", ["△"], "さんかくけい", "3本の辺でかこまれた形は三角形です。"), question("かたちの 名前", "4本の まっすぐな 辺で かこまれた形の 名前は？", "辺の数を かぞえよう。", ["□"], "しかくけい", "4本の辺でかこまれた形は四角形です。")),
    pair(question("辺と角を 見よう", "4つの辺が みんな同じ長さで、4つの角が直角の四角形の名前は？", "辺の長さと角に 注目しよう。", ["□　4つの辺が 同じ長さ"], "せいほうけい", "4辺が等しく、4つの角が直角の四角形は正方形です。"), question("辺と角を 見よう", "4つの角が直角で、向かい合う辺の長さが同じ四角形を何という？", "かどの形に 注目。", ["▭"], "ちょうほうけい", "4つの角が直角の四角形は長方形です。")),
    pair(question("箱の かたち", "箱の形は、いくつの平らな面で できているかな？", "上・下・前・後ろ・右・左を 数えよう。", ["📦　上・下・前・後ろ・右・左"], "6めん", "箱には上・下・前・後ろ・右・左の6つの面があります。"), question("箱の かたち", "箱の面には、平らな面と丸い面の どちらがある？", "箱の表面を そうぞうしよう。", ["📦"], "たいら", "箱の形は平らな面でできています。")),
    pair(question("図形を つくろう", "同じ直角三角形を2まい、長い辺どうしで合わせて四角形を作ります。辺は何本？", "できる四角形の まわりを 数えよう。", ["◢　◤ → □"], "4ほん", "四角形の辺は4本です。"), question("図形を つくろう", "三角形の 角は いくつ？", "かどを ひとつずつ 数えよう。", ["△"], "3こ", "三角形の角は3つです。")),
  ],
  "sansu-2-05": [
    pair(question("長さの たんい", "1 m は 何 cm？", "1 mに 1 cmが いくつ入るか 考えよう。", ["1 m ＝ □ cm"], "100cm", "1 mは100 cmです。"), question("長さの たんい", "1 cm は 何 mm？", "1 cmの中の小さな目もりを 数えよう。", ["1 cm ＝ □ mm"], "10mm", "1 cmは10 mmです。")),
    pair(question("ものさしで はかろう", "ものさしに 合わせた えんぴつの 長さは何 cm？", "はじめの0から はしまでの 目もりを 見よう。", ["ものさしを 見て、えんぴつの はしの 目もりを 読もう。"], "7cm", "0から7の目もりまでなので7 cmです。"), question("かさを はかろう", "1 Lは 何 dL？", "1 Lに 1 dLが いくつ入るか 考えよう。", ["1 L ＝ □ dL"], "10dL", "1 Lは10 dLです。")),
    pair(question("長さを くらべよう", "赤いテープは1 m、青いテープは90 cm。どちらが長い？", "1 mをcmに直して くらべよう。", ["赤 1 m", "青 90 cm"], "あか", "1 m＝100 cmなので、赤が長いです。"), question("かさを くらべよう", "Aは1 L、Bは8 dL。どちらが多い？", "1 LをdLに 直そう。", ["A　1 L", "B　8 dL"], "a", "1 Lは10 dL。10 dLは8 dLより多いのでAです。")),
  ],
  "sansu-2-06": [
    pair(question("時間の たんい", "1時間は 何分？", "とけいの 長いはりが1周する時間だよ。", ["1時間 ＝ □分"], "60ふん", "1時間は60分です。"), question("時間の たんい", "1日は 何時間？", "1日の時間を 思い出そう。", ["1日 ＝ □時間"], "24じかん", "1日は24時間です。")),
    pair(question("時こくと 時間", "3時に出発して、4時に着きました。何時間かかった？", "出発から着くまでの 時間を 数えよう。", ["3時 ─────→ 4時"], "1じかん", "3時から4時までで1時間です。"), question("時こくと 時間", "2時から4時まで 本を読みました。何時間？", "2時から3時、3時から4時を 数えよう。", ["2時 → 3時 → 4時"], "2じかん", "1時間が2つ分なので2時間です。")),
  ],
  "sansu-2-07": [
    pair(question("表を よもう", "すきな果物を調べました。みかんは 何人？", "表の『みかん』の行を 見よう。", ["りんご　● ● ●", "みかん　● ● ● ● ●"], "5にん", "みかんは●が5つなので5人です。"), question("表を よもう", "すきな遊びを調べました。なわとびは 何人？", "『なわとび』の行を 数えよう。", ["おにごっこ　● ● ● ●", "なわとび　　● ● ●"], "3にん", "なわとびは3人です。")),
    pair(question("表から 考えよう", "りんごは4人、みかんは2人。りんごは 何人多い？", "1人ずつ 対応させて、あまりを 数えよう。", ["りんご　● ● ● ●", "みかん　● ●"], "2にん", "4−2＝2。りんごは2人多いです。"), question("表から 考えよう", "犬が5人、猫が3人。犬は何人多い？", "5から3をひこう。", ["犬　● ● ● ● ●", "猫　● ● ●"], "2にん", "5−3＝2人です。")),
  ],
};

// 図は問題とまとめでそれぞれの数量を指定する。合計や答えは表示しない。
type Visual = NonNullable<GradeTwoQuestion["visual"]>;
const visuals: [string, number, Visual, Visual][] = [
  ["sansu-2-01", 1, { type: "place-value", counts: [2, 3, 4, 5] }, { type: "place-value", counts: [3, 2, 1, 4] }],
  ["sansu-2-01", 3, { type: "groups", each: 4, count: 3, item: "●", label: "はこ" }, { type: "groups", each: 5, count: 2, item: "●", label: "はこ" }],
  ["sansu-2-01", 4, { type: "picture-table", unit: "本", rows: [{ label: "赤", count: 4, symbol: "🌷" }, { label: "白", count: 3, symbol: "🌼" }] }, { type: "picture-table", unit: "本", rows: [{ label: "赤", count: 2, symbol: "🌷" }, { label: "白", count: 5, symbol: "🌼" }] }],
  ["sansu-2-01", 5, { type: "fraction-parts", parts: 2 }, { type: "fraction-parts", parts: 3 }],
  ["sansu-2-02", 1, { type: "place-calculate", top: 120, bottom: 30, operator: "+" }, { type: "place-calculate", top: 240, bottom: 30, operator: "−" }],
  ["sansu-2-03", 0, { type: "groups", each: 3, count: 4, item: "🍬", label: "ふくろ" }, { type: "groups", each: 4, count: 3, item: "🍓", label: "さら" }],
  ["sansu-2-03", 1, { type: "groups", each: 5, count: 3, item: "✏️", label: "はこ" }, { type: "groups", each: 2, count: 4, item: "🍪", label: "さら" }],
  ["sansu-2-03", 2, { type: "array-compare", each: 3, rows: 4 }, { type: "array-compare", each: 2, rows: 5 }],
  ["sansu-2-03", 5, { type: "groups", each: 5, count: 6, item: "●", label: "まとまり" }, { type: "groups", each: 4, count: 6, item: "●", label: "まとまり" }],
  ["sansu-2-03", 6, { type: "groups", each: 2, count: 5, item: "▣", label: "人" }, { type: "groups", each: 3, count: 4, item: "▣", label: "人" }],
  ["sansu-2-04", 0, { type: "polygon", sides: 3 }, { type: "polygon", sides: 4 }],
  ["sansu-2-04", 1, { type: "polygon", sides: 4, square: true }, { type: "polygon", sides: 4 }],
  ["sansu-2-07", 0, { type: "picture-table", rows: [{ label: "りんご", count: 3 }, { label: "みかん", count: 5 }] }, { type: "picture-table", rows: [{ label: "おにごっこ", count: 4 }, { label: "なわとび", count: 3 }] }],
  ["sansu-2-07", 1, { type: "picture-table", rows: [{ label: "りんご", count: 4 }, { label: "みかん", count: 2 }] }, { type: "picture-table", rows: [{ label: "犬", count: 5 }, { label: "猫", count: 3 }] }],
];
for (const [chapter, index, practice, test] of visuals) {
  GRADE_TWO_LESSONS[chapter][index].practice.visual = practice;
  GRADE_TWO_LESSONS[chapter][index].test.visual = test;
}

GRADE_TWO_LESSONS["sansu-2-06"][0].practice.visual = { type: "clock-minutes" };

export function findGradeTwo(chapterId: string, target: LessonTarget): GradeTwoLesson | undefined {
  const items = GRADE_TWO_LESSONS[chapterId];
  if (!items) return undefined;
  if (target.kind === "test") return items[0];
  return target.kind === "main" ? items[target.index] : undefined;
}
export function gradeTwoSummary(chapterId: string): GradeTwoQuestion[] {
  return (GRADE_TWO_LESSONS[chapterId] ?? []).map((item) => item.test);
}
export function hasGradeTwo(chapterId: string): boolean { return Object.hasOwn(GRADE_TWO_LESSONS, chapterId); }
