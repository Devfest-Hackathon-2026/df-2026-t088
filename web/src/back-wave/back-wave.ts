import { playSe } from "../audio/use-bgm";
import { reducesMotion, tokenMs } from "../pages/island-map/diorama/use-diorama";

// MOT-024「海の幕」の制御（D-103）。戻る操作はここを通す。ブラウザの戻る（popstate）は通さない
const WAVE_COUNT = 3;
const FALLBACK_WAVE_MS = 3000;
// 波ごとの遅れ（全長に対する割合。D-240）。3枚目が覆い切るのは p = 0.2 + 0.5 × 0.8
const STAGGER = 0.1;
const SPAN = 1 - STAGGER * (WAVE_COUNT - 1);
export const COVERED_AT = STAGGER * (WAVE_COUNT - 1) + 0.5 * SPAN;

const easeInOut = (p: number): number => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/** i 枚目の波の clip-path。p は全体の進み（0〜1）。縁は縦に正弦で波打つ */
export function waveClip(i: number, p: number, width: number, height: number): string {
  const amp = Math.min(40, width * 0.045);
  const q = Math.min(1, Math.max(0, (p - i * STAGGER) / SPAN));
  // 前半で左端が右から左へ（覆う）、後半で右端が右から左へ抜ける（引く）
  const inP = easeInOut(Math.min(1, q * 2));
  const outP = easeInOut(Math.max(0, q * 2 - 1));
  const left = (width + amp * 2) * (1 - inP) - amp;
  const right = (width + amp * 2) * (1 - outP) - amp;
  const phase = q * 10 + i;
  const steps = 40;
  const points: string[] = [];
  for (let k = 0; k <= steps; k++) {
    const y = (height * k) / steps;
    points.push(`${left + amp * Math.sin(y / 80 + phase)}px ${y}px`);
  }
  for (let k = steps; k >= 0; k--) {
    const y = (height * k) / steps;
    points.push(`${outP <= 0 ? width + 80 : right + amp * Math.sin(y / 80 + phase + 1.5)}px ${y}px`);
  }
  return `polygon(${points.join(",")})`;
}

interface Run {
  /** wave は MOT-024、fade は MOT-032（D-251） */
  kind: RunKind;
  covered: boolean;
  onCovered: () => void;
  onDone?: () => void;
  waitForRelease: boolean;
  /** 待つ理由の数。0 になると解放。StrictMode の二重実行でも正味の数が残るよう、印でなく数にする */
  holds: number;
  /** 12秒の安全解放が働いた */
  timedOut: boolean;
  /** 待っている間（打ち寄せ中）の始まりの時刻。待っていなければ null */
  holdStart: number | null;
  /** 待つのは1回だけ。待ち終えた後に、もう一度は待たない */
  held: boolean;
  /** 基の3枚の始まりの時刻。待ち終えたら、COVERED_AT の位置から引けるよう取り直す */
  start: number;
}

export interface BackWaveOptions {
  /** 覆った後、holdBackWave の理由が無くなるまで波が覆ったまま打ち寄せ続ける（D-141） */
  waitForRelease?: boolean;
}

// 待つ上限。島の地図の 10 秒の平面切り替え（D-141）より後に置く
const MAX_HOLD_MS = 12_000;

export type RunKind = "wave" | "fade";

let current: Run | null = null;
let raf = 0;
const activeListeners = new Set<() => void>();
// lap は打ち寄せの進み（0〜COVERED_AT）。打ち寄せていない時は null
type FrameListener = (p: number, lap: number | null) => void;
const frameListeners = new Set<FrameListener>();

const notifyActive = () => activeListeners.forEach((listener) => listener());

export const subscribeActive = (listener: () => void): (() => void) => {
  activeListeners.add(listener);
  return () => { activeListeners.delete(listener); };
};
export const isActive = (): boolean => current !== null;
/** 動いている幕の種類。動いていなければ null */
export const activeKind = (): RunKind | null => current?.kind ?? null;
export const subscribeFrame = (listener: FrameListener): (() => void) => {
  frameListeners.add(listener);
  return () => { frameListeners.delete(listener); };
};
const notifyFrame = (p: number, lap: number | null) => frameListeners.forEach((listener) => listener(p, lap));

function cover(run: Run) {
  if (run.covered) return;
  run.covered = true;
  run.onCovered();
}

function finish(run: Run) {
  cover(run);
  if (current === run) {
    current = null;
    cancelAnimationFrame(raf);
    notifyActive();
  }
  run.onDone?.();
}

/**
 * 波を覆ったまま待たせる理由を1つ足し、外す関数を返す（1回だけ効く）。待つ run でなければ、
 * また引き始めた後は何もしない関数を返す。覆った時に理由が0なら、いつもの動き
 */
export function holdBackWave(): () => void {
  const run = current;
  if (!run?.waitForRelease || (run.held && run.holdStart === null)) return () => {};
  run.holds += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    run.holds -= 1;
  };
}

/**
 * 海の幕を出す。覆い切った時に onCovered（ここで道を替える）、引き終わった時に onDone。
 * 動いている途中で次が来たら、今の動きを最後まで飛ばしてから始める。動きを減らす設定では即座に続けて呼ぶ。
 * waitForRelease なら、覆った後は 理由が無くなるまで打ち寄せ続け、寄せている1回を覆い切ってから引く
 */
export function playBackWave(onCovered: () => void, onDone?: () => void, options: BackWaveOptions = {}): void {
  // 戻る音（D-104）。戻る操作はここを通るので、ボタンの側では鳴らさない。打ち寄せでは鳴らさない
  playSe("back");
  if (current) finish(current);
  const run: Run = {
    kind: "wave", covered: false, onCovered, onDone,
    waitForRelease: options.waitForRelease === true, holds: 0, timedOut: false, holdStart: null, held: false, start: 0,
  };
  if (reducesMotion()) {
    cover(run);
    run.onDone?.();
    return;
  }
  current = run;
  notifyActive();
  const total = tokenMs("--duration-wave", FALLBACK_WAVE_MS);
  run.start = performance.now();
  const step = (now: number) => {
    if (current !== run) return;
    if (run.holdStart !== null) {
      // 打ち寄せ：1回は total の長さ。最初の COVERED_AT 分で 0 から COVERED_AT へ進み、残りは覆ったまま
      const elapsed = now - run.holdStart;
      if (elapsed >= MAX_HOLD_MS) run.timedOut = true;
      const released = run.timedOut || run.holds <= 0;
      const lap = Math.min(COVERED_AT, (elapsed % total) / total);
      if (released && lap >= COVERED_AT) {
        // 覆い切っている。打ち寄せの層を消し、基の3枚を COVERED_AT から引く
        run.holdStart = null;
        run.start = now - COVERED_AT * total;
        notifyFrame(COVERED_AT, null);
      } else {
        notifyFrame(COVERED_AT, lap);
      }
      raf = requestAnimationFrame(step);
      return;
    }
    const p = Math.min(1, (now - run.start) / total);
    if (p >= COVERED_AT) {
      cover(run);
      if (run.waitForRelease && run.holds > 0 && !run.held) {
        run.held = true;
        run.holdStart = now;
        notifyFrame(COVERED_AT, 0);
        raf = requestAnimationFrame(step);
        return;
      }
    }
    notifyFrame(p, null);
    if (p >= 1) finish(run);
    else raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

const FALLBACK_FADE_MS = 180;

/**
 * MOT-032「紙の幕」（D-251）。3D の島の地図へ戻らない戻る操作はここを通す。紙の色の面が --duration-normal で出て、
 * 覆い切った時に onCovered（ここで道を替える）、--duration-normal で消えた時に onDone。戻る音、途中で次が来た時、
 * 動きを減らす設定の扱いは playBackWave と同じ。p は全体の進み（0〜1）で、0.5 で覆い切る
 */
export function playBackFade(onCovered: () => void, onDone?: () => void): void {
  playSe("back");
  if (current) finish(current);
  const run: Run = {
    kind: "fade", covered: false, onCovered, onDone,
    waitForRelease: false, holds: 0, timedOut: false, holdStart: null, held: false, start: 0,
  };
  if (reducesMotion()) {
    cover(run);
    run.onDone?.();
    return;
  }
  current = run;
  notifyActive();
  const total = tokenMs("--duration-normal", FALLBACK_FADE_MS) * 2;
  run.start = performance.now();
  const step = (now: number) => {
    if (current !== run) return;
    const p = Math.min(1, (now - run.start) / total);
    if (p >= 0.5) cover(run);
    notifyFrame(p, null);
    if (p >= 1) finish(run);
    else raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

