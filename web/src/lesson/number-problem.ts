// 数の問題（タイルを使わない問題）の形。問題の関数（makers/）が作り、wording.ts が文にし、画面（NumberWork）が欄を出す。
// 文言の正本は docs/design/ui/08_copy-number.md（CP-601〜CP-658）。ここには文を書かず、文に入れる値だけを持つ
import type { Fraction } from "./fraction";

/** 小数は浮動小数にせず、余分な 0 を付けない文字で持つ（"0.25"、"3"）。計算は 10 の累乗の分数にして行う */
export type DecimalText = string;

/** □と△の式。add：□ = a + △、mul：□ = a × △、mulAdd：□ = a × △ + b */
export type ExpressionForm = "add" | "mul" | "mulAdd";

export interface ExpressionRule {
  form: ExpressionForm;
  a: number;
  /** add と mul では 0 */
  b: number;
}

/** △ と □ の表の1列。y が null のマスが、答えを入れる空欄 */
export interface TableColumn {
  x: DecimalText;
  y: DecimalText | null;
}

/** 文に入れる値。関数ごとに1つ。どの CP を使うかは wording.ts が t で決める */
export type NumberTopic =
  // 分数の章 main-1
  | { t: "fractionToDecimal"; value: Fraction; decimal: DecimalText }
  | { t: "decimalToFraction"; decimal: DecimalText; unit: Fraction; count: number; value: Fraction }
  | { t: "intToFraction"; n: number; den: number; count: number }
  | { t: "terminates"; value: Fraction; /** わり切れる時は商、わり切れない時は小数第3位までの商（"0.333"） */ decimal: DecimalText; terminates: boolean }
  // 整数の章
  | { t: "parity"; n: number; even: boolean }
  | { t: "divisors"; n: number; list: number[] }
  | { t: "multiples"; k: number; upTo: number; list: number[] }
  | { t: "commonDivisors"; a: number; b: number; list: number[] }
  | { t: "gcd"; a: number; b: number; list: number[]; answer: number }
  | { t: "commonMultiple"; a: number; b: number; nth: number; /** 小さいほうから nth 番目まで */ list: number[] }
  | { t: "lcm"; a: number; b: number; answer: number }
  // 小数の章
  | { t: "shift"; x: DecimalText; /** 10・100・1000 なら up、1/10・1/100・1/1000 なら down */ direction: "up" | "down"; power: 10 | 100 | 1000; places: number; answer: DecimalText }
  | { t: "compareProduct"; a: DecimalText; b: DecimalText; bigger: boolean }
  | { t: "multiply"; a: DecimalText; b: DecimalText; intA: number; intB: number; intProduct: number; places: number; answer: DecimalText }
  | { t: "compareQuotient"; a: DecimalText; b: DecimalText; bigger: boolean }
  | { t: "divide"; a: DecimalText; b: DecimalText; factor: 10 | 100 | 1000; intA: number; intB: number; answer: DecimalText }
  | { t: "divideRemainder"; a: DecimalText; b: DecimalText; quotient: number; remainder: DecimalText }
  | { t: "distributive"; a: number; b: number; c: DecimalText }
  // □と△の式の章
  | { t: "pickRule"; rule: ExpressionRule; table: TableColumn[] }
  | { t: "tableBlank"; rule: ExpressionRule; table: TableColumn[]; x: DecimalText; answer: DecimalText }
  | { t: "evaluate"; rule: ExpressionRule; x: DecimalText; answer: DecimalText };

/**
 * 答えの形（problems の FR-006）。
 * choice の options は選択肢の id で、ボタンの文は wording.ts が topic から作る。
 * 決まった id：わり切れるか "yes" / "no"、偶数と奇数 "even" / "odd"、積と商の大きさ "above" / "below"、
 * 式をえらぶ `${form}:${a}:${b}`（例 "add:2:0"）
 */
export type NumberAnswer =
  | { type: "integer"; value: number }
  | { type: "decimal"; value: DecimalText }
  | { type: "fraction"; value: Fraction }
  | { type: "numerator"; value: number }
  | { type: "remainder"; quotient: number; remainder: DecimalText }
  | { type: "choice"; options: string[]; correct: string }
  | { type: "multi"; cards: number[]; correct: number[] };

export interface NumberProblem {
  kind: "number";
  /** 出題表から作った問題の id（関数名と数） */
  id?: string;
  /** タイルは使わない。「分かんない」はヒントを1つずつ開く */
  pieces: [];
  hints: string[];
  hintsBeforeTiles?: undefined;
  topic: NumberTopic;
  answer: NumberAnswer;
}

/** 数の並びの書き方（CP-631 など）。区切りは「, 」 */
export const listText = (list: readonly number[]): string => list.join(", ");
