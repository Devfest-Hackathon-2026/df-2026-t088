// ふりがな記法 `[漢字|よみ]` と、改行してよい位置 `<wbr>` を扱う。innerHTML は使わず、部品に渡す形に分ける
import { kanjiGrade } from "./data/kanji-grades";
import type { Grade } from "./data/kanji-grades";

export type RubySegment =
  | { type: "text"; text: string }
  | { type: "ruby"; base: string; reading: string }
  | { type: "wbr" };

const TOKEN = /\[([^|\]]+)\|([^\]]+)\]|<wbr>/g;

export function parseRuby(text: string): RubySegment[] {
  const segments: RubySegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ type: "text", text: text.slice(cursor, start) });
    const [token, base, reading] = match;
    segments.push(token === "<wbr>" || base === undefined || reading === undefined
      ? { type: "wbr" }
      : { type: "ruby", base, reading });
    cursor = start + token.length;
  }
  if (cursor < text.length) segments.push({ type: "text", text: text.slice(cursor) });
  return segments;
}

/** 読み上げの名前に使う。ふりがなと <wbr> を除き、漢字だけを残す */
export function plainText(text: string): string {
  return parseRuby(text)
    .map((segment) => (segment.type === "text" ? segment.text : segment.type === "ruby" ? segment.base : ""))
    .join("");
}

const CJK = /[一-鿿]/;

/** 語の漢字が、全部 grade 以下で習う字か。配当表に無い字は習っていない字として扱う。漢字が1字も無ければ true */
export function isReadableAt(base: string, grade: Grade): boolean {
  return [...base].every((ch) => !CJK.test(ch) || (kanjiGrade(ch) ?? Infinity) <= grade);
}

/** 語を、学年に合わせて漢字かよみのどちらかにする。grade が null なら漢字のまま */
export function chooseRuby(base: string, reading: string, grade: Grade | null): string {
  return grade === null || isReadableAt(base, grade) ? base : reading;
}

/**
 * 子どもに見せる文字列にする（D-91）。`[語|よみ]` は、語の漢字が全部 grade 以下なら語、そうでなければよみ。
 * grade が null（学年の設定の外）なら漢字のまま返す。`<wbr>` は除く
 */
export function displayText(text: string, grade: Grade | null): string {
  return parseRuby(text)
    .map((segment) => (segment.type === "text" ? segment.text : segment.type === "ruby" ? chooseRuby(segment.base, segment.reading, grade) : ""))
    .join("");
}
