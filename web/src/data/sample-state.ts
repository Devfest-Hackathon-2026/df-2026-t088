import type { GameState } from "./types";

// 開始時と「はじめからにする」の状態。進みも経験値も無く、小数の章の最初から始める（D-67、D-78）。
// sansuSelected は PG-001 を最初に出すために false。途中から始める説明は要らないので introSeen は true
export const SAMPLE_STATE: GameState = {
  chapterId: "decimal",
  takenOff: [],
  xp: { kokugo: 0, sansu: 0, rika: 0, shakai: 0, eigo: 0, ongaku: 0, taiiku: 0, zuko: 0, katei: 0, seikatsu: 0 },
  progress: {},
  sansuSelected: false,
  introSeen: true,
};
