import { useLayoutEffect } from "react";
import type { RefObject } from "react";

/** 767px 以下で下に固定するボタンの列（.lesson-actions）の高さを --lesson-actions-height に入れる。
 * 答えの欄も下に固定するので、ボタンの列の上に重ねて留めるのに使う（D-238）。列は画面の状態で出たり消えたりするので、main の中の変化も見る */
export function usePinnedActionsHeight(mainRef: RefObject<HTMLElement | null>, isOn: boolean) {
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main || !isOn || typeof ResizeObserver === "undefined") return undefined;
    let watched: HTMLElement | null = null;
    const update = () => {
      const actions = main.querySelector<HTMLElement>(".lesson-actions");
      main.style.setProperty("--lesson-actions-height", `${actions && getComputedStyle(actions).position === "sticky" ? actions.offsetHeight : 0}px`);
      if (actions !== watched) {
        if (watched) sizes.unobserve(watched);
        if (actions) sizes.observe(actions);
        watched = actions;
      }
    };
    const sizes = new ResizeObserver(update);
    const changes = new MutationObserver(update);
    changes.observe(main, { childList: true, subtree: true });
    update();
    return () => {
      sizes.disconnect();
      changes.disconnect();
      main.style.removeProperty("--lesson-actions-height");
    };
  }, [mainRef, isOn]);
}
