import { useEffect } from "react";
import { tokenMs } from "./pages/island-map/diorama/use-diorama";

// index.html の #loading（CMP-012）を出す・消す。絵と文言は index.html にある
// 保持が1つでもある間は出し続ける。最初の1つは起動の分
let holds = 1;
let bootReleased = false;
let startedAt = (typeof performance !== "undefined" && performance.getEntriesByName("loading-start")[0]?.startTime) || 0;
const timers = new Set<ReturnType<typeof setTimeout>>();

const element = (): HTMLElement | null => document.getElementById("loading");

function later(run: () => void, ms: number) {
  const id = setTimeout(() => {
    timers.delete(id);
    run();
  }, ms);
  timers.add(id);
}

function hide() {
  const el = element();
  if (!el || holds > 0) return;
  const elapsed = performance.now() - startedAt;
  // まだ見えていなければ、薄くせずにすぐ消す
  if (elapsed < tokenMs("--delay-loading", 300)) {
    el.hidden = true;
    return;
  }
  el.classList.add("is-leaving");
  later(() => {
    el.hidden = true;
    el.classList.remove("is-leaving");
  }, tokenMs("--duration-normal", 180));
}

export function holdLoading(): void {
  holds += 1;
  for (const id of timers) clearTimeout(id);
  timers.clear();
  const el = element();
  // すでに出ている時は触らない（絵を最初に戻さない）
  if (el && (el.hidden || el.classList.contains("is-leaving"))) {
    el.hidden = false;
    el.classList.remove("is-leaving");
    startedAt = performance.now();
  }
}

export function releaseLoading(): void {
  if (holds === 0) return;
  holds -= 1;
  if (holds > 0) return;
  const elapsed = performance.now() - startedAt;
  const delay = tokenMs("--delay-loading", 300);
  const min = tokenMs("--duration-loading-min", 500);
  const wait = elapsed < delay ? 0 : Math.max(0, delay + min - elapsed);
  // 0 でもタイマーを通す。StrictMode の片付けと再実行の間に hold が来ても取り消せる
  later(hide, wait);
}

export function releaseBoot(): void {
  if (bootReleased) return;
  bootReleased = true;
  releaseLoading();
}

/** active の間だけ出し続ける */
export function useLoading(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    holdLoading();
    return releaseLoading;
  }, [active]);
}
