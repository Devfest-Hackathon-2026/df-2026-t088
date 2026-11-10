// 出題表の差し込み口（09_api.md の loadPlanOverrides）。今は何も差し込まない。のちに先生の画面や AI からの値を読む
import type { PlanEntry, PlanOverrides } from "./makers/types";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isEntry = (value: unknown): value is PlanEntry => isRecord(value) && typeof value.maker === "string" && Array.isArray(value.args);

/** 受け取った値の形を確かめる。オブジェクトでなければ {}、配列でない学習・形の違う行は捨てる。数の範囲は組み立ての時に確かめる */
export function sanitizeOverrides(value: unknown): PlanOverrides {
  const overrides: PlanOverrides = {};
  if (!isRecord(value)) return overrides;
  for (const [planId, entries] of Object.entries(value)) {
    if (!Array.isArray(entries)) continue;
    overrides[planId] = entries.filter(isEntry).map(({ maker, args }) => ({ maker, args }));
  }
  return overrides;
}

/** 差し込みの出題表を読む。失敗したら {} */
export async function loadPlanOverrides(): Promise<PlanOverrides> {
  try {
    return sanitizeOverrides({});
  } catch {
    return {};
  }
}

let current: PlanOverrides = {};
let loading: Promise<void> | null = null;

/** アプリの起動の時に1回読んで覚える。何度呼んでも読むのは1回 */
export function initPlanOverrides(): Promise<void> {
  loading ??= loadPlanOverrides().then((overrides) => { current = overrides; });
  return loading;
}

/** 覚えた差し込み。読む前は {}。同じ値の間は同じオブジェクトを返す */
export const currentPlanOverrides = (): PlanOverrides => current;

/** テスト用。覚えた値を戻す */
export function resetPlanOverrides(): void {
  current = {};
  loading = null;
}
