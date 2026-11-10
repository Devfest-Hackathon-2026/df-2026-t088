// 問題の id の書き方と、ヒントの文字を調べる道具。id の書き方は一度決めたら変えない（ADR-004）
import type { Fraction } from "../fraction";
import type { Arg } from "./types";

const isFraction = (arg: Arg): arg is Fraction => typeof arg === "object";

/** 分数は約分せず `num/den`（den が 1 なら `num`）。真偽値は真なら `m`、偽なら省く */
export function formatArgs(args: Arg[]): string {
  const parts: string[] = [];
  for (const arg of args) {
    if (typeof arg === "boolean") {
      if (arg) parts.push("m");
    } else if (isFraction(arg)) {
      parts.push(arg.den === 1 ? `${arg.num}` : `${arg.num}/${arg.den}`);
    } else {
      parts.push(String(arg));
    }
  }
  return parts.join(",");
}

/** 例 `fraction.calculate(1/3,+,1/4)`。args は check が返した正規化したもの */
export const problemIdOf = (maker: string, args: Arg[]): string => `${maker}(${formatArgs(args)})`;

/** 文の中に、その分数が `num/den` で出てくるか。前後が数字でも `/` でもない所だけ数える（`1/12` の中の `1/2` は数えない） */
export function mentionsFraction(text: string, { num, den }: Fraction): boolean {
  return new RegExp(`(?<![\\d/])${num}/${den}(?![\\d/])`).test(text);
}

/** 文の中に、その整数か小数が出てくるか。前後が数字・小数点・`/` でない所だけ数える（`12` の中の `2`、`0.25` の中の `2` は数えない） */
export function mentionsNumber(text: string, value: string): boolean {
  const escaped = value.replace(".", "\\.");
  return new RegExp(`(?<![\\d/])(?<!\\d\\.)${escaped}(?![\\d/]|\\.\\d)`).test(text);
}
