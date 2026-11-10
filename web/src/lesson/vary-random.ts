// 数の入れ替えに使う、種つきの乱数（D-254）。Math.random は使わない。同じ種・同じ名前なら、いつでも同じ数が出る
import type { Arg } from "./makers/types";

/** 文字から 32 ビットの種を作る（FNV-1a） */
export function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32。0 以上 1 未満の数を返す関数 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Random {
  /** lo 以上 hi 以下の整数 */
  int(lo: number, hi: number): number;
  pick<T>(items: readonly T[]): T;
}

export function randomOf(seed: number): Random {
  const next = mulberry32(seed);
  const int = (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1));
  function pick<T>(items: readonly T[]): T {
    return items[int(0, items.length - 1)] as T;
  }
  return { int, pick };
}

/**
 * 1 回の入れ替え。seed は（学習の名前, 何回目か）で決まり、draw は引き直しの番号。
 * random(label) は名前ごとに独立した乱数を返すので、同じ名前を使う行どうしは同じ数になる（12×4.3 と 12×0.43 の 12 など）
 */
export interface VaryContext {
  random(label: string): Random;
}

export const varyContextOf = (seed: number, draw: number): VaryContext => ({
  random: (label) => randomOf(hashText(`${seed}:${draw}:${label}`)),
});

/** args から、同じ形で数だけ別の args を作る。作れない形は args をそのまま返す */
export type Vary = (args: Arg[], context: VaryContext) => Arg[];

/** 0 でない桁だけ 1〜9 の別の数にする。けた数・小数点の位置・0 の桁は変えない（"5.08" → "3.07"） */
export const varyDigits = (text: string, random: Random): string => text.replace(/[1-9]/g, () => String(random.int(1, 9)));

export const gcdOf = (a: number, b: number): number => (b === 0 ? a : gcdOf(b, a % b));
export const lcmOf = (a: number, b: number): number => (a / gcdOf(a, b)) * b;
