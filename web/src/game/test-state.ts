import type { GameState } from "../data";

/** テスト専用。分数の章の途中（小数と式と整数はクリア済み、3マス終了）。分数の動きを確かめる時に使う */
export const MIDWAY_STATE: GameState = {
  chapterId: "fraction",
  takenOff: [],
  xp: { kokugo: 320, sansu: 460, rika: 280, shakai: 360, eigo: 320, ongaku: 0, taiiku: 0, zuko: 0, katei: 0, seikatsu: 0 },
  progress: {
    integer: { done: 5, sides: ["integer-t"], test: true },
    decimal: { done: 7, sides: [], test: true },
    expression: { done: 3, sides: [], test: true },
    fraction: { done: 3, sides: [], test: false },
  },
  sansuSelected: false,
  introSeen: false,
};

export const seedMidwayState = (): void => {
  localStorage.setItem("sugoroku-home-v2", JSON.stringify(MIDWAY_STATE));
};
