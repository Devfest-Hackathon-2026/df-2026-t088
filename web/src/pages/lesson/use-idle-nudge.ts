import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/** 何も操作しないまま、この時間が過ぎたら声をかける（D-124） */
export const IDLE_NUDGE_MS = 30_000;

// 押す、打つ、ドラッグを始める。どれも操作したとみなす
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "input"] as const;

/**
 * 手が止まったことを知らせる。1つの問題で1回だけ true になり、どこかを操作すると false にもどる。
 * enabled が false の間は数えない。resetKey が変わると、数え直す
 */
export function useIdleNudge(rootRef: RefObject<HTMLElement | null>, enabled: boolean, problemKey: string, resetKey: unknown): boolean {
  const [shownKey, setShownKey] = useState<string | null>(null);
  // 同じ問題で2度は言わない。しつこいと、さりげなくなくなる
  const firedKey = useRef<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      if (!enabled || firedKey.current === problemKey) return;
      timer = setTimeout(() => {
        firedKey.current = problemKey;
        setShownKey(problemKey);
      }, IDLE_NUDGE_MS);
    };
    const onActivity = () => {
      setShownKey(null);
      arm();
    };
    arm();
    for (const name of ACTIVITY_EVENTS) root.addEventListener(name, onActivity, true);
    return () => {
      clearTimeout(timer);
      for (const name of ACTIVITY_EVENTS) root.removeEventListener(name, onActivity, true);
    };
  }, [rootRef, enabled, problemKey, resetKey]);

  return enabled && shownKey === problemKey;
}
