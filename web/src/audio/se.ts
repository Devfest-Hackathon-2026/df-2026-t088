// 効果音（D-90）。音の素材は使わず、Web Audio の発振器でその場で作る（ライセンスの確認も読み込みも要らない）。
// 音の高さと刻みは BGM に合わせてある（下の SE_SOUNDS の説明）。
// BGM と同じ AudioContext を使い、音のボタン（CMP-016）で BGM と一緒に消える。
import type { LessonSession } from "../lesson/session";

export type SeKind = "select" | "tap" | "enter" | "back" | "locked" | "place" | "solved" | "correct" | "wrong" | "clear" | "shutter" | "print";

/** 1つの音。t は鳴らし始めからの秒、d は長さ（秒）、to は終わりの高さ（滑らせる時だけ） */
export interface SeNote {
  hz: number;
  t: number;
  d: number;
  gain?: number;
  to?: number;
}

// BGM（bgm-island.wav）に合わせる。ハ長調、テンポ 120（16分音符 = 0.125 秒）で、倍音の少ない澄んだ音が
// 0.4 秒ほどで消える。冒頭の旋律は E5 → G5。効果音もハ長調の五音（ド・レ・ミ・ソ・ラ）だけを使い、
// 同じ音色（正弦波）と消え方、同じ刻みで鳴らして、曲の続きに聞こえるようにする（D-90）
const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** "E5" のような音名を周波数に直す（A4 = 440Hz） */
export const hzOf = (name: string): number => {
  const midi = NOTE_INDEX[name[0]] + (Number(name.slice(1)) + 1) * 12;
  return 440 * 2 ** ((midi - 69) / 12);
};
const STEP = 0.125;
const note = (name: string, step: number, d: number, gain = 1): SeNote => ({ hz: hzOf(name), t: step * STEP, d, gain });

/** タイルを置くたびに、ド・レ・ミ・ソ・ラと 1 音ずつ上がる（置いた数が分かる） */
export const PLACE_SCALE = ["C5", "D5", "E5", "G5", "A5", "C6", "D6", "E6"] as const;

export const SE_SOUNDS: Readonly<Record<Exclude<SeKind, "place">, readonly SeNote[]>> = {
  // ボタンを押して選んだ（D-104）。たくさんのボタンで鳴るので、高いミを短く小さく 1 回だけ
  select: [note("E6", 0, 0.08, 0.45)],
  // 開いた島を押した。BGM の冒頭と同じ E5 → G5
  tap: [note("E5", 0, 0.18, 0.8), note("G5", 0.5, 0.3)],
  // 島に寄り切って、その島へ入る（決定）。ソとドを重ねて短く、続けてドとミを重ねて長めに残す（D-101）。
  // 押した音（ミ → ソ）の続きで和音に着地し、旋律で上がる正解や最後の音とは形を変える
  enter: [
    note("G5", 0, 0.12, 0.6),
    note("C6", 0, 0.12, 0.5),
    note("C6", 1, 0.45, 0.6),
    note("E6", 1, 0.45, 0.5),
  ],
  // 海の幕で前の画面へ戻る（D-104、D-103）。ドからソへ下がる。ちがう（レ → ラ）より高く短くして聞き分ける
  back: [note("C6", 0, 0.1, 0.55), note("G5", 0.5, 0.25, 0.6)],
  // 鍵の島を押した。低めのソを短く 2 回（まだ入れない、を責めずに伝える。タブレットの小さいスピーカーでも聞こえる高さ）
  locked: [note("G4", 0, 0.12, 0.7), note("G4", 1, 0.14, 0.55)],
  // タイルで答えの形が作れた。きらっと上がる
  solved: [note("G5", 0, 0.2, 0.55), note("A5", 0.5, 0.2, 0.55), note("C6", 1, 0.2, 0.55), note("E6", 1.5, 0.4, 0.55)],
  // 正解。E5 → G5 → C6 と、BGM の旋律の形で上がる
  correct: [note("E5", 0, 0.2, 0.8), note("G5", 1, 0.2, 0.9), note("C6", 2, 0.45)],
  // ちがった。和音から外れない音で、下がって止まる。小さく短い
  wrong: [note("D5", 0, 0.22, 0.45), note("A4", 1, 0.35, 0.4)],
  // 最後の問題まで解けた。ド・ミ・ソ・ドと上がり、最後はドとミを重ねて少し長く残す
  clear: [
    note("C5", 0, 0.2, 0.8),
    note("E5", 1, 0.2, 0.8),
    note("G5", 2, 0.2, 0.85),
    note("C6", 3, 0.55),
    note("E5", 3, 0.55, 0.45),
  ],
  // MOT-030 のカシャ。高い短い音 2 つをほぼ同時に（半拍ずらす）。音の素材が決まるまでの代わり（Q-51）
  shutter: [note("E6", 0, 0.05, 0.7), note("A6", 0.5, 0.06, 0.6)],
  // MOT-030 のういーん。低い音から少しずつ上がる短い音を 5 つ並べて、モーターらしくする。音の素材が決まるまでの代わり（Q-51）
  print: [note("C4", 0, 0.12, 0.4), note("D4", 1, 0.12, 0.4), note("E4", 2, 0.12, 0.4), note("G4", 3, 0.12, 0.4), note("A4", 4, 0.12, 0.4)],
};

/** step 個目に置いたタイルの音（0 から数える） */
export function placeSound(step: number): SeNote[] {
  const i = Math.max(0, Math.min(PLACE_SCALE.length - 1, step));
  return [note(PLACE_SCALE[i], 0, 0.16, 0.6)];
}

/** 効果音の山の大きさ。BGM は山 0.5・平均 0.07 ほどで鳴るので、その上で聞こえ、驚かせない大きさにする */
export const SE_VOLUME = 0.25;
// 立ち上がりは BGM と同じく速く、はじいた音にする
const ATTACK = 0.006;

export interface SeDeps {
  getContext: () => AudioContext | null;
  isMuted: () => boolean;
}

export interface Se {
  /** step は place の時だけ使う。何個目に置いたタイルか（0 から） */
  play: (kind: SeKind, step?: number) => void;
}

/** 鳴らす音の並び */
export function soundOf(kind: SeKind, step = 0): readonly SeNote[] {
  return kind === "place" ? placeSound(step) : SE_SOUNDS[kind];
}

export function createSe(deps: SeDeps): Se {
  return {
    play(kind, step = 0) {
      const ctx = deps.getContext();
      // 最初の操作の前、消してある時、Web Audio が無い端末では鳴らさない
      if (!ctx || deps.isMuted()) return;
      try {
        const start = ctx.currentTime;
        for (const n of soundOf(kind, step)) {
          const at = start + n.t;
          const osc = ctx.createOscillator();
          // BGM の音は倍音がほとんど無いので、正弦波にそろえる
          osc.type = "sine";
          osc.frequency.setValueAtTime(n.hz, at);
          if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, at + n.d);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0, at);
          gain.gain.linearRampToValueAtTime(SE_VOLUME * (n.gain ?? 1), at + ATTACK);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + n.d);
          osc.connect(gain).connect(ctx.destination);
          osc.start(at);
          osc.stop(at + n.d + 0.02);
        }
      } catch {
        // 音が鳴らなくても遊べるので、知らせずに黙る
      }
    },
  };
}

/** 答えた後の状態から、鳴らす効果音を決める。空欄や形の注意（約分など）では鳴らさない */
export function seForAnswer(next: Pick<LessonSession, "isCorrect" | "isCleared" | "message">): SeKind | null {
  if (next.isCorrect) return next.isCleared ? "clear" : "correct";
  switch (next.message) {
    case "wrong":
    case "wrongToTiles":
    case "wrongToHints":
    case "wrongInReview":
    case "alignedWrong":
      return "wrong";
    case "alignedRight":
      return "correct";
    default:
      return null;
  }
}
