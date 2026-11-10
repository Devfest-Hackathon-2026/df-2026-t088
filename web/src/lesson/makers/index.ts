// 問題の関数の一覧（TBL-001）。分数 8・数の問題 4・整数 7・小数 7・□と△の式 3
import { DECIMAL_MAKERS } from "./decimal";
import { EXPRESSION_MAKERS } from "./expression";
import { FRACTION_MAKERS } from "./fraction";
import { INTEGER_MAKERS } from "./integer";
import { NUMBER_MAKERS } from "./number";
import type { ProblemMaker } from "./types";

export const MAKERS: readonly ProblemMaker[] = [
  ...FRACTION_MAKERS, ...NUMBER_MAKERS, ...INTEGER_MAKERS, ...DECIMAL_MAKERS, ...EXPRESSION_MAKERS,
];

/** 名前で関数を引く。無ければ undefined */
export const findMaker = (name: string): ProblemMaker | undefined => MAKERS.find((maker) => maker.name === name);
