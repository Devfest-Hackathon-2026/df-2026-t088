import { reduceFraction } from "./fraction.ts";
import type { Fraction } from "./fraction.ts";

// 約分前の倍数の形（10/12 など）として探す倍率の上限（仮）。これを超える倍数は見ない
const MAX_MULTIPLE = 12;

const VULGAR_FRACTIONS: Record<string, string> = {
  "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4", "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5",
  "⅙": "1/6", "⅚": "5/6", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
  "⅐": "1/7", "⅑": "1/9", "⅒": "1/10",
};
const VULGAR_CLASS = `[${Object.keys(VULGAR_FRACTIONS).join("")}]`;
// 分数の一部になっている数字（2/4 の 4、2分の1 の 1、1.5 の 5）は、整数や帯分数の整数部として読まない
const NOT_FRACTION_PART = "(?<![\\d/.])(?<!分の)";
const KANJI_DIGITS: Record<string, number> = { "〇": 0, "零": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };

// ヒントが答えをそのまま書いていないかを調べる。
// 制限（見分けられないもの）：「ろくぶんのご」のようなひらがなの数、100以上の漢数字（百・千）、
// 小数（0.5 など）、LaTeX の \frac{3}{4} は \frac{a}{b} の形だけ a/b に読む（入れ子や \dfrac は読まない）。
// 整数の答えは「になる／なります／です／だよ／だね」「答えは」「=」の形だけ見る。「1つ」「2枚」のような数え方が続く形、
// 「1/4」「1分」の一部、「1になるまで」は漏れとして扱わない（正しいヒントを落とさない側に倒す）ので、「1も同じだね」のような言い方は見逃す。
// 空白区切りの帯分数「1 3/4」は見つけるが、「ステップ1 3/4」のように直前の語の数字と区別できないものは見逃す
export function hintLeaksAnswer(hints: string[], computed: Fraction, answer: Fraction): boolean {
  const fractionPatterns = buildFractionPatterns([computed, answer]);
  const mixedPatterns = buildMixedPatterns(computed);
  const integerPatterns = buildIntegerPatterns(computed);
  return hints.some((hint) => {
    const text = normalizeHint(hint);
    // 空白を消した文では「5 / 6」を、空白を残した文では帯分数「1 5/12」を見つける
    return [...fractionPatterns, ...integerPatterns].some((pattern) => pattern.test(text.stripped))
      || mixedPatterns.some((pattern) => pattern.test(text.spaced));
  });
}

function buildFractionPatterns(values: Fraction[]): RegExp[] {
  const patterns: RegExp[] = [];
  const seen = new Set<string>();
  const add = (num: bigint, den: bigint) => {
    const key = `${num}/${den}`;
    if (seen.has(key)) return;
    seen.add(key);
    // 前後に数字が続くもの（5/6 に対する 15/6 など）は別の分数なので、数字の切れ目で区切る
    patterns.push(new RegExp(`(?<!\\d)${num}/${den}(?!\\d)`), new RegExp(`(?<!\\d)${den}分の${num}(?!\\d)`));
  };
  for (const value of values) {
    add(BigInt(value.num), BigInt(value.den));
    const reduced = reduceFraction(value);
    for (let k = 1n; k <= BigInt(MAX_MULTIPLE); k++) add(BigInt(reduced.num) * k, BigInt(reduced.den) * k);
  }
  return patterns;
}

function buildMixedPatterns(computed: Fraction): RegExp[] {
  const reduced = reduceFraction(computed);
  const whole = Math.floor(reduced.num / reduced.den);
  const rest = reduced.num - whole * reduced.den;
  if (whole < 1 || rest === 0) return [];
  const patterns: RegExp[] = [];
  for (let k = 1; k <= MAX_MULTIPLE; k++) {
    const num = rest * k;
    const den = reduced.den * k;
    patterns.push(new RegExp(`${NOT_FRACTION_PART}${whole}\\s*(?:と\\s*|\\s)${num}\\s*/\\s*${den}(?![\\d/]|分の)`));
    patterns.push(new RegExp(`${NOT_FRACTION_PART}${whole}\\s*と\\s*${den}\\s*分の\\s*${num}(?![\\d/]|分の)`));
  }
  return patterns;
}

function buildIntegerPatterns(computed: Fraction): RegExp[] {
  const reduced = reduceFraction(computed);
  if (reduced.den !== 1) return [];
  const n = reduced.num;
  // 「1」だけの一致は「1つ選ぶ」などの誤検知が多いので、答えを言い切る形（答えは1、=1、1になる、1です）に限る
  const tail = "(?![\\d/.分つ個枚こ番回ばん])";
  // 「1になるまで足そう」「1になるように」は手順の説明なので漏れにしない
  const statement = "(?:になる(?!まで|ように|には)|になります|ですよ?|だよ|だね)";
  return [
    new RegExp(`(?:答え|こたえ|=)[はが]?[「『(]?${n}${tail}`),
    new RegExp(`${NOT_FRACTION_PART}${n}${statement}`),
  ];
}

function normalizeHint(hint: string): { spaced: string; stripped: string } {
  let text = hint.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0))
    .replace(/[／∕⁄÷]/g, "/").replace(/＝/g, "=").replace(/ぶんの/g, "分の");
  text = text.replace(/\\frac\s*\{(\d+)\}\s*\{(\d+)\}/g, "$1/$2");
  text = text.replace(/[〇零一二三四五六七八九十]+/g, kanjiNumber);
  // 1文字の分数は、直前の数字とくっつけない（⅚ を 1⅚ の「15/6」と読まない）ように区切りを入れる
  const expand = (separator: string) => text.replace(new RegExp(VULGAR_CLASS, "g"), (mark) => `${separator}${VULGAR_FRACTIONS[mark]}`);
  return { spaced: expand(" ").replace(/\s+/g, " "), stripped: expand("|").replace(/\s+/g, "") };
}

function kanjiNumber(run: string): string {
  const tens = run.indexOf("十");
  if (tens === -1) return [...run].map((char) => String(KANJI_DIGITS[char])).join("");
  const rest = run.slice(tens + 1);
  const head = run.slice(0, tens);
  // 十が1つで、前後が1文字以下の数字のときだけ読む（十、十二、二十、二十三）。それ以外は読まずにそのまま残す
  if (run.indexOf("十", tens + 1) !== -1 || head.length > 1 || rest.length > 1) return run;
  return String((head ? KANJI_DIGITS[head]! : 1) * 10 + (rest ? KANJI_DIGITS[rest]! : 0));
}
