import { useEffect, useSyncExternalStore } from "react";
import { createBgm, trackOf } from "./bgm";
import type { Bgm } from "./bgm";
import { createSe } from "./se";
import type { Se, SeKind } from "./se";

let shared: Bgm | null = null;

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** アプリで1つだけ持つ。初めて使う時に作る */
export function getBgm(): Bgm {
  if (!shared) {
    shared = createBgm({
      createContext: () => new AudioContext(),
      load: (url) => fetch(url).then((response) => {
        if (!response.ok) throw new Error(`BGM を読めませんでした: ${url}`);
        return response.arrayBuffer();
      }),
      storage: safeStorage(),
      baseUrl: import.meta.env.BASE_URL,
    });
  }
  return shared;
}

let sharedSe: Se | null = null;

/** 効果音を鳴らす（D-90）。BGM と同じ AudioContext と、同じ「音を消す」を使う */
export function playSe(kind: SeKind, step?: number): void {
  sharedSe ??= createSe({ getContext: () => getBgm().getContext(), isMuted: () => getBgm().isMuted() });
  sharedSe.play(kind, step);
}

/** テストで作り直す時だけ使う */
export function setBgmForTest(bgm: Bgm | null): void {
  shared = bgm;
}

const GESTURES = ["pointerdown", "keydown"] as const;

/** 今の道に合う曲を鳴らす。最初の操作で鳴り始める（D-87） */
export function useBgm(path: string): void {
  const track = trackOf(path);

  useEffect(() => {
    const bgm = getBgm();
    const unlock = () => {
      bgm.unlock();
      GESTURES.forEach((type) => window.removeEventListener(type, unlock, true));
    };
    GESTURES.forEach((type) => window.addEventListener(type, unlock, true));
    return () => GESTURES.forEach((type) => window.removeEventListener(type, unlock, true));
  }, []);

  useEffect(() => {
    getBgm().setTrack(track);
  }, [track]);
}

/** 消してあるか。音のボタン（CMP-016）が使う */
export function useBgmMuted(): [boolean, (muted: boolean) => void] {
  const bgm = getBgm();
  const muted = useSyncExternalStore(bgm.subscribe, bgm.isMuted);
  return [muted, bgm.setMuted];
}

/** BGM の大きさ（0〜1）。音のボタンのバー（CMP-016、D-203）が使う */
export function useBgmVolume(): [number, (volume: number) => void] {
  const bgm = getBgm();
  const volume = useSyncExternalStore(bgm.subscribe, bgm.getVolume);
  return [volume, bgm.setVolume];
}
