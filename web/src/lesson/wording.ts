// 学習の画面の文。正本は docs/design/ui/08_copy.md の PG-003 の節。[漢字|よみ] はふりがなになる。
// 案内は文字列と分数の配列で返し、分数は部品が分数の形にして見せる
import { calculate, countUnits, isLowestTerms, leastCommonMultiple } from "./fraction";
import type { Fraction, Operator } from "./fraction";
import { readAnswer } from "./judge";
import { formatDecimal, parseDecimal } from "./makers/decimal-text";
import { listText } from "./number-problem";
import type { ExpressionRule, NumberProblem, NumberTopic } from "./number-problem";
import type { LessonProblem } from "./problems";
import { commonUnit, findPiece } from "./tiles";
import type { Problem, Tile, TileGame } from "./tiles";
import type { LessonChoice, LessonMessage, LessonNotice } from "./session";

/** mixed は帯分数の形で見せる */
export type InlinePart = string | (Fraction & { mixed?: boolean });

export const LESSON_COPY = {
  invalidPractice: "この れんしゅうは ひらけませんでした", // CP-1414
  exit: "[盤面|ばんめん]にもどる",
  progress: (current: number, total: number) => `${current} / ${total} [問|もん]`,
  problemHeading: "もんだい",
  answerLabel: "こたえ（れい: 1/2）",
  answerLabelMixed: "こたえ（れい: 1と1/2）",
  answerButton: "こたえる",
  helpButton: "[分|わ]かんない",
  nextButton: "つぎの[問題|もんだい]へ",
  tilesButton: "タイルにもどる",
  workHeading: "タイルで[考|かんが]える",
  rulerName: "ものさし",
  trayName: "タイル[置|お]き[場|ば]",
  trayNote: "タイルは、ドラッグするか、おして[選|えら]んでから、ものさしをおすと[置|お]けます。[小|ちい]さいタイルは、タイルの[上|うえ]に[重|かさ]ねられます。[何|なに]も[選|えら]んでいない[時|とき]は、ものさしのタイルをおすと[戻|もど]せます",
  placeButton: "ものさしに[置|お]く",
  stackButton: "タイルに[重|かさ]ねる",
  hintsName: "ヒント",
  hintButton: "[次|つぎ]のヒント",
  resetButton: "ぜんぶ[戻|もど]す",
  solved: "ぴったりそろいました。[式|しき]にもどしてみましょう",
  solvedTaken: "タイルを[取|と]れました。[式|しき]にもどしてみましょう",
  solvedChoice: "ぴったりそろいました。[問題|もんだい]にもどって[答|こた]えましょう",
  backButton: "もとの[問題|もんだい]にもどる",
  reviewGuide: "タイルを[数|かぞ]えて、□ に[入|い]れましょう",
  reviewGuideAnswer: "タイルと[式|しき]を[見|み]くらべて、[計算|けいさん]しましょう",
  reviewGuideChoice: "タイルを[見|み]くらべて、[答|こた]えましょう",
  clearHeading: "やったね",
  clearText: (total: number) => `${total}[問|もん]ぜんぶ[解|と]きました`,
  clearRepeat: "もう[一度|いちど]クリアしました。[経験値|けいけんち]は1[回目|かいめ]だけ[増|ふ]えます",
  clearButton: "[盤面|ばんめん]にもどる",
  reduceTask: "を[約分|やくぶん]しましょう",
  commonTask: "を[通分|つうぶん]しましょう",
  commonLabel: (name: string) => `${name} を[分母|ぶんぼ]をそろえた[形|かたち]で`,
  and: " と ",
  compareTask: "どちらが[大|おお]きいでしょう",
  sameChoice: "[同|おな]じ[大|おお]きさ",
  bigger: " のほうが[大|おお]きい",
  estimateTask: "[計算|けいさん]しないで[考|かんが]えましょう",
  divideTask: (dividend: number, divisor: number) => `${dividend}÷${divisor} の[商|しょう]を、[分数|ぶんすう]で[表|あらわ]しましょう`,
  equivalentTask: "□ に[入|はい]る[数|かず]を[入|い]れましょう",
  equivalentLabel: "□ に[入|はい]る[数|かず]",
  above: " より[大|おお]きい",
  below: " より[小|ちい]さい",
  alignedLabel: (name: string, den: number) => `${name} は ${den}[分|ぶん]のいくつ`,
  compareName: "[図|ず]でくらべる",
  compareTitle: "[図|ず]でくらべてみましょう",
  compareExpected: "もんだい",
  compareAnswer: "あなたのこたえ",
  compareShort: "[点線|てんせん]のところだけ、たりないみたいです",
  compareLong: "[点線|てんせん]のところだけ、[多|おお]いみたいです",
  compareClipped: "もっと[先|さき]までつづきます",
  nudgeHelp: "こまったら、「[分|わ]かんない」をおしてみましょう",
  nudgeHint: "こまったら、「[次|つぎ]のヒント」をおしてみましょう",
} as const;

export const MESSAGES: Record<LessonMessage, string> = {
  empty: "こたえを[入|い]れてください",
  invalid: "[分数|ぶんすう]で[入|い]れてください。（れい: 1/2）",
  wrong: "ちがうみたいです",
  wrongToTiles: "ちがうみたいです。「[分|わ]かんない」をおして、タイルで[考|かんが]えてみましょう",
  wrongToHints: "ちがうみたいです。「[分|わ]かんない」をおすと、ヒントが[見|み]られます",
  wrongInReview: "ちがうみたいです。タイルにもどって、[見|み]なおしてみましょう",
  correct: "せいかいです",
  back: "もとの[問題|もんだい]にもどりました。こたえを[入|い]れてください",
  backAligned: "もとの[問題|もんだい]にもどりました。□ に[数|かず]を[入|い]れましょう",
  backChoice: "もとの[問題|もんだい]にもどりました。どれかをえらびましょう",
  notLowest: "[同|おな]じ[大|おお]きさです。もっとかんたんにできます",
  notCommon: "どちらも[正|ただ]しい[大|おお]きさです。[分母|ぶんぼ]をそろえてみましょう",
  alignedEmpty: "□ に[数|かず]を[入|い]れてください",
  alignedWrong: "タイルのまい[数|すう]を[数|かぞ]えて、□ に[入|い]れましょう",
  alignedRight: "□ はあっています。[計算|けいさん]して、こたえを[入|い]れましょう",
  // 数の問題（08_copy-number.md）
  invalidDecimal: "[数|かず]で[入|い]れてください。（れい: 0.5）",
  invalidInteger: "[整数|せいすう]で[入|い]れてください。（れい: 12）",
  multiEmpty: "えらんでから、「こたえる」をおしてください",
  multiMissing: "ちがうみたいです。まだ[入|はい]っていない[数|かず]があります",
  multiExtra: "ちがうみたいです。[入|はい]らない[数|かず]がまじっています",
  remainderEmpty: "[商|しょう]とあまりを、どちらも[入|い]れてください",
};

/** 数の問題の文（CP-601〜CP-658）。文に入る値は topic が持ち、ここでは文だけを持つ */
export const NUMBER_COPY = {
  labelDecimal: "こたえ（れい: 0.5）",
  labelInteger: "こたえ（れい: 12）",
  cardsName: "[数|かず]の[札|ふだ]",
  quotientLabel: "[商|しょう]",
  remainderLabel: "あまり",
  remainderTask: "[商|しょう]は[整数|せいすう]で[求|もと]めて、あまりも[出|だ]しましょう",
  pickRuleTask: "[表|ひょう]の △ と □ の[関係|かんけい]を[表|あらわ]す[式|しき]を、えらびましょう",
  tableName: "△ と □ の[表|ひょう]",
  tableBlankTask: "[表|ひょう]の □ に[入|はい]る[数|かず]を[入|い]れましょう",
  evaluateTask: (x: string) => `△ が ${x} の[時|とき]、□ はいくつですか`,
  terminatesYes: "わり[切|き]れる",
  terminatesNo: "わり[切|き]れない",
  even: "[偶数|ぐうすう]",
  odd: "[奇数|きすう]",
} as const;

/** □ と △ の式。ExpressionRule の form ごとに形が決まる */
export function ruleText({ form, a, b }: ExpressionRule): string {
  if (form === "add") return `□ = ${a} + △`;
  return form === "mul" ? `□ = ${a} × △` : `□ = ${a} × △ + ${b}`;
}

const toDecimalText = (value: Fraction): string => formatDecimal(value) ?? `${value.num}/${value.den}`;

/** b + c（b は整数、c は小数の文字）。分配のきまりの式に使う */
function sumText(b: number, c: string): string {
  const fraction = parseDecimal(c);
  return fraction ? toDecimalText(calculate({ num: b, den: 1 }, "+", fraction)) : `${b}+${c}`;
}

const unitOf = (power: number): Fraction => ({ num: 1, den: power });

/** 問題の文（CP-612〜CP-657）。かけ算・わり算・分配のきまり・分数と整数の式は、式だけを見せるので空 */
export function numberTaskParts({ topic }: NumberProblem): InlinePart[] {
  switch (topic.t) {
    case "fractionToDecimal": return [topic.value, " を[小数|しょうすう]で[表|あらわ]しましょう"];
    case "decimalToFraction": return [`${topic.decimal} を[分数|ぶんすう]で[表|あらわ]しましょう`];
    case "intToFraction": return [LESSON_COPY.equivalentTask];
    case "terminates": return [topic.value, " を[小数|しょうすう]で[表|あらわ]すと、わり[切|き]れますか"];
    case "parity": return [`${topic.n} は[偶数|ぐうすう]ですか、[奇数|きすう]ですか`];
    case "divisors": return [`${topic.n} の[約数|やくすう]を、ぜんぶえらびましょう`];
    case "multiples": return [`${topic.upTo} までの[数|かず]で、${topic.k} の[倍数|ばいすう]を、ぜんぶえらびましょう`];
    case "commonDivisors": return [`${topic.a} と ${topic.b} の[公約数|こうやくすう]を、ぜんぶえらびましょう`];
    case "gcd": return [`${topic.a} と ${topic.b} の[最大公約数|さいだいこうやくすう]を[入|い]れましょう`];
    case "commonMultiple": return [`${topic.a} と ${topic.b} の[公倍数|こうばいすう]で、[小|ちい]さいほうから ${topic.nth}[番目|ばんめ]の[数|かず]を[入|い]れましょう`];
    case "lcm": return [`${topic.a} と ${topic.b} の[最小公倍数|さいしょうこうばいすう]を[入|い]れましょう`];
    case "shift":
      return topic.direction === "up"
        ? [`${topic.x} を ${topic.power}[倍|ばい]した[数|かず]を[入|い]れましょう`]
        : [`${topic.x} の `, unitOf(topic.power), " の[数|かず]を[入|い]れましょう"];
    case "compareProduct": return [`${topic.a}×${topic.b} の[積|せき]は、${topic.a} より[大|おお]きいですか、[小|ちい]さいですか`];
    case "compareQuotient": return [`${topic.a}÷${topic.b} の[商|しょう]は、${topic.a} より[大|おお]きいですか、[小|ちい]さいですか`];
    case "divideRemainder": return [NUMBER_COPY.remainderTask];
    case "pickRule": return [NUMBER_COPY.pickRuleTask];
    case "tableBlank": return [NUMBER_COPY.tableBlankTask];
    case "evaluate": return [NUMBER_COPY.evaluateTask(topic.x)];
    default: return [];
  }
}

/** 1つ選ぶ問題の選択肢。押す順は answer.options のまま。文は ruby 記法つき */
export function numberChoices(problem: NumberProblem): { id: string; text: string }[] {
  const { answer, topic } = problem;
  if (answer.type !== "choice") return [];
  return answer.options.map((id) => ({ id, text: choiceText(topic, id) }));
}

function choiceText(topic: NumberTopic, id: string): string {
  switch (topic.t) {
    case "parity": return id === "even" ? NUMBER_COPY.even : NUMBER_COPY.odd;
    case "terminates": return id === "yes" ? NUMBER_COPY.terminatesYes : NUMBER_COPY.terminatesNo;
    // 積と商の大きさの選択肢は 08_copy-number.md に無い。見積もりの CP（LESSON_COPY.above・below）と同じ形にする
    case "compareProduct":
    case "compareQuotient": return `${topic.a}${id === "above" ? LESSON_COPY.above : LESSON_COPY.below}`;
    case "pickRule": return ruleTextOfId(id);
    default: return id;
  }
}

// 式の選択肢の id は `${form}:${a}:${b}`（number-problem.ts）
function ruleTextOfId(id: string): string {
  const [form, a, b] = id.split(":");
  return ruleText({ form: form as ExpressionRule["form"], a: Number(a), b: Number(b) });
}

/** 答えの欄のラベル。小数 CP-601、整数 CP-602、分数 CP-403、分子だけ（□ のある式）CP-474 */
export function numberAnswerLabel({ answer }: NumberProblem): string {
  if (answer.type === "integer") return NUMBER_COPY.labelInteger;
  if (answer.type === "fraction") return LESSON_COPY.answerLabel;
  if (answer.type === "numerator") return LESSON_COPY.equivalentLabel;
  return NUMBER_COPY.labelDecimal;
}

/** 問題の文の下に見せる式。正解の後は「?」に答えを入れる。式を見せない問題は空 */
export function numberExpressionParts({ topic }: NumberProblem, isCorrect: boolean): InlinePart[] {
  const end = (shown: string): InlinePart => (isCorrect ? shown : "?");
  switch (topic.t) {
    case "fractionToDecimal": return [topic.value, " = ", end(topic.decimal)];
    case "decimalToFraction": return [`${topic.decimal} = `, isCorrect ? topic.value : "?"];
    case "multiply": return [`${topic.a} × ${topic.b} = `, end(topic.answer)];
    case "divide": return [`${topic.a} ÷ ${topic.b} = `, end(topic.answer)];
    case "divideRemainder": return [`${topic.a} ÷ ${topic.b} =`];
    case "distributive": return [`${topic.a} × ${sumText(topic.b, topic.c)} = ${topic.a} × ${topic.b} + ${topic.a} × ${isCorrect ? topic.c : "□"}`];
    case "evaluate": return [ruleText(topic.rule)];
    default: return [];
  }
}

/** 正解の後の一言（CP-613〜CP-658）。問題の種類ごとに決まる */
export function numberAfterParts({ topic }: NumberProblem): InlinePart[] {
  switch (topic.t) {
    case "fractionToDecimal": return [topic.value, ` は ${topic.value.num}÷${topic.value.den} で ${topic.decimal} です`];
    case "decimalToFraction": return [`${topic.decimal} は `, topic.unit, ` の ${topic.count}こ[分|ぶん]で `, topic.value, " です"];
    case "intToFraction": return [`${topic.n} は `, unitOf(topic.den), ` の ${topic.count}こ[分|ぶん]です`];
    case "terminates":
      return topic.terminates
        ? [`${topic.value.num}÷${topic.value.den} は ${topic.decimal} で、わり[切|き]れます`]
        : [`${topic.value.num}÷${topic.value.den} は ${topic.decimal}… と、どこまでもつづきます`];
    case "parity":
      return [topic.even ? `${topic.n} は 2 でわり[切|き]れるので、[偶数|ぐうすう]です` : `${topic.n} は 2 でわると 1 あまるので、[奇数|きすう]です`];
    case "divisors": return [`${topic.n} の[約数|やくすう]は ${listText(topic.list)} です`];
    case "multiples": return [`${topic.upTo} までの ${topic.k} の[倍数|ばいすう]は ${listText(topic.list)} です`];
    case "commonDivisors": return [`${topic.a} と ${topic.b} の[公約数|こうやくすう]は ${listText(topic.list)} です`];
    case "gcd": return [`${topic.a} と ${topic.b} の[公約数|こうやくすう]は ${listText(topic.list)} で、いちばん[大|おお]きいのは ${topic.answer} です`];
    case "commonMultiple": return [`${topic.a} と ${topic.b} の[公倍数|こうばいすう]は、[小|ちい]さいほうから ${listText(topic.list)} です`];
    case "lcm": return [`${topic.a} と ${topic.b} の[公倍数|こうばいすう]のうち、いちばん[小|ちい]さいのは ${topic.answer} です`];
    case "shift":
      return topic.direction === "up"
        ? [`${topic.power}[倍|ばい]すると、[小数点|しょうすうてん]が[右|みぎ]へ ${topic.places}けたうつります`]
        : [unitOf(topic.power), ` にすると、[小数点|しょうすうてん]が[左|ひだり]へ ${topic.places}けたうつります`];
    case "compareProduct":
      return [topic.bigger ? "1 より[大|おお]きい[数|かず]をかけると、[積|せき]はかけられる[数|かず]より[大|おお]きくなります" : "1 より[小|ちい]さい[数|かず]をかけると、[積|せき]はかけられる[数|かず]より[小|ちい]さくなります"];
    case "compareQuotient":
      return [topic.bigger ? "1 より[小|ちい]さい[数|かず]でわると、[商|しょう]はわられる[数|かず]より[大|おお]きくなります" : "1 より[大|おお]きい[数|かず]でわると、[商|しょう]はわられる[数|かず]より[小|ちい]さくなります"];
    case "multiply": return [`${topic.intA}×${topic.intB} = ${topic.intProduct} の[積|せき]の[小数点|しょうすうてん]を、[左|ひだり]へ ${topic.places}けたうつします`];
    case "divide": return [`わられる[数|かず]とわる[数|かず]に ${topic.factor} をかけて、${topic.intA}÷${topic.intB} にしても、[商|しょう]は[同|おな]じです`];
    case "divideRemainder": return [`${topic.b}×${topic.quotient}＋${topic.remainder} = ${topic.a} です`];
    case "distributive": return [`${topic.a}×(${topic.b}＋${topic.c}) は、${topic.a}×${topic.b} と ${topic.a}×${topic.c} をたした[数|かず]です`];
    case "pickRule": return [pickRuleAfter(topic.rule)];
    case "tableBlank":
    case "evaluate": return [`${ruleText(topic.rule)} の △ に ${topic.x} を[入|い]れると、□ は ${topic.answer} です`];
  }
}

function pickRuleAfter({ form, a, b }: ExpressionRule): string {
  if (form === "add") return `□ は、いつも △ に ${a} をたした[数|かず]です`;
  return form === "mul" ? `□ は、いつも △ の ${a}[倍|ばい]です` : `□ は、いつも △ の ${a}[倍|ばい]に ${b} をたした[数|かず]です`;
}

/** 図でくらべる時の、問題の側の名前。答えの値は書かず、問題の式か約分する分数だけを書く */
export function compareExpectedParts(problem: LessonProblem, game: TileGame): InlinePart[] {
  if (problem.kind === "number") return [];
  if (problem.kind === "reduce" || problem.kind === "equivalent") return [problem.value];
  if (problem.kind === "divide") return [`${problem.dividend}÷${problem.divisor}`];
  const { left, operator, right } = game.problem;
  const mixed = problem.kind === "calculate" && problem.showMixed === true;
  return [{ ...left, mixed }, ` ${operatorText(operator)} `, { ...right, mixed }];
}

// 式は帯分数でも、タイルの名前は仮分数。どのタイルかが分かるように並べて書く
function tileName(value: Fraction): InlinePart[] {
  return value.num > value.den ? [{ ...value, mixed: true }, "（", value, "）"] : [value];
}

// 手順は書かない。何を置くかだけを言い、うめるタイルに気づくのは本人に任せる。先はヒントで順に開く
export function guideParts({ problem }: TileGame): InlinePart[] {
  const { left, right, operator, isRewrite } = problem;
  if (problem.isDivide) return ["ものさしに ", { num: 1, den: left.den }, " のタイルを ", `${left.num}まい[置|お]きましょう`];
  if (problem.isEquivalent) return ["ものさしに ", left, " のタイルを[置|お]いて、", { num: 1, den: problem.answer.den }, " のタイルでうめてみましょう"];
  if (isRewrite) return ["ものさしに ", left, " のタイルを[置|お]いて、もっと[大|おお]きいタイルでうめてみましょう"];
  if (operator === "-") return ["ものさしに ", ...tileName(left), " のタイルを[置|お]いて、", right, " のタイルを[上|うえ]に[重|かさ]ねて[取|と]りましょう"];
  return ["ものさしに ", ...tileName(left), " と ", right, " のタイルを[置|お]きましょう"];
}

function placeFirstParts({ left, right, operator, isRewrite, isDivide }: Problem): InlinePart[] {
  if (isDivide) return ["[先|さき]に、", { num: 1, den: left.den }, " のタイルを、ものさしに[置|お]きましょう"];
  const tiles: InlinePart[] = isRewrite || operator === "-" ? tileName(left) : [...tileName(left), " と ", right];
  return ["[先|さき]に、", ...tiles, " のタイルを、ものさしに[置|お]きましょう"];
}

const NOTICES: Record<LessonNotice, (game: TileGame) => InlinePart[]> = {
  none_left: () => ["このタイルは、もうありません"],
  ruler_full: () => ["ものさしより[長|なが]くなります。いらないタイルをおして、[外|はず]してみましょう"],
  take_on_left: ({ problem }) => [problem.right, " のタイルは、うめたタイルの[上|うえ]に[重|かさ]ねましょう"],
  fill_first: (game) => ["[先|さき]に、", commonUnit(game), " のタイルでうめてみましょう"],
  mixed_unit: (game) => [commonUnit(game), " のタイルで、うめてみましょう"],
  already_full: () => ["そのタイルは、もういっぱいです"],
  already_taken: () => ["もう[取|と]ってあります"],
  cover_tile: ({ problem }) => ["タイルは、", problem.left, " の[上|うえ]に[重|かさ]ねましょう"],
  no_fit: () => ["そのタイルでは、ぴったりうめられません"],
  loose_unit: (game) => [commonUnit(game), " のタイルは、ほかのタイルの[上|うえ]に[重|かさ]ねてみましょう"],
  place_first: ({ problem }) => placeFirstParts(problem),
  no_more_hints: () => ["ヒントはここまでです"],
  tiles_next: () => ["ヒントはここまでです。もう[一度|いちど]「[分|わ]かんない」をおすと、タイルで[考|かんが]えられます"],
};

export function noticeParts(notice: LessonNotice, game: TileGame): InlinePart[] {
  return NOTICES[notice](game);
}

/** 帯分数に分ける。真分数はそのまま whole が 0 になる */
export function toMixed({ num, den }: Fraction): { whole: number; rest: Fraction } {
  return { whole: Math.floor(num / den), rest: { num: num % den, den } };
}

const asMixed = (value: Fraction): InlinePart => ({ ...value, mixed: true });

function calculateAfter(game: TileGame, answerText: string): InlinePart[] {
  const { answer } = game.problem;
  const typed = readAnswer(answerText);
  const parts: InlinePart[] = [];
  if (typed && !isLowestTerms(typed)) parts.push(typed, " は[約分|やくぶん]すると ", answer, " です。");
  if (answer.num > answer.den && answer.num % answer.den !== 0) parts.push(answer, " は ", asMixed(answer), " とも[書|か]けます");
  return parts;
}

function compareAfter({ left, right }: Pick<Problem, "left" | "right">): InlinePart[] {
  const den = leastCommonMultiple([left.den, right.den]);
  const [first, second] = [left, right].map((value) => ({ num: countUnits(value, den) ?? 0, den })) as [Fraction, Fraction];
  return ["[分母|ぶんぼ]をそろえると ", first, " と ", second, " です"];
}

// 6÷3 のように割り切れる時は、整数でも書けると続ける
function divideAfter({ dividend, divisor }: { dividend: number; divisor: number }): InlinePart[] {
  const answer = { num: dividend, den: divisor };
  const parts: InlinePart[] = [`${dividend}÷${divisor} の[商|しょう]は、`, { num: 1, den: divisor }, ` の ${dividend}こ[分|ぶん]で `, answer];
  return dividend % divisor === 0 ? [...parts, " です。", answer, ` は ${dividend / divisor} とも[書|か]けます`] : [...parts, " です"];
}

function equivalentAfter({ value, target }: { value: Fraction; target: number }): InlinePart[] {
  const change = target > value.den ? `に[同|おな]じ[数|かず] ${target / value.den} をかける` : `を[同|おな]じ[数|かず] ${value.den / target} でわる`;
  return [`[分母|ぶんぼ]と[分子|ぶんし]${change}と、[同|おな]じ[大|おお]きさの[分数|ぶんすう]になります`];
}

/** 正解の後に足す一言。約分と帯分数への言い換えを、計算の続きとして見せる */
export function afterParts(problem: LessonProblem, game: TileGame, answerText: string): InlinePart[] {
  if (problem.kind === "number") return numberAfterParts(problem);
  if (problem.kind === "calculate") return calculateAfter(game, answerText);
  if (problem.kind === "estimate") return ["[計算|けいさん]すると ", asMixed(game.problem.answer), " です"];
  if (problem.kind === "compare") return compareAfter(problem);
  if (problem.kind === "reduce") return [problem.value, " と ", game.problem.answer, " は[同|おな]じ[大|おお]きさです"];
  if (problem.kind === "divide") return divideAfter(problem);
  if (problem.kind === "equivalent") return equivalentAfter(problem);
  return [];
}

/** くらべる問題と見積もりの選択肢。押す順は問題の順のまま */
export function choiceParts(problem: LessonProblem): { choice: LessonChoice; parts: InlinePart[] }[] {
  if (problem.kind === "compare") {
    return [
      { choice: "left", parts: [problem.left, LESSON_COPY.bigger] },
      { choice: "right", parts: [problem.right, LESSON_COPY.bigger] },
      { choice: "same", parts: [LESSON_COPY.sameChoice] },
    ];
  }
  if (problem.kind !== "estimate") return [];
  return [
    { choice: "above", parts: [problem.threshold, LESSON_COPY.above] },
    { choice: "below", parts: [problem.threshold, LESSON_COPY.below] },
  ];
}

/** 分数の形がまざった文の、読み上げの名前。`[語|よみ]` のまま返す。画面に出す前に useText() を通す */
export function inlineName(parts: InlinePart[]): string {
  return parts.map((part) => (typeof part === "string" ? part : fractionName(part))).join("");
}

export const remainingLabel = (remaining: number): string => `のこり ${remaining}`;

export const countLabel = (count: number): string => ` が ${count} まいぶん`;

/** 読み上げの名前。分数の形は読み上げると分母と分子がばらばらになる */
export const fractionName = ({ num, den }: Fraction): string => (den === 1 ? `${num}` : `${den}[分|ぶん]の${num}`);

export function mixedName(value: Fraction): string {
  const { whole, rest } = toMixed(value);
  if (whole === 0) return fractionName(value);
  return rest.num === 0 ? `${whole}` : `${whole}と${fractionName(rest)}`;
}

const OPERATOR_NAME: Record<Operator, string> = { "+": "たす", "-": "ひく" };

export const operatorText = (operator: Operator): string => (operator === "+" ? "+" : "−");

export function expressionName({ left, operator, right }: Pick<Problem, "left" | "operator" | "right">, showMixed = false): string {
  const name = showMixed ? mixedName : fractionName;
  return `${name(left)} ${OPERATOR_NAME[operator]} ${name(right)}`;
}

/** 見える文字（1/2）を先頭に含める。見える文字が名前に入っていないと、声で操作する人が呼べない（WCAG 2.5.3、#371） */
export const visibleFraction = ({ num, den }: Fraction): string => (den === 1 ? `${num}` : `${num}/${den}`);

export function trayTileName(piece: Fraction, remaining: number): string {
  return `${visibleFraction(piece)}、${fractionName(piece)}のタイル。${remainingLabel(remaining)}`;
}

export function rulerTileName(game: TileGame, tile: Tile): string {
  const piece = findPiece(game, tile.key);
  const name = `${visibleFraction(piece)}、${fractionName(piece)}のタイル`;
  const cover = tile.coverKey ? `。${fractionName(findPiece(game, tile.coverKey))}を ${tile.coverCount} まい[重|かさ]ねています` : "";
  const taken = tile.takenKey ? `。${fractionName(findPiece(game, tile.takenKey))}を[取|と]りました` : "";
  return `${name}${cover}${taken}`;
}
