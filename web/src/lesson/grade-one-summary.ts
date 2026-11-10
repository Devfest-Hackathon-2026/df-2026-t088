import type { GradeOneTopic } from "./grade-one";

export interface GradeOneQuestion {
  title: string;
  problem: string;
  clue: string;
  diagram: string[];
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

/** 章末では練習と違う数や場面で、同じ考え方を使えるか確かめる。 */
export const GRADE_ONE_SUMMARY: Record<GradeOneTopic, GradeOneQuestion> = {
  compare: { title: "かずを くらべよう", problem: "りんごが4こ、みかんが5こ。どちらが おおい？", clue: "1こずつ ペアにして くらべよう。", diagram: ["🍎 🍎 🍎 🍎", "🍊 🍊 🍊 🍊 🍊"], question: "どちらが おおい？", options: ["みかん"], correct: 0, explanation: "りんごは4こ、みかんは5こ。みかんが1こ おおいです。" },
  count: { title: "かずを かぞえよう", problem: "ほしは なんこ あるかな？", clue: "ひとつずつ かぞえよう。", diagram: ["⭐ ⭐ ⭐", "⭐ ⭐ ⭐"], question: "なんこ？", options: ["6こ"], correct: 0, explanation: "3こと3こを あわせて6こです。" },
  order: { title: "かずの じゅんばん", problem: "6、7、□、9。□に はいる かずは？", clue: "1ずつ ふえる じゅんばんだよ。", diagram: ["6 → 7 → □ → 9"], question: "□は いくつ？", options: ["8"], correct: 0, explanation: "7の つぎは8、8の つぎは9です。" },
  compose: { title: "かずを わけよう", problem: "8こを 5こと □こに わけます。□は なんこ？", clue: "5この あとを かぞえよう。", diagram: ["● ● ● ● ● ｜ ● ● ●"], question: "□は なんこ？", options: ["3こ"], correct: 0, explanation: "8は5と3に わけられます。" },
  tens: { title: "10の まとまり", problem: "10この たばが1つと、ばらが7こ。ぜんぶで なんこ？", clue: "10と ばらを あわせよう。", diagram: ["［10］ ＋ ● ● ● ● ● ● ●"], question: "なんこ？", options: ["17こ"], correct: 0, explanation: "10と7で17こです。" },
  hundred: { title: "100より おおきい かず", problem: "100この はこと10この たばが1つずつ。ぜんぶで なんこ？", clue: "100に10を あわせよう。", diagram: ["［100こ］ ＋ ［10こ］"], question: "なんこ？", options: ["110こ"], correct: 0, explanation: "100と10を あわせて110こです。" },
  "tens-unit": { title: "10ずつ かぞえよう", problem: "10この たばが4つ。ぜんぶで なんこ？", clue: "10ずつ じゅんに かぞえよう。", diagram: ["［10］ ［10］ ［10］ ［10］"], question: "なんこ？", options: ["40こ"], correct: 0, explanation: "10、20、30、40。10が4つで40です。" },
  groups: { title: "おなじかずに わけよう", problem: "あめ8こを 2にんに おなじかずずつ わけます。ひとり なんこ？", clue: "1こずつ じゅんばんに わけよう。", diagram: ["🍬 🍬 🍬 🍬 🍬 🍬 🍬 🍬", "ひとりめ　□　　ふたりめ　□"], question: "ひとり なんこ？", options: ["4こ"], correct: 0, explanation: "8こを おなじかずずつ わけると、ひとり4こです。" },
  "compare-groups": { title: "まとまりで かぞえよう", problem: "10この たばが3つと、ばらが6こ。ぜんぶで なんこ？", clue: "たばを 10ずつ かぞえよう。", diagram: ["［10］ ［10］ ［10］ ＋ ● ● ● ● ● ●"], question: "なんこ？", options: ["36こ"], correct: 0, explanation: "10が3つで30、あと6こで36です。" },
  addition: { title: "たしざん", problem: "りんごが4こ あります。3こ もらうと、ぜんぶで なんこ？", clue: "もらった かずを あわせよう。", diagram: ["🍎 🍎 🍎 🍎", "🍎 🍎 🍎"], question: "なんこ？", options: ["7こ"], correct: 0, explanation: "4＋3＝7。ぜんぶで7こです。" },
  subtraction: { title: "ひきざん", problem: "あめが8こ あります。3こ たべると、のこりは なんこ？", clue: "たべた かずを とりのぞこう。", diagram: ["🍬 🍬 🍬 🍬 🍬 🍬 🍬 🍬"], question: "なんこ？", options: ["5こ"], correct: 0, explanation: "8−3＝5。のこりは5こです。" },
  carry: { title: "くりあがり", problem: "9 ＋ 4は いくつ？", clue: "9に いくつ たすと10に なるかな？", diagram: ["● ● ● ● ● ● ● ● ● ＋ ● ● ● ●"], question: "こたえは？", options: ["13"], correct: 0, explanation: "4を1と3にわけ、9＋1＝10。10＋3＝13です。" },
  "two-digit": { title: "おおきい かずの けいさん", problem: "20 ＋ 7は いくつ？", clue: "10の まとまりと ばらを あわせよう。", diagram: ["［10］ ［10］ ＋ ● ● ● ● ● ● ●"], question: "こたえは？", options: ["27"], correct: 0, explanation: "20と7で27です。" },
  borrow: { title: "くりさがり", problem: "12こから 4こ とると、のこりは？", clue: "12を10と2に わけて かんがえよう。", diagram: ["［10］ ＋ ● ●"], question: "なんこ？", options: ["8こ"], correct: 0, explanation: "10−4＝6、6＋2＝8。のこりは8こです。" },
  shape: { title: "かたちを くらべよう", problem: "うえに つみかさねやすい ものは、ボールと はこの どちら？", clue: "たいらな めんが あるかを かんがえよう。", diagram: ["⚽ ボール　　📦 はこ"], question: "どちら？", options: ["はこ"], correct: 0, explanation: "はこは たいらな めんがあり、つみかさねやすいです。" },
  "shape-build": { title: "かたちを つくろう", problem: "おなじ しかくを2まい、よこに すきまなく ならべると、そとの かどは いくつ？", clue: "ふたつを あわせた そとがわの かどを かぞえよう。", diagram: ["□ □"], question: "かどは いくつ？", options: ["4こ"], correct: 0, explanation: "あわせた かたちの そとの かどは4こです。" },
  position: { title: "みぎと ひだり", problem: "えを みている ひとから みて、いぬの ひだりに いるのは？", clue: "えの ひだりがわを みよう。", diagram: ["🐱　🐶　🐰"], question: "いぬの ひだりは？", options: ["ねこ"], correct: 0, explanation: "いぬの ひだりは ねこです。" },
  "shape-parts": { title: "つみきの ならび", problem: "つみき2こを、うえと したに ならべます。なんと いう ならび？", clue: "うえと したの むきの なまえだよ。", diagram: ["🟦", "🟦"], question: "なんと いう ならび？", options: ["たて"], correct: 0, explanation: "うえと したに ならべるのは、たての ならびです。" },
  length: { title: "ながさを くらべよう", problem: "あかい テープと あおい テープ。どちらが みじかい？", clue: "はしを そろえて くらべよう。", diagram: ["あかい テープ", "あおい テープ"], question: "どちらが みじかい？", options: ["あお"], correct: 0, explanation: "はしを そろえると、あおい テープの ほうが みじかいです。" },
  measure: { title: "いくつぶんの ながさ", problem: "えんぴつは おなじ ながさの ブロック なんこぶん？", clue: "はしから すきまなく ならべて みよう。", diagram: ["えんぴつ", "ブロック"], question: "なんこぶん？", options: ["3こぶん"], correct: 0, explanation: "えんぴつは おなじ ブロック3こぶんです。" },
  volume: { title: "みずの かさ", problem: "おなじ コップに いっぱいずつ いれると、Aは2はい、Bは4はい。どちらが おおい？", clue: "コップの はいすうを くらべよう。", diagram: ["A　🥛 🥛", "B　🥛 🥛 🥛 🥛"], question: "どちら？", options: ["B"], correct: 0, explanation: "Bは4はいで、Aの2はいより おおいです。" },
  clock: { title: "とけいを よもう", problem: "とけいを みよう。なんじかな？", clue: "ながい はりと みじかい はりを みよう。", diagram: ["🕗"], question: "なんじ？", options: ["8じ"], correct: 0, explanation: "ながい はりが12、みじかい はりが8なので8じです。" },
  "daily-time": { title: "とけいと せいかつ", problem: "ほんを よみはじめる ときの とけいです。なんじかな？", clue: "みじかい はりの さきの かずを みよう。", diagram: ["🕒"], question: "なんじ？", options: ["3じ"], correct: 0, explanation: "ながい はりが12、みじかい はりが3なので3じです。" },
  chart: { title: "えを よみとろう", problem: "すきな くだものを しらべました。どちらが おおい？", clue: "●ひとつが ひとりぶんです。", diagram: ["りんご　● ● ●", "みかん　● ● ● ● ●"], question: "どちらが おおい？", options: ["みかん"], correct: 0, explanation: "りんごは3にん、みかんは5にん。みかんが おおいです。" },
  "chart-read": { title: "ずを くらべよう", problem: "おにごっこは、なわとびより なんにん おおい？", clue: "●を ひとつずつ ペアにして、あまりを かぞえよう。", diagram: ["おにごっこ　● ● ● ● ●", "なわとび　　● ● ●"], question: "なんにん おおい？", options: ["2にん"], correct: 0, explanation: "5にんと3にんを くらべると、2にん おおいです。" },
};
