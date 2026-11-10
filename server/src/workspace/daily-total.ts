// 全学級の合計の、1 日の上限（メモリだけ。再起動で戻る）。だれでも学級を作れるとき（TEACHER_LOGIN=guest）の費用の歯止め。
// 学級ごとの上限（countRead・ai-quota）に加えて掛ける。日は日本時間で数える。
import { jstDay } from "./store.ts";

export const DEFAULT_PRINT_READS_TOTAL_PER_DAY = 500;
export const DEFAULT_LOOP_AI_TOTAL_PER_DAY = 300;
export const DEFAULT_STUDIO_AI_TOTAL_PER_DAY = 200;

export type DailyTotal = {
  /** まだ使えるか。数えない */
  available(now: Date): boolean;
  /** 1 回分を数える */
  add(now: Date): void;
};

/** 環境変数を読む。正の整数でなければ既定 */
export function readTotalPerDay(environment: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const text = environment[name]?.trim() ?? "";
  if (!/^\d+$/.test(text)) return fallback;
  const value = Number(text);
  return Number.isSafeInteger(value) && value >= 1 ? value : fallback;
}

export function createDailyTotal(limit: number): DailyTotal {
  let day = "";
  let count = 0;
  const roll = (now: Date) => {
    const today = jstDay(now);
    if (today !== day) {
      day = today;
      count = 0;
    }
  };
  return {
    available(now) {
      roll(now);
      return count < limit;
    },
    add(now) {
      roll(now);
      count += 1;
    },
  };
}
