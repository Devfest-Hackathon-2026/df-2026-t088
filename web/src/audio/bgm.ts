// BGM（D-87）。Web Audio で繰り返し鳴らす。<audio> はつなぎ目に隙間が出るので使わない。
// ブラウザは操作の前に音を出せないので、最初に押したかキーを打った時に鳴り始める。

export type BgmTrack = "island" | "lesson";

const FILES: Record<BgmTrack, string> = {
  island: "audio/bgm-island.wav",
  lesson: "audio/bgm-lesson.wav",
};

export const MUTED_KEY = "sugoroku:bgm-muted";
/** BGM の大きさ（0〜1）を残すキー（D-203）。ログインとは別に端末に残すので、ログアウトしても消えない */
export const VOLUME_KEY = "sugoroku:bgm-volume";
/** 曲を入れ替える秒（D-87） */
export const FADE_SECONDS = 0.6;
/** 鳴らす大きさの初め。学習の曲は書き出しの時点で小さくしてある。音量のバー（D-203）で 0〜1 に変えられる */
export const VOLUME = 0.5;

/** テストで差し替えられるように、使う道具をまとめて渡す */
export interface BgmDeps {
  createContext: () => AudioContext;
  load: (url: string) => Promise<ArrayBuffer>;
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  baseUrl: string;
}

export interface Bgm {
  /** 今の画面の曲を決める。鳴り始める前に呼んでもよい */
  setTrack: (track: BgmTrack) => void;
  /** 最初の操作で呼ぶ。2回目からは何もしない */
  unlock: () => void;
  setMuted: (muted: boolean) => void;
  isMuted: () => boolean;
  /** BGM の大きさ（0〜1、D-203）。効果音は変えない */
  setVolume: (volume: number) => void;
  getVolume: () => number;
  subscribe: (onChange: () => void) => () => void;
  /** 鳴らし始めた後の AudioContext。効果音（se.ts）が同じものを使う。最初の操作の前は null */
  getContext: () => AudioContext | null;
}

interface Playing {
  track: BgmTrack;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export function createBgm(deps: BgmDeps): Bgm {
  const listeners = new Set<() => void>();
  const buffers = new Map<BgmTrack, Promise<AudioBuffer>>();
  let muted = readMuted(deps.storage);
  let volume = readVolume(deps.storage);
  let wanted: BgmTrack | null = null;
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let playing: Playing | null = null;

  const bufferOf = (ctx: AudioContext, track: BgmTrack): Promise<AudioBuffer> => {
    let pending = buffers.get(track);
    if (!pending) {
      pending = deps.load(deps.baseUrl + FILES[track]).then((data) => ctx.decodeAudioData(data));
      // 読めなかった時は次の機会にもう一度読む
      pending.catch(() => buffers.delete(track));
      buffers.set(track, pending);
    }
    return pending;
  };

  const fadeOut = (old: Playing, ctx: AudioContext) => {
    const now = ctx.currentTime;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
    old.source.stop(now + FADE_SECONDS);
  };

  const play = async (track: BgmTrack) => {
    const ctx = context;
    if (!ctx || !master || playing?.track === track) return;
    let buffer: AudioBuffer;
    try {
      buffer = await bufferOf(ctx, track);
    } catch {
      return; // 音が無くても遊べるので、知らせずに黙る
    }
    // 読む間に別の画面へ移っていたら鳴らさない
    if (wanted !== track || playing?.track === track) return;

    if (playing) fadeOut(playing, ctx);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE_SECONDS);
    source.connect(gain).connect(master);
    source.start(now);
    playing = { track, source, gain };
  };

  const notify = () => listeners.forEach((listener) => listener());

  // 消す・出す・大きさを変えた時に、ぷつっと鳴らないよう 0.15 秒で寄せる
  const rampMaster = () => {
    if (!context || !master) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(muted ? 0 : volume, now + 0.15);
  };

  const applyMuted = (next: boolean) => {
    if (next === muted) return;
    muted = next;
    try {
      deps.storage?.setItem(MUTED_KEY, next ? "1" : "0");
    } catch {
      // 残せなくても今の画面では効く
    }
    rampMaster();
    notify();
  };

  return {
    setTrack(track) {
      wanted = track;
      void play(track);
    },
    unlock() {
      if (context) return;
      try {
        context = deps.createContext();
      } catch {
        return; // Web Audio が無い端末では鳴らさない
      }
      master = context.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(context.destination);
      void context.resume?.();
      if (wanted) void play(wanted);
    },
    setMuted: applyMuted,
    isMuted: () => muted,
    setVolume(next) {
      const clamped = clampVolume(next);
      // 左いっぱい（0）は「消す」と同じにする。大きさは前のまま残し、ボタンで出した時にその大きさへ戻す
      if (clamped === 0) {
        applyMuted(true);
        return;
      }
      // 消してある時にバーを動かしたら、音を出す（動かしたのに聞こえないと分からない）
      const unmute = muted;
      if (clamped === volume && !unmute) return;
      volume = clamped;
      try {
        deps.storage?.setItem(VOLUME_KEY, String(clamped));
        if (unmute) deps.storage?.setItem(MUTED_KEY, "0");
      } catch {
        // 残せなくても今の画面では効く
      }
      if (unmute) muted = false;
      rampMaster();
      notify();
    },
    getVolume: () => volume,
    getContext: () => context,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}

function readMuted(storage: BgmDeps["storage"]): boolean {
  try {
    return storage?.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return VOLUME;
  return Math.min(1, Math.max(0, value));
}

function readVolume(storage: BgmDeps["storage"]): number {
  try {
    const saved = storage?.getItem(VOLUME_KEY);
    if (saved == null || saved === "") return VOLUME;
    const value = clampVolume(Number(saved));
    // 0 は残さない決まり（0 は「消す」）。手で入れられた 0 は初めの大きさにする
    return value > 0 ? value : VOLUME;
  } catch {
    return VOLUME;
  }
}

/** 道から曲を決める。学習の画面だけ静かな曲 */
export function trackOf(path: string): BgmTrack {
  return path.startsWith("/sansu/lesson/") || /^\/kokugo\/[a-z0-9-]+\/lesson\//.test(path) ? "lesson" : "island";
}
