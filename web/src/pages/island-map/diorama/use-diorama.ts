import { useEffect, useState } from "react";
import type { CreateDiorama } from "./engine-api";

// three を含む scene.ts は、使える時だけ1回読み込んで覚えておく
let cached: CreateDiorama | null = null;
let pending: Promise<CreateDiorama | null> | null = null;

export const cachedDiorama = (): CreateDiorama | null => cached;

export function loadDioramaScene(): Promise<CreateDiorama | null> {
  // 読み込みに失敗しても平面の地図で遊べるので、理由は問わず null にする
  pending ??= import("./scene").then((m) => (cached = m.createDiorama)).catch(() => null);
  return pending;
}

export const reducesMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * WebGL2 が使えそうか。型の有無だけを見る。試しにコンテキストを作ると 1回で 200ms 以上メインスレッドを止め、
 * CMP-012 と波が止まる（D-142）。作れない環境では 3D の組み立てが失敗し、平面の地図に替わる
 */
export function hasWebGL2(): boolean {
  return typeof WebGL2RenderingContext !== "undefined";
}

/** CSS のトークン（ms か s）をミリ秒で読む */
export function tokenMs(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  if (Number.isNaN(value)) return fallback;
  return raw.endsWith("ms") ? value : value * 1000;
}

// 3D の読み込みを待つ上限（D-42）
const LOAD_TIMEOUT_MS = 10_000;

interface Options {
  enabled: boolean;
  load: () => Promise<CreateDiorama | null>;
  /** すでに読み込み済みの時はそれを最初から使う */
  initial: CreateDiorama | null;
}

/** createDiorama を後から手に入れる。読み込み中は create が null、失敗すると failed が true になる */
export function useDioramaCreate({ enabled, load, initial }: Options): { create: CreateDiorama | null; failed: boolean } {
  // 関数をそのまま state に入れると呼ばれてしまうので包む
  const [box, setBox] = useState<{ create: CreateDiorama } | null>(initial ? { create: initial } : null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled || initial) return;
    let live = true;
    // 時間切れの後に読み込めても、この回は 3D へ入れ替えない（cached は残る）
    const timeout = setTimeout(() => {
      live = false;
      setFailed(true);
    }, LOAD_TIMEOUT_MS);
    load()
      .catch(() => null)
      .then((create) => {
        if (!live) return;
        clearTimeout(timeout);
        if (create) setBox({ create });
        else setFailed(true);
      });
    return () => {
      live = false;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return { create: box?.create ?? null, failed };
}
