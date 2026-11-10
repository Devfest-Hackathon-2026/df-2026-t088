/** 盤面で開いているパネル。レベルアップは game.levelUp、アカウントのパネルは BoardPage の state で開くので、ここには含めない */
export type BoardDialog =
  | { type: "intro" };
