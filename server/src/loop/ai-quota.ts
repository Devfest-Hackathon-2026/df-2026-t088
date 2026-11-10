// 学びの輪のアシスタントが Gemini を呼ぶ回数の、学級ごとの 1 日の上限（メモリだけ。再起動で戻る）。
// 日は日本時間で数える。demo（審査・デモの共有の学級）は数えない。
// 学級ごとに加えて、全学級の合計の上限（total）も持つ（だれでも学級を作れるときの費用の歯止め）。
import { DEMO_WORKSPACE_ID } from "../workspace/store.ts";
import type { DailyTotal } from "../workspace/daily-total.ts";

export const DEFAULT_AI_PER_DAY = 20;
const JST_OFFSET_MS = 9 * 3_600_000;

export type AiQuota = { take(workspaceId: string): boolean };

export function readAiPerDay(environment: NodeJS.ProcessEnv): number {
  const text = environment.LOOP_AI_PER_DAY?.trim() ?? "";
  if (!/^\d+$/.test(text)) return DEFAULT_AI_PER_DAY;
  const value = Number(text);
  return Number.isSafeInteger(value) && value >= 1 ? value : DEFAULT_AI_PER_DAY;
}

/** 呼んでよければ 1 回分を数えて true。上限（学級ごと・全体のどちらか）なら数えず false */
export function createAiQuota(limit: number = DEFAULT_AI_PER_DAY, now: () => Date = () => new Date(), total?: DailyTotal): AiQuota {
  const used = new Map<string, number>();
  let day = "";
  return {
    take(workspaceId) {
      if (workspaceId === DEMO_WORKSPACE_ID) return true;
      const today = new Date(now().getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
      // 日が変わったら、前の日の分は捨てる（学級の数だけ溜まり続けない）
      if (today !== day) {
        used.clear();
        day = today;
      }
      const count = used.get(workspaceId) ?? 0;
      if (count >= limit || total?.available(now()) === false) return false;
      used.set(workspaceId, count + 1);
      total?.add(now());
      return true;
    },
  };
}
