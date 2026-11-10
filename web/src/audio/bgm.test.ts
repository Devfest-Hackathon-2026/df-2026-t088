import { describe, expect, it, vi } from "vitest";
import { createBgm, MUTED_KEY, trackOf, VOLUME, VOLUME_KEY } from "./bgm";
import type { BgmDeps } from "./bgm";

// Web Audio の代わり。鳴らした曲と、音量の動きだけを記録する
function fakeAudio() {
  const started: { url: string; stopped: boolean; loop: boolean }[] = [];
  const gains: { value: number }[] = [];
  const makeGain = () => {
    const record = { value: 1 };
    gains.push(record);
    const param = {
      get value() { return record.value; },
      set value(v: number) { record.value = v; },
      setValueAtTime: (v: number) => { record.value = v; },
      linearRampToValueAtTime: (v: number) => { record.value = v; },
      cancelScheduledValues: () => undefined,
    };
    return { gain: param, connect: (node: unknown) => node };
  };
  const context = {
    currentTime: 0,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createGain: makeGain,
    decodeAudioData: (data: ArrayBuffer) => Promise.resolve({ url: new TextDecoder().decode(data) }),
    createBufferSource: () => {
      const entry = { url: "", stopped: false, loop: false };
      return {
        set buffer(b: { url: string }) { entry.url = b.url; },
        set loop(v: boolean) { entry.loop = v; },
        connect: (node: unknown) => node,
        start: () => { started.push(entry); },
        stop: () => { entry.stopped = true; },
      };
    },
  };
  return { context, started, gains };
}

const encode = (url: string) => Promise.resolve(new TextEncoder().encode(url).buffer as ArrayBuffer);

function setup(stored: Record<string, string> = {}) {
  const audio = fakeAudio();
  const store = new Map(Object.entries(stored));
  const createContext = vi.fn(() => audio.context as unknown as AudioContext);
  const deps: BgmDeps = {
    createContext,
    load: encode,
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); } },
    baseUrl: "/",
  };
  return { bgm: createBgm(deps), audio, store, createContext };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("BGM（D-87）", () => {
  it("学習の道だけ静かな曲にする", () => {
    expect(trackOf("/home")).toBe("island");
    expect(trackOf("/sansu")).toBe("island");
    expect(trackOf("/sansu/fraction")).toBe("island");
    expect(trackOf("/sansu/lesson/main-3")).toBe("lesson");
    expect(trackOf("/kokugo/kokugo-kanji-5/lesson/main-0")).toBe("lesson");
  });

  it("最初の操作までは鳴らさず、操作したら今の画面の曲を繰り返す", async () => {
    const { bgm, audio, createContext } = setup();
    bgm.setTrack("island");
    await flush();
    expect(createContext).not.toHaveBeenCalled();
    expect(audio.started).toHaveLength(0);

    bgm.unlock();
    await flush();
    expect(audio.started).toEqual([{ url: "/audio/bgm-island.wav", stopped: false, loop: true }]);
    expect(audio.context.resume).toHaveBeenCalled();
  });

  it("2回目の操作では作り直さない", () => {
    const { bgm, createContext } = setup();
    bgm.unlock();
    bgm.unlock();
    expect(createContext).toHaveBeenCalledTimes(1);
  });

  it("学習へ移ると、前の曲を止めて静かな曲に入れ替える", async () => {
    const { bgm, audio } = setup();
    bgm.setTrack("island");
    bgm.unlock();
    await flush();
    bgm.setTrack("lesson");
    await flush();
    expect(audio.started.map((s) => s.url)).toEqual(["/audio/bgm-island.wav", "/audio/bgm-lesson.wav"]);
    expect(audio.started[0]?.stopped).toBe(true);
    expect(audio.started[1]?.stopped).toBe(false);
  });

  it("同じ曲の画面どうしで移っても、頭から鳴らし直さない", async () => {
    const { bgm, audio } = setup();
    bgm.setTrack("island");
    bgm.unlock();
    await flush();
    bgm.setTrack("island");
    await flush();
    expect(audio.started).toHaveLength(1);
  });

  it("読む間に画面が変わったら、古い曲は鳴らさない", async () => {
    const { bgm, audio } = setup();
    bgm.unlock();
    bgm.setTrack("island");
    bgm.setTrack("lesson");
    await flush();
    expect(audio.started.map((s) => s.url)).toEqual(["/audio/bgm-lesson.wav"]);
  });

  it("消すと音量を0にして端末に残し、出すと元の大きさに戻す", async () => {
    const { bgm, audio, store } = setup();
    const onChange = vi.fn();
    bgm.subscribe(onChange);
    bgm.setTrack("island");
    bgm.unlock();
    await flush();
    const master = audio.gains[0];
    expect(master?.value).toBe(VOLUME);

    bgm.setMuted(true);
    expect(bgm.isMuted()).toBe(true);
    expect(master?.value).toBe(0);
    expect(store.get(MUTED_KEY)).toBe("1");
    expect(onChange).toHaveBeenCalledTimes(1);

    bgm.setMuted(false);
    expect(master?.value).toBe(VOLUME);
    expect(store.get(MUTED_KEY)).toBe("0");
  });

  it("大きさを変えると音量に効かせて端末に残す（D-203）", async () => {
    const { bgm, audio, store } = setup();
    bgm.setTrack("island");
    bgm.unlock();
    await flush();
    const master = audio.gains[0];

    bgm.setVolume(0.8);
    expect(bgm.getVolume()).toBe(0.8);
    expect(master?.value).toBe(0.8);
    expect(store.get(VOLUME_KEY)).toBe("0.8");

    // 消して出しても、選んだ大きさに戻る
    bgm.setMuted(true);
    bgm.setMuted(false);
    expect(master?.value).toBe(0.8);
  });

  it("前に選んだ大きさで鳴り始める。読めない値は初めの大きさにする", () => {
    const saved = setup({ [VOLUME_KEY]: "0.3" });
    saved.bgm.unlock();
    expect(saved.bgm.getVolume()).toBe(0.3);
    expect(saved.audio.gains[0]?.value).toBe(0.3);

    expect(setup({ [VOLUME_KEY]: "abc" }).bgm.getVolume()).toBe(VOLUME);
    expect(setup({ [VOLUME_KEY]: "5" }).bgm.getVolume()).toBe(1);
    expect(setup({ [VOLUME_KEY]: "0" }).bgm.getVolume()).toBe(VOLUME);
  });

  it("消してある時にバーを動かすと、音を出す", () => {
    const { bgm, store } = setup({ [MUTED_KEY]: "1" });
    bgm.setVolume(0.6);
    expect(bgm.isMuted()).toBe(false);
    expect(store.get(MUTED_KEY)).toBe("0");
  });

  it("バーを左いっぱい（0）にすると消し、出すと前の大きさに戻す", async () => {
    const { bgm, audio, store } = setup({ [VOLUME_KEY]: "0.7" });
    bgm.setTrack("island");
    bgm.unlock();
    await flush();
    const master = audio.gains[0];

    bgm.setVolume(0);
    expect(bgm.isMuted()).toBe(true);
    expect(master?.value).toBe(0);
    expect(store.get(MUTED_KEY)).toBe("1");
    expect(store.get(VOLUME_KEY)).toBe("0.7");

    bgm.setMuted(false);
    expect(master?.value).toBe(0.7);
  });

  it("フックから取り出して呼んでも 0 で消せる", () => {
    const { bgm } = setup();
    const { setVolume } = bgm;
    setVolume(0);
    expect(bgm.isMuted()).toBe(true);
  });

  it("前に消していたら、開いた時から消したまま鳴り始める", () => {
    const { bgm, audio } = setup({ [MUTED_KEY]: "1" });
    expect(bgm.isMuted()).toBe(true);
    bgm.unlock();
    expect(audio.gains[0]?.value).toBe(0);
  });

  it("Web Audio が無い端末では、何も鳴らさず止まらない", () => {
    const broken = createBgm({
      createContext: () => { throw new Error("no audio"); },
      load: () => Promise.reject(new Error("unused")),
      storage: null,
      baseUrl: "/",
    });
    expect(() => broken.unlock()).not.toThrow();
    expect(() => broken.setMuted(true)).not.toThrow();
    expect(broken.isMuted()).toBe(true);
  });

  it("曲を読めなかった時は黙り、次の画面でもう一度読む", async () => {
    const audio = fakeAudio();
    let fail = true;
    const bgm = createBgm({
      createContext: () => audio.context as unknown as AudioContext,
      load: (url) => (fail ? Promise.reject(new Error("404")) : encode(url)),
      storage: null,
      baseUrl: "/",
    });
    bgm.setTrack("island");
    bgm.unlock();
    await flush();
    expect(audio.started).toHaveLength(0);

    fail = false;
    bgm.setTrack("lesson");
    bgm.setTrack("island");
    await flush();
    expect(audio.started.map((s) => s.url)).toEqual(["/audio/bgm-island.wav"]);
  });
});
